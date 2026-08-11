"""Admin analytics: dashboards for orders, revenue, popular drinks,
inventory, customers, peak hours, coupons and ratings."""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timedelta, timezone

from prisma import Prisma

from app import tools
from backend.core.config import get_settings


def _day_key(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")


def dashboard_summary(db: Prisma) -> dict:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    today_orders = db.order.find_many(where={"createdAt": {"gte": today_start}})
    today_revenue = round(sum(o.total for o in today_orders if o.status != "cancelled"), 2)
    total_orders = db.order.count()
    completed = db.order.find_many(where={"status": "completed"}, include={"items": True, "review": True})
    total_revenue = round(sum(o.total for o in completed), 2)

    ratings = [r.rating for r in db.review.find_many()]
    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else 0

    return {
        "todayOrders": len(today_orders),
        "todayRevenue": today_revenue,
        "totalOrders": total_orders,
        "totalRevenue": total_revenue,
        "activeCustomers": db.user.count(where={"role": "customer"}),
        "avgRating": avg_rating,
        "reviewsCount": len(ratings),
        "pendingOrders": db.order.count(where={"status": {"in": ["pending", "confirmed", "preparing"]}}),
    }


def revenue_series(db: Prisma, days: int = 14) -> list[dict]:
    start = datetime.now(timezone.utc) - timedelta(days=days - 1)
    start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    rows = db.order.find_many(where={"createdAt": {"gte": start}})

    by_day: dict[str, list[float]] = {}
    for order in rows:
        key = _day_key(order.createdAt)
        by_day.setdefault(key, []).append(order.total)

    today = datetime.now(timezone.utc).date()
    series = []
    for offset in range(days - 1, -1, -1):
        day = today - timedelta(days=offset)
        key = day.strftime("%Y-%m-%d")
        totals = by_day.get(key, [])
        series.append(
            {
                "date": key,
                "revenue": round(sum(totals), 2),
                "orders": len(totals),
            }
        )
    return series


def popular_drinks(db: Prisma, limit: int = 10) -> list[dict]:
    rows = db.order.find_many(where={"status": {"not": "cancelled"}}, include={"items": True})
    name_count: Counter[str] = Counter()
    name_revenue: dict[str, float] = {}
    for order in rows:
        for item in order.items:
            name_count[item.name] += item.quantity
            name_revenue[item.name] = name_revenue.get(item.name, 0.0) + item.unitPrice * item.quantity
    ranked = sorted(name_count.items(), key=lambda kv: -kv[1])[:limit]
    return [{"name": name, "count": count, "revenue": round(name_revenue.get(name, 0.0), 2)} for name, count in ranked]


def inventory(db: Prisma) -> list[dict]:
    rows = db.menuitem.find_many()
    order_items = db.orderitem.find_many(include={"menuItem": True})
    sold_by_item: Counter[int] = Counter(oi.menuItemId for oi in order_items if oi.menuItemId)
    return [
        {
            "id": row.id,
            "name": row.name,
            "category": row.category,
            "price": row.price,
            "available": row.available,
            "sold": sold_by_item.get(row.id, 0),
            "tags": _tags(row.tags),
        }
        for row in rows
    ]


def peak_hours(db: Prisma) -> list[dict]:
    rows = db.order.find_many(where={"createdAt": {"gte": datetime.now(timezone.utc) - timedelta(days=30)}})
    counter: Counter[int] = Counter(o.createdAt.astimezone(timezone.utc).hour for o in rows)
    return [{"hour": hour, "orders": counter.get(hour, 0)} for hour in range(24)]


def recent_customers(db: Prisma, limit: int = 20) -> list[dict]:
    rows = db.user.find_many(order={"createdAt": "desc"}, take=limit)
    return [
        {
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "orders": db.order.count(where={"userId": u.id}),
            "loyaltyPoints": u.loyaltyPoints,
            "createdAt": u.createdAt.isoformat(),
        }
        for u in rows
    ]


def coupon_usage(db: Prisma) -> list[dict]:
    rows = db.coupon.find_many(order={"usageCount": "desc"}, take=20)
    return [
        {
            "code": c.code,
            "description": c.description,
            "discountType": c.discountType,
            "discountValue": c.discountValue,
            "usageCount": c.usageCount,
            "usageLimit": c.usageLimit,
            "isActive": c.isActive,
        }
        for c in rows
    ]


def recent_reviews(db: Prisma, limit: int = 20) -> list[dict]:
    rows = db.review.find_many(include={"user": True}, order={"createdAt": "desc"}, take=limit)
    return [
        {
            "id": r.id,
            "rating": r.rating,
            "comment": r.comment,
            "user": r.user.name or r.user.email,
            "createdAt": r.createdAt.isoformat(),
        }
        for r in rows
    ]


def order_status_counts(db: Prisma) -> dict:
    counts: dict[str, int] = {}
    for status in ("pending", "confirmed", "preparing", "ready", "completed", "cancelled"):
        counts[status] = db.order.count(where={"status": status})
    return counts


# ------------------------------------------------------------------ dashboard

ORDER_STATUS_META = [
    ("pending", "#F59E0B"),
    ("confirmed", "#8B5CF6"),
    ("preparing", "#D88935"),
    ("ready", "#3B82F6"),
    ("completed", "#35C98A"),
    ("cancelled", "#EF476F"),
]

TIME_BLOCKS = [
    ("12 AM", 0, 5),
    ("6 AM", 6, 11),
    ("12 PM", 12, 17),
    ("6 PM", 18, 23),
]

WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _pct_delta(cur: float, prev: float) -> float | None:
    if prev > 0:
        return round((cur - prev) / prev * 100, 1)
    if cur > 0:
        return 100.0
    return None


def dashboard_analytics(
    db: Prisma,
    start: datetime,
    end: datetime,
    prev_start: datetime,
    prev_end: datetime,
    period: str,
    label: str,
    daily: bool,
) -> dict:
    """Single-shot analytics payload for the dashboard view.

    Aggregation happens server-side: orders in the selected window are fetched
    once (with their items) and every metric is derived from that data.
    Cancelled orders are excluded from revenue/orders per the existing
    business rules (``dashboard_summary.todayRevenue``, ``popular_drinks``).
    """
    orders = db.order.find_many(
        where={"createdAt": {"gte": start, "lte": end}},
        include={"items": True},
    )
    prev_orders = db.order.find_many(where={"createdAt": {"gte": prev_start, "lte": prev_end}})

    valid = [o for o in orders if o.status != "cancelled"]
    prev_valid = [o for o in prev_orders if o.status != "cancelled"]

    revenue = round(sum(o.total for o in valid), 2)
    prev_revenue = round(sum(o.total for o in prev_valid), 2)
    count = len(valid)
    prev_count = len(prev_valid)

    user_ids = {o.userId for o in valid}
    prev_user_ids = {o.userId for o in prev_valid}
    customers = len(user_ids)
    prev_customers = len(prev_user_ids)

    avg = round(revenue / count, 2) if count else 0
    prev_avg = round(prev_revenue / prev_count, 2) if prev_count else 0
    status_counts: Counter[str] = Counter(o.status for o in orders)

    summary = {
        "revenue": revenue,
        "orders": count,
        "customers": customers,
        "avg": avg,
        "prevRevenue": prev_revenue,
        "prevOrders": prev_count,
        "prevCustomers": prev_customers,
        "prevAvg": prev_avg,
        "revenueDelta": _pct_delta(revenue, prev_revenue),
        "ordersDelta": _pct_delta(count, prev_count),
        "customersDelta": _pct_delta(customers, prev_customers),
        "avgDelta": _pct_delta(avg, prev_avg),
    }

    return {
        "range": {
            "period": period,
            "label": label,
            "start": start.isoformat(),
            "end": end.isoformat(),
        },
        "summary": summary,
        "revenue": _revenue_series_for_window(db, start, end, daily),
        "topItems": _top_items(valid, limit=5),
        "ordersByTime": _orders_by_time(valid),
        "orderStatus": [
            {"label": s, "value": status_counts.get(s, 0), "color": color}
            for s, color in ORDER_STATUS_META
            if status_counts.get(s, 0) > 0
        ],
        "customers": _customer_segments(db, start, valid),
        "recentOrders": _recent_orders(db, start, end),
    }


def _revenue_series_for_window(db: Prisma, start: datetime, end: datetime, daily: bool) -> list[dict]:
    rows = db.order.find_many(where={"createdAt": {"gte": start, "lte": end}})
    valid = [o for o in rows if o.status != "cancelled"]
    by_key: dict[str, list[float]] = {}
    counts: dict[str, int] = {}
    for o in valid:
        if daily:
            key = _day_key(o.createdAt)
        else:
            iso = o.createdAt.astimezone(timezone.utc).isocalendar()
            key = f"{iso.year}-W{iso.week:02d}"
        by_key.setdefault(key, []).append(o.total)
        counts[key] = counts.get(key, 0) + 1

    series = []
    if daily:
        cur = start.date()
        last = end.date()
        while cur <= last:
            key = cur.strftime("%Y-%m-%d")
            series.append({"date": key, "revenue": round(sum(by_key.get(key, [])), 2), "orders": counts.get(key, 0)})
            cur += timedelta(days=1)
    else:
        cur = start.date()
        last = end.date()
        while cur <= last:
            iso = cur.isocalendar()
            key = f"{iso.year}-W{iso.week:02d}"
            series.append({"date": key, "revenue": round(sum(by_key.get(key, [])), 2), "orders": counts.get(key, 0)})
            cur += timedelta(days=7)
    return series


def _top_items(orders: list, limit: int = 5) -> list[dict]:
    count: Counter[str] = Counter()
    revenue: dict[str, float] = {}
    for o in orders:
        for item in o.items:
            count[item.name] += item.quantity
            revenue[item.name] = revenue.get(item.name, 0.0) + item.unitPrice * item.quantity
    ranked = sorted(count.items(), key=lambda kv: -kv[1])[:limit]
    return [
        {"name": name, "count": count[name], "revenue": round(revenue.get(name, 0.0), 2)}
        for name, _ in ranked
    ]


def _orders_by_time(orders: list) -> dict:
    matrix = [[0 for _ in range(7)] for _ in range(len(TIME_BLOCKS))]
    for o in orders:
        dt = o.createdAt.astimezone(timezone.utc)
        col = dt.weekday()  # Monday == 0
        hour = dt.hour
        row = next((i for i, (_, lo, hi) in enumerate(TIME_BLOCKS) if lo <= hour <= hi), len(TIME_BLOCKS) - 1)
        matrix[row][col] += 1
    return {
        "rows": [b[0] for b in TIME_BLOCKS],
        "columns": WEEKDAY_LABELS,
        "matrix": matrix,
        "max": max((max(row) for row in matrix), default=0),
    }


def _recent_orders(db: Prisma, start: datetime, end: datetime, limit: int = 8) -> list[dict]:
    """Newest orders inside the analytics window for the Recent Orders table."""
    rows = db.order.find_many(
        where={"createdAt": {"gte": start, "lte": end}},
        include={"items": True, "user": True},
        order={"createdAt": "desc"},
        take=limit,
    )
    return [
        {
            "id": o.id,
            "orderNumber": o.orderNumber,
            "customer": (o.user.name if o.user and o.user.name else (o.user.email if o.user else "Guest")),
            "status": o.status,
            "total": round(o.total, 2),
            "createdAt": o.createdAt.isoformat(),
            "items": [{"name": it.name, "quantity": it.quantity} for it in o.items],
        }
        for o in rows
    ]


def _customer_segments(db: Prisma, start: datetime, orders: list) -> list[dict]:
    """New = customer's first-ever order falls inside the window.

    Returning = customer had at least one order before the window start.
    """
    active_users = {o.userId for o in orders if o.userId}
    new = 0
    returning = 0
    for uid in active_users:
        earlier = db.order.count(where={"userId": uid, "createdAt": {"lt": start}})
        if earlier > 0:
            returning += 1
        else:
            new += 1
    return [
        {"label": "Returning", "value": returning, "color": "#35C98A"},
        {"label": "New", "value": new, "color": "#8B5CF6"},
    ]


def _tags(raw: str | None) -> list[str]:
    import json

    if not raw:
        return []
    try:
        value = json.loads(raw)
        return list(value) if isinstance(value, list) else []
    except (TypeError, ValueError):
        return []


def import_menu_from_json(db: Prisma) -> int:
    """Sync the AI core menu (data/menu.json) into the database (upsert)."""
    items = tools.load_menu()
    count = 0
    for item in items:
        db.menuitem.upsert(
            where={"id": item["id"]},
            data={
                "create": {
                    "id": item["id"],
                    "name": item["name"],
                    "category": item["category"],
                    "price": item["price"],
                    "description": item["description"],
                    "available": item["available"],
                },
                "update": {
                    "name": item["name"],
                    "category": item["category"],
                    "price": item["price"],
                    "description": item["description"],
                    "available": item["available"],
                },
            },
        )
        count += 1
    return count


# ------------------------------------------------------------ admin bootstrap

def bootstrap_admin(db: Prisma) -> str:
    """Promote the configured admin email to the ``admin`` role.

    In production the promotion requires ``ADMIN_BOOTSTRAP_SECRET`` to be set
    (the header is not read from network input — the secret lives only in the
    environment). In development, promotion happens for the configured admin
    email regardless, so the seeded dev admin stays usable.
    """
    settings = get_settings()
    email = settings.admin_email.lower()
    if not email:
        return "no admin email configured"

    if settings.is_production and not settings.admin_bootstrap_secret:
        return "skipped (production requires ADMIN_BOOTSTRAP_SECRET)"

    user = db.user.find_first(where={"email": email})
    if user is None:
        for candidate in db.user.find_many():
            if (candidate.email or "").lower() == email:
                user = candidate
                break
    if user is None:
        return "admin user not found"
    if user.role == "admin":
        if settings.is_production:
            return f"{email} is already admin"
        if not user.passwordHash:
            from .auth_service import hash_password

            db.user.update(
                where={"id": user.id},
                data={"passwordHash": hash_password(settings.admin_dev_password)},
            )
            return f"{email} is already admin (dev password set)"
        return f"{email} is already admin"

    db.user.update(where={"id": user.id}, data={"role": "admin"})
    if not settings.is_production:
        from .auth_service import hash_password

        db.user.update(
            where={"id": user.id},
            data={"passwordHash": hash_password(settings.admin_dev_password)},
        )
        return f"promoted {email} to admin (dev password set)"
    return f"promoted {email} to admin"


# ------------------------------------------------------------------ customers

def list_customers(
    db: Prisma,
    search: str = "",
    status: str = "all",
    sort: str = "recent",
) -> list[dict]:
    """Rich customer list for the admin Customers view.

    ``status`` groups customers by engagement tier: ``all`` (everyone),
    ``active`` (ordered within the last 30 days), ``new`` (no orders yet).
    Sort modes: ``recent`` (newest signup first), ``spend`` (total revenue
    descending), ``points`` (loyalty points descending).
    """
    users = db.user.find_many(where={"role": "customer"}, include={"orders": True})
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=30)

    rows = []
    for u in users:
        orders = [o for o in u.orders if o.status != "cancelled"]
        last = max((o.createdAt for o in u.orders), default=None)
        total = round(sum(o.total for o in orders), 2)
        if search and not (
            (u.name and search.lower() in u.name.lower())
            or search.lower() in (u.email or "").lower()
            or (u.phone and search in u.phone)
        ):
            continue
        tier = "new" if not u.orders else ("active" if last and last >= cutoff else "returning")
        if status == "active" and tier != "active":
            continue
        if status == "new" and tier != "new":
            continue
        rows.append(
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "phone": u.phone,
                "imageUrl": u.imageUrl,
                "loyaltyPoints": u.loyaltyPoints,
                "referralCode": u.referralCode,
                "orderCount": len(orders),
                "totalSpend": total,
                "avgOrderValue": round(total / len(orders), 2) if orders else 0,
                "lastOrderAt": last.isoformat() if last else None,
                "createdAt": u.createdAt.isoformat(),
                "tier": tier,
            }
        )

    key = {"recent": lambda r: r["createdAt"], "spend": lambda r: r["totalSpend"], "points": lambda r: r["loyaltyPoints"]}.get(sort, lambda r: r["createdAt"])
    rows.sort(key=key, reverse=True)
    return rows


