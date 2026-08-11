"""Coupon endpoints: available coupons, validation, and festival offers."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from starlette.concurrency import run_in_threadpool

from ..core.deps import get_current_user
from ..db import get_db
from ..services import coupon_service

router = APIRouter(prefix="/api/coupons", tags=["coupons"])


@router.get("")
async def available(current: dict = Depends(get_current_user)):
    db = get_db()
    return await run_in_threadpool(lambda: coupon_service.list_available(db, current["id"]))


@router.get("/validate")
async def validate(
    code: str = Query(min_length=2, max_length=40),
    subtotal: float = Query(ge=0),
    current: dict = Depends(get_current_user),
):
    db = get_db()

    def _run():
        discount, normalized = coupon_service.apply_coupon(db, current["id"], code, subtotal)
        return {"code": normalized, "discount": discount, "valid": discount > 0}

    return await run_in_threadpool(_run)


@router.get("/festivals")
async def festivals(current: dict = Depends(get_current_user)):
    db = get_db()
    return await run_in_threadpool(lambda: coupon_service.festival_offers(db))
