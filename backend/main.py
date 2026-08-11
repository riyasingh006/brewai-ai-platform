"""FastAPI application entry point.

Run from the project root:

    uvicorn backend.main:app --reload --port 8000

The AI core (``app.agent`` / ``app.tools`` / ``app.config``) is reused
unchanged from the CLI package.
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.core.config import get_settings  # noqa: E402
from backend.db import connect, disconnect, get_db  # noqa: E402
from backend.routers import admin, auth, chat, coupons, dashboard, menu, orders, payments, users  # noqa: E402
from backend.services import admin_service  # noqa: E402

from starlette.concurrency import run_in_threadpool  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect()
    result = await run_in_threadpool(lambda: admin_service.bootstrap_admin(get_db()))
    logger.info("Admin bootstrap: %s", result)
    yield
    await disconnect()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="AI Barista Coffee API",
        version="1.0.0",
        description="Backend for the Coffee Shop AI Agent web app. Reuses the "
        "CLI's Gemini agent and menu tools unchanged.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.limiter = chat.limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    app.include_router(auth.router)
    app.include_router(chat.router)
    app.include_router(menu.router)
    app.include_router(orders.router)
    app.include_router(users.router)
    app.include_router(coupons.router)
    app.include_router(payments.router)
    app.include_router(admin.router)
    app.include_router(dashboard.router)

    receipts_dir = ROOT / "backend" / "receipts"
    receipts_dir.mkdir(exist_ok=True)

    @app.get("/api/receipts/{filename}")
    async def get_receipt(filename: str):
        safe = Path(filename).name
        path = receipts_dir / safe
        if not path.exists():
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Receipt not found.")
        return FileResponse(path, media_type="application/pdf", filename=safe)

    app.mount("/static", StaticFiles(directory=str(ROOT / "static")), name="static") if (ROOT / "static").exists() else None

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "provider": settings.payment_provider, "env": settings.env}

    return app


app = create_app()
