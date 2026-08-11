"""Cart and order endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from starlette.concurrency import run_in_threadpool

from ..core.deps import get_current_user
from ..db import get_db
from ..schemas import CartAddRequest, CartUpdateRequest, CheckoutRequest, ReviewRequest
from ..services import order_service
from ..services.coupon_service import award_referral_reward

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["orders"])


def _http_error(exc: Exception, status: int = 400) -> HTTPException:
    return HTTPException(status_code=status, detail=str(exc))


# -------------------------------------------------------------------- cart

@router.get("/cart")
async def get_cart(current: dict = Depends(get_current_user)):
    db = get_db()
    return await run_in_threadpool(lambda: order_service.get_cart(db, current["id"]))


@router.post("/cart")
async def add_cart(payload: CartAddRequest, current: dict = Depends(get_current_user)):
    db = get_db()
    try:
        return await run_in_threadpool(
            lambda: order_service.add_to_cart(
                db,
                current["id"],
                payload.menuItemId,
                payload.quantity,
                payload.customization.model_dump(exclude_none=True) if payload.customization else None,
            )
        )
    except ValueError as exc:
        raise _http_error(exc) from exc


@router.patch("/cart/{cart_item_id}")
async def patch_cart(cart_item_id: int, payload: CartUpdateRequest, current: dict = Depends(get_current_user)):
    db = get_db()
    try:
        return await run_in_threadpool(
            lambda: order_service.update_cart_item(
                db,
                cart_item_id,
                current["id"],
                quantity=payload.quantity,
                customization=payload.customization.model_dump(exclude_none=True) if payload.customization else None,
            )
        )
    except ValueError as exc:
        raise _http_error(exc) from exc


@router.delete("/cart/{cart_item_id}")
async def delete_cart_item(cart_item_id: int, current: dict = Depends(get_current_user)):
    db = get_db()
    await run_in_threadpool(lambda: order_service.remove_cart_item(db, cart_item_id, current["id"]))
    return {"ok": True}


@router.delete("/cart")
async def clear_cart(current: dict = Depends(get_current_user)):
    db = get_db()
    await run_in_threadpool(lambda: order_service.clear_cart(db, current["id"]))
    return {"ok": True}


# ------------------------------------------------------------------ orders

@router.get("/orders")
async def list_orders(current: dict = Depends(get_current_user)):
    db = get_db()
    return await run_in_threadpool(lambda: order_service.list_orders(db, current["id"]))


@router.get("/orders/{order_id}")
async def get_order(order_id: str, current: dict = Depends(get_current_user)):
    db = get_db()
    try:
        return await run_in_threadpool(lambda: order_service.get_order(db, order_id, current["id"]))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.post("/orders")
async def checkout(payload: CheckoutRequest, current: dict = Depends(get_current_user)):
    db = get_db()
    try:
        order = await run_in_threadpool(
            lambda: order_service.create_order(
                db,
                current["id"],
                payment_method=payload.paymentMethod,
                coupon_code=payload.couponCode,
                tip=payload.tip,
                notes=payload.notes,
            )
        )
        await run_in_threadpool(lambda: award_referral_reward(db, current["id"]))
        return order
    except ValueError as exc:
        raise _http_error(exc) from exc


@router.post("/orders/{order_id}/review")
async def review(order_id: str, payload: ReviewRequest, current: dict = Depends(get_current_user)):
    db = get_db()
    try:
        return await run_in_threadpool(
            lambda: order_service.submit_review(db, current["id"], order_id, payload.rating, payload.comment)
        )
    except (KeyError, PermissionError, ValueError) as exc:
        status = 404 if isinstance(exc, KeyError) else (403 if isinstance(exc, PermissionError) else 400)
        raise _http_error(exc, status) from exc
