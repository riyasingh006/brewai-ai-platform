"""User service: identity upsert, profile, favorites, addresses, cards,
loyalty points and referrals."""

from __future__ import annotations

import logging
import random
import string
from collections import Counter
from datetime import datetime, timedelta, timezone

from prisma import Prisma
from prisma.models import User

from backend.core.config import get_settings

logger = logging.getLogger(__name__)


def get_or_create_user(
    db: Prisma,
    user_id: str,
    email: str | None,
    name: str | None = None,
    image_url: str | None = None,
) -> dict:
    """Return the user record, creating it (with a referral code) if new."""
    user = db.user.find_unique(where={"id": user_id})
    if user is not None:
        return _serialize_user(user)
    user = db.user.create(
        data={
            "id": user_id,
            "email": email or f"{user_id}@placeholder.local",
            "name": name,
            "imageUrl": image_url,
            "referralCode": _generate_referral_code(db),
        }
    )
    logger.info("Created user %s (%s)", user_id, user.email)
    return _serialize_user(user)


def _generate_referral_code(db: Prisma) -> str:
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(50):
        code = "".join(random.choices(alphabet, k=6))
        existing = db.user.find_first(where={"referralCode": code})
        if existing is None:
            return code
    raise RuntimeError("Could not generate a unique referral code.")


def _serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "imageUrl": user.imageUrl,
        "role": user.role,
        "phone": user.phone,
        "birthday": user.birthday.isoformat() if user.birthday else None,
        "loyaltyPoints": user.loyaltyPoints,
        "referralCode": user.referralCode,
        "createdAt": user.createdAt.isoformat(),
    }


def get_profile(db: Prisma, user_id: str) -> dict:
    user = db.user.find_unique(
        where={"id": user_id},
        include={"orders": {"take": 10, "orderBy": {"createdAt": "desc"}}},
    )
    if user is None:
        raise KeyError("User not found.")
    profile = _serialize_user(user)
    profile["orderCount"] = db.order.count(where={"userId": user_id})
    profile["favoriteCount"] = db.favorite.count(where={"userId": user_id})
    profile["addresses"] = list_addresses(db, user_id)
    profile["savedCards"] = list_cards(db, user_id)
    return profile


def update_profile(
    db: Prisma,
    user_id: str,
    *,
    name: str | None = None,
    phone: str | None = None,
    birthday: str | None = None,
    image_url: str | None = None,
) -> dict:
    data: dict = {}
    if name is not None:
        data["name"] = name
    if phone is not None:
        data["phone"] = phone
    if birthday is not None:
        data["birthday"] = datetime.fromisoformat(birthday.replace("Z", "+00:00"))
    if image_url is not None:
        data["imageUrl"] = image_url
    user = db.user.update(where={"id": user_id}, data=data)
    return _serialize_user(user)


def add_loyalty_points(db: Prisma, user_id: str, points: int) -> int:
    user = db.user.update(
        where={"id": user_id},
        data={"loyaltyPoints": {"increment": points}},
    )
    return user.loyaltyPoints


def spend_loyalty_points(db: Prisma, user_id: str, points: int) -> int:
    user = db.user.find_unique(where={"id": user_id})
    if user is None or user.loyaltyPoints < points:
        raise ValueError("Not enough loyalty points.")
    updated = db.user.update(
        where={"id": user_id},
        data={"loyaltyPoints": {"decrement": points}},
    )
    return updated.loyaltyPoints


# --------------------------------------------------------------- Favorites

def list_favorites(db: Prisma, user_id: str) -> list[dict]:
    rows = db.favorite.find_many(
        where={"userId": user_id},
        include={"menuItem": True},
        order={"createdAt": "desc"},
    )
    return [{"id": row.id, "menuItem": _serialize_menu_item(row.menuItem)} for row in rows]


def add_favorite(db: Prisma, user_id: str, menu_item_id: int) -> dict:
    existing = db.favorite.find_first(where={"userId": user_id, "menuItemId": menu_item_id})
    if existing is None:
        row = db.favorite.create(data={"userId": user_id, "menuItemId": menu_item_id})
        logger.info("User %s favorited menu item %d", user_id, menu_item_id)
        return {"id": row.id, "added": True}
    return {"id": existing.id, "added": False}


def remove_favorite(db: Prisma, user_id: str, menu_item_id: int) -> dict:
    result = db.favorite.delete_many(where={"userId": user_id, "menuItemId": menu_item_id})
    return {"removed": result > 0}


# ---------------------------------------------------------------- Addresses

def list_addresses(db: Prisma, user_id: str) -> list[dict]:
    rows = db.address.find_many(where={"userId": user_id}, order={"id": "asc"})
    return [_serialize_address(row) for row in rows]