# --------------------------------------------------------------------- menu

def _menu_payload(item) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "category": item.category,
        "price": item.price,
        "description": item.description,
        "available": item.available,
        "imageUrl": item.imageUrl,
        "tags": _tags(item.tags),
        "featured": "featured" in _tags(item.tags),
        "calories": item.calories,
    }


def create_menu_item(db: Prisma, data: dict) -> dict:
    """Create a menu item, assigning the next free integer id (id is manual)."""
    rows = db.menuitem.find_many(order={"id": "desc"}, take=1)
    next_id = (rows[0].id + 1) if rows else 1

    tags = data.get("tags") or []
    if data.get("featured") and "featured" not in tags:
        tags = [*tags, "featured"]

    item = db.menuitem.create(
        data={
            "id": next_id,
            "name": data["name"],
            "category": data.get("category") or "Beverages",
            "price": data["price"],
            "description": data.get("description") or "",
            "available": data.get("available", True),
            "imageUrl": data.get("imageUrl") or None,
            "tags": json.dumps(tags),
        }
    )
    return _menu_payload(item)


def update_menu_item(db: Prisma, menu_item_id: int, data: dict) -> dict:
    """Update a menu item's editable fields (partial update by None values)."""
    current = db.menuitem.find_unique(where={"id": menu_item_id})
    if current is None:
        raise KeyError("Menu item not found")

    update: dict = {}
    if data.get("name") is not None:
        update["name"] = data["name"]
    if data.get("category") is not None:
        update["category"] = data["category"]
    if data.get("price") is not None:
        update["price"] = data["price"]
    if data.get("description") is not None:
        update["description"] = data["description"]
    if data.get("available") is not None:
        update["available"] = data["available"]
    if data.get("imageUrl") is not None:
        update["imageUrl"] = data["imageUrl"]
    if data.get("tags") is not None or data.get("featured") is not None:
        tags = list(_tags(current.tags))
        if data.get("featured") is True and "featured" not in tags:
            tags.append("featured")
        elif data.get("featured") is False and "featured" in tags:
            tags.remove("featured")
        if data.get("tags") is not None:
            tags = list(data["tags"])
        update["tags"] = json.dumps(tags)

    if not update:
        return _menu_payload(current)

    item = db.menuitem.update(where={"id": menu_item_id}, data=update)
    return _menu_payload(item)


def delete_menu_item(db: Prisma, menu_item_id: int) -> None:
    existing = db.menuitem.find_unique(where={"id": menu_item_id})
    if existing is None:
        raise KeyError("Menu item not found")
    db.menuitem.delete(where={"id": menu_item_id})


def _update_status(db: Prisma, order_id: str, status: str) -> dict:
    from . import order_service

    return order_service.update_order_status(db, order_id, status)
