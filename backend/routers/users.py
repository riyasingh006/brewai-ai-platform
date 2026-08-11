"""User profile endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from starlette.concurrency import run_in_threadpool

from ..core.deps import get_current_user
from ..db import get_db
from ..schemas import AddressPayload, CardPayload, ProfileUpdateRequest
from ..services import users as user_service

router = APIRouter(prefix="/api/me", tags=["users"])


@router.get("")
async def profile(current: dict = Depends(get_current_user)):
    db = get_db()
    try:
        return await run_in_threadpool(lambda: user_service.get_profile(db, current["id"]))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("")
async def update_profile(payload: ProfileUpdateRequest, current: dict = Depends(get_current_user)):
    db = get_db()
    return await run_in_threadpool(
        lambda: user_service.update_profile(
            db,
            current["id"],
            name=payload.name,
            phone=payload.phone,
            birthday=payload.birthday,
            image_url=payload.imageUrl,
        )
    )


# -------------------------------------------------------------- favorites

@router.post("/favorites/{menu_item_id}")
async def add_favorite(menu_item_id: int, current: dict = Depends(get_current_user)):
    db = get_db()
    return await run_in_threadpool(lambda: user_service.add_favorite(db, current["id"], menu_item_id))


@router.delete("/favorites/{menu_item_id}")
async def remove_favorite(menu_item_id: int, current: dict = Depends(get_current_user)):
    db = get_db()
    return await run_in_threadpool(lambda: user_service.remove_favorite(db, current["id"], menu_item_id))


# -------------------------------------------------------------- addresses

@router.post("/addresses")
async def create_address(payload: AddressPayload, current: dict = Depends(get_current_user)):
    db = get_db()
    return await run_in_threadpool(lambda: user_service.create_address(db, current["id"], payload.model_dump()))


@router.delete("/addresses/{address_id}")
async def delete_address(address_id: int, current: dict = Depends(get_current_user)):
    db = get_db()
    await run_in_threadpool(lambda: user_service.delete_address(db, address_id))
    return {"ok": True}


# ------------------------------------------------------------------ cards

@router.post("/cards")
async def create_card(payload: CardPayload, current: dict = Depends(get_current_user)):
    db = get_db()
    return await run_in_threadpool(lambda: user_service.create_card(db, current["id"], payload.model_dump()))


@router.delete("/cards/{card_id}")
async def delete_card(card_id: int, current: dict = Depends(get_current_user)):
    db = get_db()
    await run_in_threadpool(lambda: user_service.delete_card(db, card_id))
    return {"ok": True}


# ----------------------------------------------------------------- loyalty

@router.get("/dashboard")
async def dashboard(current: dict = Depends(get_current_user)):
    """Personal dashboard: loyalty tier, stats, active and recent orders."""
    db = get_db()
    try:
        return await run_in_threadpool(lambda: user_service.customer_dashboard(db, current["id"]))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/loyalty")
async def loyalty(current: dict = Depends(get_current_user)):
    db = get_db()

    def _run():
        user = db.user.find_unique(where={"id": current["id"]})
        return {
            "points": user.loyaltyPoints if user else 0,
            "referralCode": user.referralCode if user else None,
            "rewardsPerOrder": 10,
            "referralReward": 50,
        }

    return await run_in_threadpool(_run)
