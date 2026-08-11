"""Order service: cart lifecycle, checkout, receipts and reviews.

Checkout computes server-side totals (subtotal / coupon discount / tax /
total), mints the order number and invoice, and awards loyalty points. The
payment itself is handled by the payment service.
"""

from __future__ import annotations

import json
import logging
import random
from datetime import datetime, timezone

from prisma import Prisma

from . import coupon_service
from .receipt_service import build_receipt
from ..core.config import get_settings

logger = logging.getLogger(__name__)


# -------------------------------------------------------------------- cart

def _serialize_cart_item(row: object) -> dict:
    row = row.__dict__
    return {
        "id": row["id"],
        "menuItemId": row["menuItemId"],
        "name": row["name"],
        "unitPrice": row["unitPrice"],
        "quantity": row["quantity"],
        "customization": _safe_json(row.get("customization")),
        "createdAt": row["createdAt"].isoformat(),
    }


def get_cart(db: Prisma, user_id: str) -> list[dict]:
    rows = db.cartitem.find_many(where={"userId": user_id}, order={"id": "asc"})
    return [_serialize_cart_item(row) for row in rows]


def add_to_cart(
    db: Prisma,
    user_id: str,
    menu_item_id: int,
    quantity: int,
    customization: dict | None = None,
) -> dict:
    item = db.menuitem.find_unique(where={"id": menu_item_id})
    if item is None:
        raise ValueError("Menu item not found.")
    if not item.available:
        raise ValueError(f"{item.name} is currently sold out.")
    if quantity < 1:
        raise ValueError("Quantity must be at least 1.")

    existing = db.cartitem.find_first(where={"userId": user_id, "menuItemId": menu_item_id})
    if existing is not None:
        row = db.cartitem.update(
            where={"id": existing.id},
            data={"quantity": {"increment": quantity}},
        )
    else:
        row = db.cartitem.create(
            data={
                "userId": user_id,
                "menuItemId": item.id,
                "name": item.name,
                "unitPrice": item.price,
                "quantity": quantity,
                "customization": json.dumps(customization or {}),
            }
        )
    return _serialize_cart_item(row)


def update_cart_item(db: Prisma, cart_item_id: int, user_id: str, *, quantity: int | None = None, customization: dict | None = None) -> dict:
    row = db.cartitem.find_first(where={"id": cart_item_id, "userId": user_id})
    if row is None:
        raise ValueError("Cart item not found.")
    data: dict = {}
    if quantity is not None:
        if quantity < 1:
            raise ValueError("Quantity must be at least 1.")
        data["quantity"] = quantity
    if customization is not None:
        data["customization"] = json.dumps(customization)
    updated = db.cartitem.update(where={"id": cart_item_id}, data=data)
    return _serialize_cart_item(updated)


def remove_cart_item(db: Prisma, cart_item_id: int, user_id: str) -> None:
    db.cartitem.delete_many(where={"id": cart_item_id, "userId": user_id})


def clear_cart(db: Prisma, user_id: str) -> None:
    db.cartitem.delete_many(where={"userId": user_id})


def cart_totals(items: list[dict]) -> tuple[float, float, int]:
    subtotal = round(sum(i["unitPrice"] * i["quantity"] for i in items), 2)
    count = sum(i["quantity"] for i in items)
    return subtotal, count, _est_prep_minutes(count)


def _est_prep_minutes(count: int) -> int:
    if count <= 1:
        return 5
    if count <= 3:
        return 10
    return 15 + 2 * (count - 3)


# ------------------------------------------------------------------ orders

def _new_order_number(db: Prisma) -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    for _ in range(50):
        suffix = f"{random.randint(0, 999999):06d}"
        number = f"CS-{date_part}-{suffix}"
        if db.order.find_first(where={"orderNumber": number}) is None:
            return number
    raise RuntimeError("Could not allocate a unique order number.")


