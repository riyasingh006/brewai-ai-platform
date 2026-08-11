"""Payment endpoints (sandbox provider behind the gateway abstraction)."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from starlette.concurrency import run_in_threadpool

from ..core.deps import get_current_user
from ..db import get_db
from ..schemas import ChargeRequest
from ..services import order_service
from ..services.payment_service import PaymentError, get_payment_provider

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.post("/charge")
async def charge(payload: ChargeRequest, current: dict = Depends(get_current_user)):
    """Charge an existing order and mark it paid on success."""
    db = get_db()
    try:
        order = await run_in_threadpool(lambda: order_service.get_order(db, payload.orderId, current["id"]))
    except (KeyError, PermissionError) as exc:
        status = 404 if isinstance(exc, KeyError) else 403
        raise HTTPException(status_code=status, detail=str(exc)) from exc

    if order["paymentStatus"] == "paid":
        return {"message": "Order already paid.", "order": order}

    provider = get_payment_provider()
    try:
        result = await run_in_threadpool(
            lambda: provider.charge(
                amount=order["total"],
                method=payload.method,
                reference=order["orderNumber"],
                details=payload.details,
            )
        )
    except PaymentError as exc:
        raise HTTPException(status_code=402, detail=str(exc)) from exc

    def _mark_paid():
        db.order.update(
            where={"id": order["id"]},
            data={"paymentStatus": "paid", "status": "confirmed"},
        )
        db.analyticsevent.create(
            data={
                "event": "order_status",
                "userId": current["id"],
                "payload": json.dumps({"orderNumber": order["orderNumber"], "status": "confirmed"}),
            }
        )
        return order_service.get_order(db, payload.orderId, current["id"])

    updated = await run_in_threadpool(_mark_paid)
    logger.info("Payment %s completed for order %s", result["id"], order["orderNumber"])
    return {"payment": result, "order": updated}
