"""Coupon service: validation, auto-granted birthday coupons, festival
offers and referral rewards."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from prisma import Prisma

from ..core.config import get_settings

logger = logging.getLogger(__name__)


def _coupon_payload(coupon: object) -> dict:
    c = coupon.__dict__
    return {
        "id": c["id"],
        "code": c["code"],
        "description": c["description"],
        "discountType": c["discountType"],
        "discountValue": c["discountValue"],
        "minOrder": c["minOrder"],
        "maxDiscount": c["maxDiscount"],
        "expiresAt": c["expiresAt"].isoformat() if c["expiresAt"] else None,
        "isActive": c["isActive"],
    }


def _discount_for(coupon: object, subtotal: float) -> float:
    c = coupon.__dict__
    if c["discountType"] == "percentage":
        value = subtotal * c["discountValue"] / 100.0
    else:
        value = c["discountValue"]
    if c["maxDiscount"] is not None:
        value = min(value, c["maxDiscount"])
    return round(min(value, subtotal), 2)


def _ensure_birthday_coupon(db: Prisma, user_id: str) -> None:
    """Auto-grant a birthday coupon when it's the user's birthday."""
    settings = get_settings()
    user = db.user.find_unique(where={"id": user_id})
    if user is None or user.birthday is None:
        return
    today = datetime.now(timezone.utc).date()
    if (user.birthday.month, user.birthday.day) != (today.month, today.day):
        return

    code = settings.birthday_coupon_code
    coupon = db.coupon.find_unique(where={"code": code})
    if coupon is None:
        coupon = db.coupon.create(
            data={
                "code": code,
                "description": "Happy birthday! 20% off your order today.",
                "discountType": "percentage",
                "discountValue": settings.birthday_discount,
                "minOrder": 0,
                "expiresAt": datetime.now(timezone.utc).replace(hour=23, minute=59, second=59),
            }
        )
    granted = db.usercoupon.find_first(where={"userId": user_id, "couponId": coupon.id})
    if granted is None:
        db.usercoupon.create(data={"userId": user_id, "couponId": coupon.id})
        logger.info("Birthday coupon %s granted to %s", code, user_id)


def list_available(db: Prisma, user_id: str) -> list[dict]:
    """Coupons the user can use right now (auto-grants birthday coupon)."""
    _ensure_birthday_coupon(db, user_id)
    now = datetime.now(timezone.utc)

    rows = db.coupon.find_many(
        where={
            "isActive": True,
            "OR": [{"expiresAt": None}, {"expiresAt": {"gte": now}}],
        }
    )
    used_ids = {
        row.couponId
        for row in db.usercoupon.find_many(where={"userId": user_id, "used": True})
    }

    available = []
    for coupon in rows:
        c = coupon.__dict__
        if c["usageLimit"] is not None and c["usageCount"] >= c["usageLimit"]:
            continue
        payload = _coupon_payload(coupon)
        payload["used"] = coupon.id in used_ids
        payload["reason"] = _reason_for(coupon)
        available.append(payload)
    return available


def _reason_for(coupon: object) -> str:
    c = coupon.__dict__
    code = c["code"].lower()
    if code.startswith("birthday"):
        return "It's your birthday! "
    if c["description"]:
        return c["description"]
    return "Promotional offer"


def validate_coupon(db: Prisma, user_id: str, code: str, subtotal: float) -> tuple[float, str | None]:
    """Return (discount, normalized_code). Unusable codes yield (0, None)."""
    return apply_coupon(db, user_id, code, subtotal)


def apply_coupon(db: Prisma, user_id: str, code: str | None, subtotal: float) -> tuple[float, str | None]:
    """Apply a coupon if valid; never raises on a bad code — just discounts 0."""
    if not code:
        return 0.0, None
    normalized = code.strip().upper()
    now = datetime.now(timezone.utc)

    coupon = db.coupon.find_unique(where={"code": normalized})
    if coupon is None:
        logger.info("Coupon %s not found.", normalized)
        return 0.0, None
    if not coupon.isActive:
        return 0.0, None
    if coupon.expiresAt is not None and coupon.expiresAt < now:
        return 0.0, None
    if coupon.startsAt is not None and coupon.startsAt > now:
        return 0.0, None
    if subtotal < coupon.minOrder:
        logger.info("Coupon %s below min order $%.2f.", normalized, coupon.minOrder)
        return 0.0, None
    if coupon.usageLimit is not None and coupon.usageCount >= coupon.usageLimit:
        return 0.0, None

    # Birthday / one-time coupons are single-use per user.
    if normalized.lower().startswith("birthday"):
        claimed = db.usercoupon.find_first(where={"userId": user_id, "couponId": coupon.id, "used": True})
        if claimed is not None:
            return 0.0, None

    discount = _discount_for(coupon, subtotal)
    db.coupon.update(where={"id": coupon.id}, data={"usageCount": {"increment": 1}})
    existing = db.usercoupon.find_first(where={"userId": user_id, "couponId": coupon.id})
    if existing is not None:
        db.usercoupon.update(where={"id": existing.id}, data={"used": True, "usedAt": now})
    else:
        db.usercoupon.create(data={"userId": user_id, "couponId": coupon.id, "used": True, "usedAt": now})
    logger.info("Coupon %s applied: -$%.2f", normalized, discount)
    return discount, normalized


def award_referral_reward(db: Prisma, user_id: str) -> None:
    """Award the referrer points when the referee places their first order."""
    settings = get_settings()
    user = db.user.find_unique(where={"id": user_id})
    if user is None or not user.referredById:
        return
    order_count = db.order.count(where={"userId": user_id})
    if order_count > 1:
        return
    db.user.update(
        where={"id": user.referredById},
        data={"loyaltyPoints": {"increment": settings.referral_reward_points}},
    )
    db.referral.create(
        data={"referrerId": user.referredById, "refereeId": user_id, "rewardPoints": settings.referral_reward_points}
    )
    logger.info("Referral reward: %d points to %s", settings.referral_reward_points, user.referredById)


def festival_offers(db: Prisma) -> list[dict]:
    now = datetime.now(timezone.utc)
    rows = db.festival.find_many(where={"startsAt": {"lte": now}, "endsAt": {"gte": now}})
    return [
        {
            "id": f.id,
            "name": f.name,
            "emoji": f.emoji,
            "description": f.description,
            "theme": f.theme,
        }
        for f in rows
    ]