def _status_history_map(db: Prisma, user_id: str) -> dict[str, list[dict]]:
    """Reconstruct per-order status history from the analytics event log.

    ``order_placed`` events mark the start (status ``pending``); every
    transition afterwards (payment confirm, admin status change) appends an
    ``order_status`` event. Events are matched to orders by order number.
    """
    rows = db.analyticsevent.find_many(
        where={"userId": user_id, "event": {"in": ["order_placed", "order_status"]}},
        order={"createdAt": "asc"},
    )
    by_order: dict[str, list[dict]] = {}
    for row in rows:
        try:
            payload = json.loads(row.payload)
        except (TypeError, ValueError):
            payload = {}
        order_number = payload.get("orderNumber")
        status = payload.get("status")
        if not order_number or not status:
            continue
        by_order.setdefault(order_number, []).append(
            {"status": status, "timestamp": row.createdAt.isoformat()}
        )
    return by_order


def _order_payload(order: object, history: list[dict] | None = None) -> dict:
    o = order.__dict__
    items = [o.get("items") or []]
    flat = []
    for group in items:
        for it in group:
            flat.append(
                {
                    "id": it.__dict__["id"],
                    "name": it.__dict__["name"],
                    "unitPrice": it.__dict__["unitPrice"],
                    "quantity": it.__dict__["quantity"],
                    "customization": _safe_json(it.__dict__.get("customization")),
                }
            )
    payload = {
        "id": o["id"],
        "orderNumber": o["orderNumber"],
        "status": o["status"],
        "paymentMethod": o["paymentMethod"],
        "paymentStatus": o["paymentStatus"],
        "subtotal": o["subtotal"],
        "discount": o["discount"],
        "tax": o["tax"],
        "total": o["total"],
        "couponCode": o["couponCode"],
        "tip": o["tip"],
        "notes": o["notes"],
        "estMinutes": o["estMinutes"],
        "createdAt": o["createdAt"].isoformat(),
        "completedAt": o["completedAt"].isoformat() if o.get("completedAt") else None,
        "statusHistory": history or [],
        "items": flat,
    }
    if o.get("receipt") is not None:
        r = o["receipt"].__dict__
        payload["receipt"] = {
            "invoiceNumber": r["invoiceNumber"],
            "qrCode": r["qrCode"],
            "pdfUrl": r["pdfUrl"],
        }
    if o.get("review") is not None:
        rv = o["review"].__dict__
        payload["review"] = {"rating": rv["rating"], "comment": rv["comment"]}
    return payload


