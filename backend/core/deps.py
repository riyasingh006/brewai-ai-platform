"""Shared FastAPI dependencies: authentication and authorization."""

from __future__ import annotations

import logging
import re

import jwt
from fastapi import Depends, Header, HTTPException, status

from ..db import get_db, run
from ..services import users as user_service
from .config import get_settings
from .security import DevAuthRequired, verify_clerk_token, verify_session_token

logger = logging.getLogger(__name__)

DEV_AUTH_HEADER = "x-dev-user"


def _resolve_bearer(token: str) -> dict[str, object] | None:
    """Verify a Bearer token as a first-party session JWT, then a Clerk JWT.

    Returns the claims dict, or ``None`` when the token is neither.
    """
    settings = get_settings()
    if settings.auth_secret:
        try:
            return verify_session_token(token)
        except jwt.InvalidTokenError:
            pass
    try:
        return verify_clerk_token(token)
    except jwt.InvalidTokenError:
        return None


async def get_current_user(
    authorization: str | None = Header(default=None),
    x_dev_user: str | None = Header(default=None),
) -> dict:
    """Resolve the authenticated user (first-party session, Clerk JWT or dev
    identity).

    The returned record always comes from the database, so ``role`` and
    loyalty data can never be spoofed through a header or token claim.
    """
    settings = get_settings()
    claims: dict[str, object] | None = None
    dev_email = None

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        claims = _resolve_bearer(token)
        if claims is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token.",
                headers={"WWW-Authenticate": "Bearer"},
            )
    elif x_dev_user:
        if settings.is_production:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Dev identity header is disabled in production.",
            )
        if settings.clerk_configured:
            logger.warning("Clerk configured but dev header used; ignoring header.")
        else:
            dev_email = x_dev_user.strip()
            if not dev_email or "@" not in dev_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="X-Dev-User must be a valid email address.",
                )
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    db = get_db()

    if claims is not None:
        sub = str(claims.get("sub") or "")
        email = str(claims.get("email") or "").lower() or None
        name = " ".join(
            str(claims.get(k) or "") for k in ("given_name", "family_name")
        ).strip() or None
        image = str(claims.get("picture") or "") or None
        if not sub:
            raise HTTPException(status_code=401, detail="Token missing 'sub' claim.")
        return await run(
            lambda: user_service.get_or_create_user(db, sub, email, name, image)
        )

    # Dev mode: stable id derived from the dev email. The display name is
    # set separately (via profile update on sign-up) — never derive it from
    # the email address.
    local = dev_email.split("@")[0]
    stable_id = "dev_" + re.sub(r"[^a-z0-9]", "_", local.lower())
    return await run(
        lambda: user_service.get_or_create_user(db, stable_id, dev_email, None)
    )


async def require_admin(current: dict = Depends(get_current_user)) -> dict:
    if current.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required.")
    return current


async def require_dashboard_access(current: dict = Depends(get_current_user)) -> dict:
    """Dashboard analytics access. Shop-wide analytics are admin-only; the
    dev-bypass was removed so customers can never read shop KPI data."""
    if current.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required.")
    return current


async def dev_user_required() -> None:
    """Raise when Clerk is required but dev-only identity is being used."""
    settings = get_settings()
    if not settings.clerk_configured and not settings.is_production:
        return
    raise DevAuthRequired("Auth provider must be configured.")
