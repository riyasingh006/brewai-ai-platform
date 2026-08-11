"""Chat endpoints: sessions management and streaming conversations."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..core.deps import get_current_user
from ..db import get_db, run
from ..schemas import ChatRequest, NewSessionRequest
from ..services import chat_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])
limiter = Limiter(key_func=get_remote_address)


def _sse_response(iterator):
    return StreamingResponse(
        iterator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/sessions")
async def list_sessions(current: dict = Depends(get_current_user)):
    db = get_db()
    return await run(lambda: chat_service.list_sessions(db, current["id"]))


@router.post("/sessions")
async def create_session(payload: NewSessionRequest, current: dict = Depends(get_current_user)):
    db = get_db()
    session_id = uuid.uuid4().hex[:24]

    def _create():
        return db.chatsession.create(
            data={
                "id": session_id,
                "userId": current["id"],
                "title": (payload.title or "New chat")[:80],
            }
        )

    await run(_create)
    return {"id": session_id, "title": payload.title or "New chat"}


@router.get("/sessions/{session_id}/messages")
async def session_messages(session_id: str, current: dict = Depends(get_current_user)):
    db = get_db()
    try:
        return await run(lambda: chat_service.get_session_messages(db, session_id, current["id"]))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current: dict = Depends(get_current_user)):
    db = get_db()
    await run(lambda: chat_service.delete_session(db, session_id, current["id"]))
    return {"ok": True}


@router.post("")
@limiter.limit("30/minute")
async def chat(request: Request, payload: ChatRequest, current: dict = Depends(get_current_user)):
    """Stream a chat turn as server-sent events."""
    db = get_db()
    session_id = payload.sessionId or uuid.uuid4().hex[:24]

    async def stream():
        async for line in chat_service.run_chat(
            db,
            user_id=current["id"],
            session_id=session_id,
            message=payload.message,
            weather=payload.weather,
            time_of_day=payload.timeOfDay,
            city=payload.city,
        ):
            yield line

    return _sse_response(stream())
