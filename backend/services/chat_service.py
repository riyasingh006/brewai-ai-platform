"""Chat service: routes messages through the AI core (unchanged) and
persists sessions/messages. Yields SSE events for streaming delivery.

The intent router in ``app.tools.menu_answer`` and the Gemini agent in
``app.agent`` are reused verbatim — no AI logic is modified here.
"""

from __future__ import annotations

import json
import logging
import re
import unicodedata
from typing import AsyncIterator

from prisma import Prisma

from app import tools
from app.agent import AgentError, CoffeeShopAgent

from .order_intents import handle_order_intent

logger = logging.getLogger(__name__)

_agent: CoffeeShopAgent | None = None


def get_agent() -> CoffeeShopAgent:
    global _agent
    if _agent is None:
        _agent = CoffeeShopAgent()
    return _agent


# ------------------------------------------------------------------ intents

_ORDER_TRIGGERS = (
    "order",
    "add to cart",
    "add to my order",
    "add it",
    "add this",
    "get me",
    "give me",
    "i'll take",
    "ill take",
    "i'll have",
    "ill have",
    "can i get",
    "can i have",
    "put me down for",
)

_QUANTITY_RE = re.compile(r"(?:^|\s)(\d+)\s*x?\s*(?:of\s+)?")
_WORD_NUMBERS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
}


def _quantity_near(message: str, name: str) -> int:
    """Best-effort quantity detection around a menu item name."""
    lowered = message.lower()
    idx = lowered.find(name.lower())
    if idx < 0:
        return 1
    before = lowered[max(0, idx - 12):idx]
    after = lowered[idx + len(name): idx + len(name) + 6]
    for chunk in (before, after):
        for word, num in _WORD_NUMBERS.items():
            if word in chunk:
                return num
    match = _QUANTITY_RE.search(before)
    if match:
        return int(match.group(1))
    match = re.search(r"x\s*(\d+)", after)
    if match:
        return int(match.group(1))
    return 1


def extract_order_draft(message: str) -> list[dict] | None:
    """Return orderable menu items mentioned in the message, or None."""
    lowered = message.lower()
    if not any(trigger in lowered for trigger in _ORDER_TRIGGERS):
        return None
    if lowered.strip().startswith(("menu", "reset", "help", "exit")):
        return None

    menu = tools.load_menu()
    draft: list[dict] = []
    for item in menu:
        name = tools._normalize(item["name"])
        if name and name in tools._normalize(message):
            draft.append(
                {
                    "menuItemId": item["id"],
                    "name": item["name"],
                    "price": item["price"],
                    "quantity": _quantity_near(message, item["name"]),
                    "customization": {},
                }
            )
    return draft or None


def _format_tool_items(items: list[dict], title: str) -> str:
    lines = [f"{title}:"]
    for item in items:
        flag = "" if item["available"] else " [SOLD OUT]"
        reason = item.get("reason")
        suffix = f" — {reason}" if reason else ""
        lines.append(f"- {item['name']} (${item['price']:.2f}){suffix}{flag}")
    return "\n".join(lines)


# --------------------------------------------------------------- persistence

def _get_session(db: Prisma, session_id: str, user_id: str) -> dict:
    session = db.chatsession.find_unique(where={"id": session_id})
    if session is None:
        session = db.chatsession.create(data={"id": session_id, "userId": user_id})
    elif session.userId != user_id:
        raise PermissionError("Chat session belongs to another user.")
    return session


def _history_for(db: Prisma, session_id: str) -> list[dict]:
    rows = db.chatmessage.find_many(
        where={"sessionId": session_id},
        order={"id": "asc"},
        take=40,
    )
    return [{"role": row.role, "text": row.content} for row in rows]


def list_sessions(db: Prisma, user_id: str) -> list[dict]:
    rows = db.chatsession.find_many(
        where={"userId": user_id}, order={"updatedAt": "desc"}, take=50
    )
    return [{"id": r.id, "title": r.title, "updatedAt": r.updatedAt.isoformat()} for r in rows]


def get_session_messages(db: Prisma, session_id: str, user_id: str) -> list[dict]:
    _get_session(db, session_id, user_id)
    rows = db.chatmessage.find_many(
        where={"sessionId": session_id}, order={"id": "asc"}
    )
    return [
        {
            "id": r.id,
            "role": r.role,
            "content": r.content,
            "toolName": r.toolName,
            "createdAt": r.createdAt.isoformat(),
        }
        for r in rows
    ]


