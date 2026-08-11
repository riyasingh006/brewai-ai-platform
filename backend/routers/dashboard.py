"""Shop analytics endpoint backing the Dashboard view.

Serves one aggregated payload for the whole dashboard (KPI summary,
revenue series, top items, orders-by-time heatmap, order status and
customer analytics) so the frontend needs a single request per date range.
"""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from ..core.deps import require_dashboard_access
from ..db import get_db
from ..services import admin_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _resolve_window(period: str, start: str | None, end: str | None) -> tuple:
    """Compute the current and previous analytics windows from the period."""
    now = datetime.now(timezone.utc)
    today = now.date()
    min_t = time.min
    max_t = time.max

    if period == "today":
        start_dt = datetime.combine(today, min_t, tzinfo=timezone.utc)
        end_dt = now
        label = "Today"
    elif period == "yesterday":
        yday = today - timedelta(days=1)
        start_dt = datetime.combine(yday, min_t, tzinfo=timezone.utc)
        end_dt = datetime.combine(today, min_t, tzinfo=timezone.utc) - timedelta(microseconds=1)
        label = "Yesterday"
    elif period == "last_30":
        start_dt = datetime.combine(today - timedelta(days=29), min_t, tzinfo=timezone.utc)
        end_dt = now
        label = "Last 30 Days"
    elif period == "week":
        start_dt = datetime.combine(today - timedelta(days=today.weekday()), min_t, tzinfo=timezone.utc)
        end_dt = now
        label = "This Week"
    elif period == "month":
        start_dt = datetime.combine(today.replace(day=1), min_t, tzinfo=timezone.utc)
        end_dt = now
        label = "This Month"
    elif period == "custom":
        if not start or not end:
            raise ValueError("Custom range requires start and end.")
        s = datetime.strptime(start, "%Y-%m-%d").date()
        e = datetime.strptime(end, "%Y-%m-%d").date()
        if e < s:
            raise ValueError("End date cannot be before start date.")
        start_dt = datetime.combine(s, min_t, tzinfo=timezone.utc)
        end_dt = datetime.combine(e, max_t, tzinfo=timezone.utc)
        label = f"{s.strftime('%d %b')} - {e.strftime('%d %b')}"
    else:  # last_7 (default)
        start_dt = datetime.combine(today - timedelta(days=6), min_t, tzinfo=timezone.utc)
        end_dt = now
        label = "Last 7 Days"

    length = end_dt - start_dt
    prev_start = start_dt - length
    prev_end = start_dt - timedelta(microseconds=1)
    daily = length.days <= 31
    return start_dt, end_dt, prev_start, prev_end, label, daily


@router.get("/analytics")
async def analytics(
    period: str = Query(default="last_7"),
    start: str | None = Query(default=None),
    end: str | None = Query(default=None),
    current: dict = Depends(require_dashboard_access),
):
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
