"""Prisma client lifecycle.

The generated client is sync-only, so all database calls from async
endpoints are dispatched through a thread pool (``run_in_threadpool``) to
keep the event loop responsive.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import TypeVar, Callable

from prisma import Prisma
from starlette.concurrency import run_in_threadpool

from backend.core.config import get_settings

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

_client: Prisma | None = None
_connected = False


def datasource_override() -> dict[str, str] | None:
    """Return an absolute SQLite datasource URL override, if needed.

    The Prisma 5.x Rust engine resolves a relative ``file:`` URL against the
    ``source_file_path`` embedded in the generated client. The generator mangles
    that path on non-ASCII Windows folders, so we pass an absolute URL and let
    the engine skip path resolution entirely. Non-``file:`` URLs (Postgres in
    production) need no override.
    """
    url = get_settings().database_url
    if not url.startswith("file:"):
        return None
    rel = url[len("file:") :].lstrip("/")
    abs_path = Path(rel) if Path(rel).is_absolute() else PROJECT_ROOT / rel
    return {"url": "file:" + str(abs_path.resolve()).replace("\\", "/")}


def get_db() -> Prisma:
    """Return the shared Prisma client, creating it on first use."""
    global _client
    if _client is None:
        override = datasource_override()
        if override is not None:
            _client = Prisma(auto_register=True, datasource=override)
        else:
            _client = Prisma(auto_register=True)
    return _client


async def connect() -> None:
    global _connected
    if _connected:
        return
    client = get_db()
    await run_in_threadpool(client.connect)
    _connected = True
    logger.info("Database connected (provider=sqlite/dev or postgres/prod).")


async def disconnect() -> None:
    global _connected, _client
    if _client is not None and _connected:
        await run_in_threadpool(_client.disconnect)
        _client = None
        _connected = False
        logger.info("Database disconnected.")


T = TypeVar("T")


async def run(fn: Callable[[], T]) -> T:
    """Run a synchronous Prisma call in a thread pool."""
    return await run_in_threadpool(fn)