def delete_session(db: Prisma, session_id: str, user_id: str) -> None:
    session = db.chatsession.find_unique(where={"id": session_id})
    if session is None or session.userId != user_id:
        return
    db.chatmessage.delete_many(where={"sessionId": session_id})
    db.chatsession.delete(where={"id": session_id})


def _save_message(
    db: Prisma,
    session_id: str,
    role: str,
    content: str,
    tool_name: str | None = None,
) -> None:
    db.chatmessage.create(
        data={
            "sessionId": session_id,
            "role": role,
            "content": content,
            "toolName": tool_name,
        }
    )


def _save_session_title(db: Prisma, session_id: str, message: str) -> None:
    title = unicodedata.normalize("NFKD", message)
    title = re.sub(r"[^\w\s-]", "", title).strip()
    db.chatsession.update(
        where={"id": session_id},
        data={"title": (title or "New chat")[:48]},
    )


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def run_chat(
    db: Prisma,
    *,
    user_id: str,
    session_id: str,
    message: str,
    weather: str | None = None,
    time_of_day: str | None = None,
    city: str | None = None,
) -> AsyncIterator[str]:
    """Stream the full chat turn as SSE lines."""
    message = message.strip()
    try:
        yield _sse("start", {"sessionId": session_id})
        session = _get_session(db, session_id, user_id)
        _save_message(db, session_id, "user", message)
        _save_session_title(db, session_id, message)

        # 1) Deterministic real-order handling (DB-backed cart/orders).
        order_result = handle_order_intent(db, user_id, message)
        if order_result is not None:
            text = order_result.get("text") or ""
            events = order_result.get("events") or []
            if events:
                for name, payload in events:
                    payload = dict(payload)
                    payload["text"] = text
                    yield _sse(name, payload)
            else:
                yield _sse("orderText", {"text": text})
            _save_message(db, session_id, "assistant", text, tool_name="Order")
            yield _sse(
                "done",
                {"sessionId": session_id, "replyKind": "order", "text": text},
            )
            return

        # 2) Deterministic menu answer (AI core logic, unchanged).
        answer = tools.menu_answer(message)
        if answer is not None:
            title, items, prompt = answer
            text = _format_tool_items(items, title)
            if prompt:
                text += f"\n\n{prompt}"
            _save_message(db, session_id, "assistant", text, tool_name=title)
            yield _sse(
                "tool",
                {"title": title, "items": items, "text": text, "prompt": prompt},
            )
            yield _sse(
                "done",
                {"sessionId": session_id, "replyKind": "tool", "text": text},
            )
            return

        # 3) Order intent detection for the right-hand order panel.
        draft = extract_order_draft(message)

        # 4) Gemini streaming.
        history = _history_for(db, session_id)
        if draft is not None:
            yield _sse(
                "order",
                {
                    "draft": draft,
                    "text": "I added those to your current order. Let me know "
                    "if you'd like to customize or checkout.",
                },
            )

        chunks: list[str] = []
        try:
            async for chunk in get_agent().stream_with_history(message, history):
                chunks.append(chunk)
                yield _sse("delta", {"text": chunk})
        except AgentError as exc:
            logger.exception("Chat streaming failed: %s", exc)
            fallback = (
                "Sorry — I'm having trouble reaching my barista brain right "
                "now. Please try again in a moment.\n\n"
            )
            # Development: surface the actual backend error so the root cause
            # is never hidden behind the generic fallback.
            fallback += f"Backend detail: {exc}"
            chunks.append(fallback)
            yield _sse("delta", {"text": fallback})
            yield _sse(
                "done",
                {"sessionId": session_id, "replyKind": "error", "text": fallback},
            )
            return

        full = "".join(chunks)
        _save_message(db, session_id, "assistant", full)
        yield _sse(
            "done",
            {"sessionId": session_id, "replyKind": "ai", "text": full},
        )
    except PermissionError as exc:
        yield _sse("error", {"message": str(exc)})
    except Exception as exc:  # noqa: BLE001 - keep the stream alive on errors
        logger.exception("Unexpected chat error.")
        yield _sse(
            "error",
            {"message": "Something went wrong processing your message."},
        )
