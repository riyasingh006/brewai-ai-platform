"""Admin dashboard endpoints (admin role required)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from ..core.deps import require_admin
from ..db import get_db
from ..schemas import MenuItemCreateRequest, MenuItemUpdateRequest, StatusUpdateRequest
from ..services import admin_service

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _http_error(exc: Exception, status: int = 400) -> HTTPException:
    return HTTPException(status_code=status, detail=str(exc))


@router.get("/summary")
async def summary():
    db = get_db()
    return await run_in_threadpool(lambda: admin_service.dashboard_summary(db))


@router.get("/dashboard")
async def dashboard(
    period: str = Query(default="last_7"),
    start: str | None = Query(default=None),
    end: str | None = Query(default=None),
):
    """Full admin dashboard payload (KPI summary, revenue series, top items,
    orders-by-time, order status, customer segments and recent orders)."""
    from .dashboard import _resolve_window

    try:
        start_dt, end_dt, prev_start, prev_end, label, daily = _resolve_window(period, start, end)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    db = get_db()
    return await run_in_threadpool(
        lambda: admin_service.dashboard_analytics(
            db, start_dt, end_dt, prev_start, prev_end, period, label, daily
        )
    )


@router.get("/revenue")
async def revenue(days: int = Query(default=14, ge=1, le=90)):
    db = get_db()
    return await run_in_threadpool(lambda: admin_service.revenue_series(db, days))


@router.get("/popular")
async def popular():
    db = get_db()
    return await run_in_threadpool(lambda: admin_service.popular_drinks(db))


@router.get("/inventory")
async def inventory():
    db = get_db()
    return await run_in_threadpool(lambda: admin_service.inventory(db))


@router.get("/peak-hours")
async def peak_hours():
    db = get_db()
    return await run_in_threadpool(lambda: admin_service.peak_hours(db))


@router.get("/customers")
async def customers(
    search: str = Query(default="", max_length=120),
    status: str = Query(default="all", pattern="^(all|active|new)$"),
    sort: str = Query(default="recent", pattern="^(recent|spend|points)$"),
):
    db = get_db()
    return await run_in_threadpool(lambda: admin_service.list_customers(db, search, status, sort))


@router.get("/coupons")
async def coupons():
    db = get_db()
    return await run_in_threadpool(lambda: admin_service.coupon_usage(db))


@router.get("/reviews")
async def reviews():
    db = get_db()
    return await run_in_threadpool(lambda: admin_service.recent_reviews(db))


@router.get("/orders")
async def orders():
    db = get_db()

    def _run():
        rows = db.order.find_many(order={"createdAt": "desc"}, take=100, include={"items": True, "user": True, "receipt": True})
        return [
            {
                "id": o.id,
                "orderNumber": o.orderNumber,
                "customer": o.user.email if o.user else None,
                "status": o.status,
                "paymentMethod": o.paymentMethod,
                "paymentStatus": o.paymentStatus,
                "total": o.total,
                "createdAt": o.createdAt.isoformat(),
                "itemCount": sum(i.quantity for i in o.items),
                "invoice": o.receipt.invoiceNumber if o.receipt else None,
            }
            for o in rows
        ]

    return await run_in_threadpool(_run)


@router.patch("/orders/{order_id}/status")
async def update_status(order_id: str, payload: StatusUpdateRequest):
    db = get_db()
    try:
        return await run_in_threadpool(lambda: admin_service._update_status(db, order_id, payload.status))
    except ValueError as exc:
        raise _http_error(exc) from exc


# ------------------------------------------------------------------- menu CRUD

@router.post("/menu")
async def create_menu_item(payload: MenuItemCreateRequest):
    db = get_db()
    try:
        return await run_in_threadpool(lambda: admin_service.create_menu_item(db, payload.model_dump()))
    except ValueError as exc:
        raise _http_error(exc) from exc


@router.patch("/menu/{menu_item_id}")
async def update_menu_item(menu_item_id: int, payload: MenuItemUpdateRequest):
    db = get_db()
    try:
        return await run_in_threadpool(lambda: admin_service.update_menu_item(db, menu_item_id, payload.model_dump()))
    except KeyError as exc:
        raise _http_error(exc, status=404) from exc
    except ValueError as exc:
        raise _http_error(exc) from exc


@router.delete("/menu/{menu_item_id}")
async def delete_menu_item(menu_item_id: int):
    db = get_db()
    try:
        await run_in_threadpool(lambda: admin_service.delete_menu_item(db, menu_item_id))
    except KeyError as exc:
        raise _http_error(exc, status=404) from exc
    return {"ok": True}


@router.post("/menu/import")
async def import_menu():
    """Sync the AI core menu (data/menu.json) into the database."""
    db = get_db()
    count = await run_in_threadpool(lambda: admin_service.import_menu_from_json(db))
    return {"imported": count}