def create_address(db: Prisma, user_id: str, data: dict) -> dict:
    if data.get("isDefault"):
        db.address.update_many(where={"userId": user_id}, data={"isDefault": False})
    row = db.address.create(data={**data, "userId": user_id})
    return _serialize_address(row)


def update_address(db: Prisma, address_id: int, user_id: str, data: dict) -> dict:
    if data.get("isDefault"):
        db.address.update_many(where={"userId": user_id}, data={"isDefault": False})
    row = db.address.update(where={"id": address_id}, data=data)
    return _serialize_address(row)


def delete_address(db: Prisma, address_id: int) -> None:
    db.address.delete(where={"id": address_id})


def _serialize_address(row: object) -> dict:
    row = row.__dict__
    return {k: row[k] for k in ("id", "label", "line1", "line2", "city", "state", "zip", "country", "isDefault")}


# --------------------------------------------------------------- SavedCards

def list_cards(db: Prisma, user_id: str) -> list[dict]:
    rows = db.savedcard.find_many(where={"userId": user_id}, order={"id": "asc"})
    return [_serialize_card(row) for row in rows]


def create_card(db: Prisma, user_id: str, data: dict) -> dict:
    if data.get("isDefault"):
        db.savedcard.update_many(where={"userId": user_id}, data={"isDefault": False})
    row = db.savedcard.create(data={**data, "userId": user_id})
    return _serialize_card(row)


def delete_card(db: Prisma, card_id: int) -> None:
    db.savedcard.delete(where={"id": card_id})


def _serialize_card(row: object) -> dict:
    row = row.__dict__
    return {k: row[k] for k in ("id", "brand", "last4", "expiry", "isDefault")}


# ------------------------------------------------------------------- Menu

def _serialize_menu_item(item: object) -> dict:
    item = item.__dict__
    return {
        "id": item["id"],
        "name": item["name"],
        "category": item["category"],
        "price": item["price"],
        "description": item["description"],
        "available": item["available"],
        "imageUrl": item["imageUrl"],
        "tags": _safe_json_list(item.get("tags")),
        "calories": item.get("calories"),
    }


def _safe_json_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    import json

    try:
        value = json.loads(raw)
        return list(value) if isinstance(value, list) else []
    except (TypeError, ValueError):
        return []


# ------------------------------------------------------------- dashboard

REWARD_TIERS = [("Bronze", 0), ("Silver", 100), ("Gold", 250)]


def _short_order(o) -> dict:
    return {
        "id": o.id,
        "orderNumber": o.orderNumber,
        "status": o.status,
        "total": o.total,
        "createdAt": o.createdAt.isoformat(),
        "items": [{"name": i.name, "quantity": i.quantity} for i in o.items],
    }


def customer_dashboard(db: Prisma, user_id: str) -> dict:
    """Personal dashboard payload: loyalty tier, stats, active + recent orders."""
    user = db.user.find_unique(
        where={"id": user_id},
        include={"orders": {"include": {"items": True}, "orderBy": {"createdAt": "desc"}}},
    )
    if user is None:
        raise KeyError("User not found.")

    orders = list(user.orders or [])
    valid = [o for o in orders if o.status != "cancelled"]

    total_spend = round(sum(o.total for o in valid), 2)
    now = datetime.now(timezone.utc)
    visits_30d = sum(1 for o in orders if o.createdAt >= now - timedelta(days=30))

    name_count: Counter[str] = Counter()
    for o in valid:
        for item in o.items:
            name_count[item.name] += item.quantity
    favorite_drink = name_count.most_common(1)[0][0] if name_count else None

    points = user.loyaltyPoints
    tier = REWARD_TIERS[0][0]
    next_tier = None
    points_to_next = 0
    for name, threshold in REWARD_TIERS:
        if points >= threshold:
            tier = name
        else:
            next_tier = name
            points_to_next = threshold - points
            break

    active = next((o for o in orders if o.status in ("pending", "confirmed", "preparing")), None)

    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "loyaltyPoints": points,
            "referralCode": user.referralCode,
            "createdAt": user.createdAt.isoformat(),
        },
        "stats": {
            "totalOrders": len(valid),
            "totalSpend": total_spend,
            "favoriteDrink": favorite_drink,
            "visits30d": visits_30d,
            "memberSince": user.createdAt.isoformat(),
        },
        "loyalty": {
            "tier": tier,
            "nextTier": next_tier,
            "pointsToNext": points_to_next,
            "rewardsPerOrder": get_settings().loyalty_points_per_order,
            "referralReward": get_settings().referral_reward_points,
        },
        "activeOrder": _short_order(active) if active else None,
        "recentOrders": [_short_order(o) for o in orders[:6]],
    }