def create_order(
    db: Prisma,
    user_id: str,
    *,
    payment_method: str,
    items: list[dict] | None = None,
    coupon_code: str | None = None,
    tip: float = 0.0,
    notes: str | None = None,
) -> dict:
    if payment_method not in ("upi", "card", "cash", "wallet"):
        raise ValueError("Unsupported payment method.")

    if items is None:
        cart_items = get_cart(db, user_id)
        if not cart_items:
            raise ValueError("Your cart is empty.")
        items = [
            {"menuItemId": c["menuItemId"], "name": c["name"], "unitPrice": c["unitPrice"], "quantity": c["quantity"], "customization": c["customization"]}
            for c in cart_items
        ]
    else:
        for it in items:
            row = db.menuitem.find_unique(where={"id": it.get("menuItemId")})
            if row is None:
                raise ValueError(f"Menu item {it.get('name')} not found.")
            it.setdefault("name", row.name)
            it.setdefault("unitPrice", row.price)
            if not row.available:
                raise ValueError(f"{row.name} is currently sold out.")

    subtotal = round(sum(i["unitPrice"] * i["quantity"] for i in items), 2)
    discount, effective_code = coupon_service.apply_coupon(db, user_id, coupon_code, subtotal)

    settings = get_settings()
    tax = round(max(0.0, subtotal - discount) * settings.tax_rate, 2)
    total = round(max(0.0, subtotal - discount + tax + tip), 2)
    est = _est_prep_minutes(sum(i["quantity"] for i in items))

    order_number = _new_order_number(db)
    order = db.order.create(
        data={
            "orderNumber": order_number,
            "userId": user_id,
            "paymentMethod": payment_method,
            "subtotal": subtotal,
            "discount": discount,
            "tax": tax,
            "total": total,
            "couponCode": effective_code,
            "tip": tip,
            "notes": notes,
            "estMinutes": est,
            "items": {
                "create": [
                    {
                        "menuItemId": i["menuItemId"],
                        "name": i["name"],
                        "unitPrice": i["unitPrice"],
                        "quantity": i["quantity"],
                        "customization": json.dumps(i.get("customization") or {}),
                    }
                    for i in items
                ]
            },
        },
        include={"items": True, "receipt": True, "review": True},
    )

    receipt = build_receipt(db, order)
    order = db.order.find_unique(where={"id": order.id}, include={"items": True, "receipt": True, "review": True})

    # Loyalty + referral rewards.
    from . import users as user_service
    user_service.add_loyalty_points(db, user_id, settings.loyalty_points_per_order)

    db.analyticsevent.create(
        data={
            "event": "order_placed",
            "userId": user_id,
            "payload": json.dumps(
                {"orderNumber": order_number, "status": "pending", "total": total, "items": len(items)}
            ),
        }
    )
    db.cartitem.delete_many(where={"userId": user_id})
    logger.info("Order %s created for user %s (total $%.2f)", order_number, user_id, total)
    return _order_payload(order)


def get_order(db: Prisma, order_id: str, user_id: str) -> dict:
    order = db.order.find_unique(
        where={"id": order_id},
        include={"items": True, "receipt": True, "review": True},
    )
    if order is None:
        raise KeyError("Order not found.")
    if order.userId != user_id:
        raise PermissionError("Order belongs to another user.")
    history = _status_history_map(db, user_id).get(order.orderNumber, [])
    return _order_payload(order, history)


def list_orders(db: Prisma, user_id: str, limit: int = 50) -> list[dict]:
    rows = db.order.find_many(
        where={"userId": user_id},
        order={"createdAt": "desc"},
        take=limit,
        include={"items": True, "receipt": True, "review": True},
    )
    history_map = _status_history_map(db, user_id)
    return [_order_payload(o, history_map.get(o.orderNumber, [])) for o in rows]


def update_order_status(db: Prisma, order_id: str, status: str) -> dict:
    if status not in ("pending", "confirmed", "preparing", "ready", "completed", "cancelled"):
        raise ValueError("Invalid order status.")
    order = db.order.find_unique(where={"id": order_id})
    if order is None:
        raise KeyError("Order not found.")
    data: dict = {"status": status}
    if status == "completed":
        data["completedAt"] = datetime.now(timezone.utc)
    db.order.update(where={"id": order_id}, data=data)
    db.analyticsevent.create(
        data={
            "event": "order_status",
            "userId": order.userId,
            "payload": json.dumps({"orderNumber": order.orderNumber, "status": status}),
        }
    )
    return get_order(db, order_id, order.userId)


def submit_review(db: Prisma, user_id: str, order_id: str, rating: int, comment: str | None = None) -> dict:
    if rating < 1 or rating > 5:
        raise ValueError("Rating must be between 1 and 5.")
    order = db.order.find_unique(where={"id": order_id})
    if order is None:
        raise KeyError("Order not found.")
    if order.userId != user_id:
        raise PermissionError("Order belongs to another user.")
    review = db.review.create(data={"orderId": order_id, "userId": user_id, "rating": rating, "comment": comment})
    return {"id": review.id, "rating": review.rating, "comment": review.comment}


def _safe_json(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
        return value if isinstance(value, dict) else {}
    except (TypeError, ValueError):
        return {}
