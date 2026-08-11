"""Menu endpoints: browsing, search, trending, and personalized picks."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from app import tools
from ..core.deps import get_current_user
from ..db import get_db
from ..services import admin_service, recommendations, users as user_service

router = APIRouter(prefix="/api/menu", tags=["menu"])

CATEGORY_LABELS = [
    "Coffee",
    "Cold Coffee",
    "Tea",
    "Sandwiches",
    "Cake",
    "Cookies",
    "Desserts",
    "Seasonal Drinks",
]


def _menu_from_db():
    db = get_db()
    rows = db.menuitem.find_many(order={"id": "asc"})
    if rows:
        return [user_service._serialize_menu_item(row) for row in rows]
    # Fall back to the AI core JSON menu if the DB is not seeded yet.
    return tools.get_full_menu()


@router.get("")
async def get_menu(current: dict = Depends(get_current_user)):
    return await run_in_threadpool(_menu_from_db)


@router.get("/categories")
async def get_categories(current: dict = Depends(get_current_user)):
    items = await run_in_threadpool(_menu_from_db)
    seen = []
    for item in items:
        if item["category"] not in seen:
            seen.append(item["category"])
    # Append the display-friendly labels that don't exist as real categories.
    for label in CATEGORY_LABELS:
        if label not in seen:
            seen.append(label)
    return seen


@router.get("/search")
async def search_menu(
    q: str = Query(default="", max_length=120),
    category: str | None = Query(default=None, max_length=60),
    tag: str | None = Query(default=None, max_length=30),
    current: dict = Depends(get_current_user),
):
    items = await run_in_threadpool(_menu_from_db)

    query = q.strip().lower()
    if query:
        items = [i for i in items if query in i["name"].lower() or query in i["description"].lower()]

    if category and category not in ("All", "all", ""):
        items = [i for i in items if i["category"].lower() == category.lower()]

    if tag and tag.lower() in ("popular", "new", "trending", "seasonal"):
        items = [i for i in items if tag.lower() in (t.lower() for t in i.get("tags", []))]

    return {"items": items, "count": len(items)}


@router.get("/trending")
async def trending(current: dict = Depends(get_current_user)):
    """Trending = popular tags first, then best sellers from order history."""
    db = get_db()
    items = await run_in_threadpool(_menu_from_db)
    popular = [i for i in items if "popular" in (t.lower() for t in i.get("tags", []))]
    fresh = [i for i in items if "new" in (t.lower() for t in i.get("tags", []))]

    def _sellers():
        return admin_service.popular_drinks(db, limit=8)

    sellers = await run_in_threadpool(_sellers)
    seller_names = {s["name"] for s in sellers}
    best = [i for i in items if i["name"] in seller_names]
    return {"popular": popular[:8], "new": fresh[:8], "bestSellers": best[:8]}


@router.get("/recommendations")
async def recommendations_route(
    weather: str | None = Query(default=None, max_length=80),
    timeOfDay: str | None = Query(default=None, max_length=80),
    current: dict = Depends(get_current_user),
):
    db = get_db()

    def _run():
        return recommendations.recommend_for_user(
            db,
            current["id"],
            weather=weather,
            time_of_day=timeOfDay,
        )

    return await run_in_threadpool(_run)


@router.get("/favorites")
async def favorites(current: dict = Depends(get_current_user)):
    db = get_db()

    def _run():
        return user_service.list_favorites(db, current["id"])

    return await run_in_threadpool(_run)
