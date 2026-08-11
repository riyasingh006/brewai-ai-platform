"""Personalized recommendations.

Combines the deterministic AI logic from ``app.tools`` (weather/time based
picks) with per-user signals: favorites, past orders, and active festivals.
The core routing logic in ``app/tools.py`` is reused unchanged.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime

from prisma import Prisma

from app import tools  # reused verbatim from the AI core

_FESTIVAL_THEME_CATEGORY_HINTS = {
    "christmas": ("Coffee", "Desserts", "Tea"),
    "diwali": ("Desserts", "Frappes", "Tea"),
    "halloween": ("Coffee", "Desserts", "Frappes"),
    "summer": ("Cold Coffee", "Frappes", "Refreshers", "Smoothies"),
    "monsoon": ("Coffee", "Tea"),
    "new year": ("Frappes", "Coffee", "Desserts"),
}


def _category_from_theme(theme: str) -> tuple[str, ...] | None:
    if not theme:
        return None
    for key, cats in _FESTIVAL_THEME_CATEGORY_HINTS.items():
        if key in theme.lower():
            return cats
    return None


def _user_history_terms(db: Prisma, user_id: str) -> tuple[Counter, Counter]:
    favorites = db.favorite.find_many(
        where={"userId": user_id}, include={"menuItem": True}
    )
    favorite_names = Counter(fav.menuItem.name for fav in favorites)

    orders = db.order.find_many(
        where={"userId": user_id, "status": "completed"},
        include={"items": True},
        take=50,
    )
    ordered_names = Counter(
        item.name for order in orders for item in order.items if item.name
    )
    return favorite_names, ordered_names


def recommend_for_user(
    db: Prisma,
    user_id: str,
    *,
    weather: str | None = None,
    time_of_day: str | None = None,
    limit: int = 6,
) -> dict:
    """Return personalized picks with the reason they were chosen."""
    favorite_names, ordered_names = _user_history_terms(db, user_id)

    candidates: dict[int, dict] = {}

    def add_from(items: list[dict], base: int) -> None:
        for item in items:
            entry = candidates.setdefault(
                item["id"], {"item": item, "score": base, "tags": []}
            )
            entry["score"] = max(entry["score"], base)

    # Weather picks (if a weather context was provided).
    if weather:
        normalized = weather.lower()
        if any(w in normalized for w in ("hot", "sunny", "warm", "summer")):
            add_from(tools.recommend_drink("hot"), 10)
        elif any(w in normalized for w in ("cold", "rain", "chilly", "winter")):
            add_from(tools.recommend_drink("cold"), 10)
        else:
            add_from(tools.recommend_drink("any"), 5)

    # Time-of-day food picks.
    if time_of_day:
        try:
            add_from(tools.recommend_food(time_of_day), 8)
        except ValueError:
            pass

    # Fall back to barista's favorites if nothing matched yet.
    if not candidates:
        add_from(tools.recommend_drink("favorite"), 6)
        try:
            add_from(tools.recommend_food("any"), 4)
        except ValueError:
            pass

    # Festival boost.
    now = datetime.utcnow()
    active = db.festival.find_many(
        where={"startsAt": {"lte": now}, "endsAt": {"gte": now}}
    )
    boosted_categories: set[str] = set()
    festival_label = None
    for fest in active:
        cats = _category_from_theme(fest.theme or fest.name)
        if cats:
            boosted_categories.update(cats)
            festival_label = festival_label or f"{fest.emoji} {fest.name}"

    # Personalization scoring.
    for entry in candidates.values():
        item = entry["item"]
        if favorite_names[item["name"]]:
            entry["score"] += 5
            entry["tags"].append("favorite")
        if ordered_names[item["name"]]:
            entry["score"] += 3
            entry["tags"].append("try again")
        if item["category"] in boosted_categories:
            entry["score"] += 2
            entry["tags"].append("festival")

    ranked = sorted(candidates.values(), key=lambda e: -e["score"])[:limit]
    items = [{"item": e["item"], "tags": e["tags"]} for e in ranked]
    return {"items": items, "festival": festival_label}
