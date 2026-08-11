"""Auth endpoints: first-party register/login, Clerk webhook sync and auth
status."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from starlette.concurrency import run_in_threadpool

from ..core.deps import get_current_user
from ..core.security import verify_svix_webhook
from ..db import get_db
from ..services import auth_service, users as user_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=100)

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, value: str) -> str:
        email = value.strip().lower()
        if (
            "@" not in email
            or email.count("@") != 1
            or not email.split("@")[0]
            or "." not in email.split("@")[1]
        ):
            raise ValueError("Enter a valid email address.")
        return email


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, value: str) -> str:
        email = value.strip().lower()
        if "@" not in email or email.count("@") != 1 or not email.split("@")[0]:
            raise ValueError("Enter a valid email address.")
        return email


class AdminLoginRequest(LoginRequest):
    """Admin sign-in always requires the shop-owner ``adminKey`` alongside
    credentials — the client never calls this endpoint without one."""

    adminKey: str = Field(min_length=1, max_length=128)


class AdminRegisterRequest(RegisterRequest):
    adminKey: str


def _auth_response(result: dict) -> dict:
    return {
        "user": result["user"],
        "token": result["token"],
        "tokenType": "bearer",
    }


@router.post("/register", status_code=201)
async def register(body: RegisterRequest):
    """Create a customer account (role is always forced to ``customer``)."""
    db = get_db()
    try:
        result = await run_in_threadpool(
            auth_service.register_customer,
            db,
            body.email.lower(),
            body.name,
            body.password,
        )
    except auth_service.AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return _auth_response(result)


@router.post("/login")
async def login(body: LoginRequest):
    """Sign in as a customer. Admin accounts are rejected (403) so admin
    sessions can only be issued through the admin login endpoint."""
    db = get_db()
    try:
        result = await run_in_threadpool(
            auth_service.login_user, db, body.email.lower(), body.password
        )
    except auth_service.AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return _auth_response(result)


@router.post("/admin/register", status_code=201)
async def admin_register(body: AdminRegisterRequest):
    """Create an admin account. Gated by the server-side ``ADMIN_SECRET_KEY``."""
    db = get_db()
    try:
        result = await run_in_threadpool(
            auth_service.register_admin,
            db,
            body.email.lower(),
            body.name,
            body.password,
            body.adminKey,
        )
    except auth_service.AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return _auth_response(result)


@router.post("/admin/login")
async def admin_login(body: AdminLoginRequest):
    """Sign in as an admin. Requires the shop-owner admin key in addition to
    valid credentials; non-admins get ``You don't have administrator
    access.`` (403) so the client can redirect them to the customer area."""
    db = get_db()
    try:
        result = await run_in_threadpool(
            auth_service.login_admin,
            db,
            body.email.lower(),
            body.password,
            body.adminKey,
        )
    except auth_service.AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return _auth_response(result)


def _primary_email(user: dict) -> str | None:
    addresses = user.get("email_addresses") or []
    for addr in addresses:
        if addr.get("id") == user.get("primary_email_address_id") or addr.get("verification", {}).get("status") == "verified":
            return (addr.get("email_address") or "").lower() or None
    if addresses:
        return (addresses[0].get("email_address") or "").lower() or None
    return None


def _display_name(user: dict) -> str | None:
    first = user.get("first_name") or ""
    last = user.get("last_name") or ""
    name = f"{first} {last}".strip()
    return name or None


@router.post("/webhook")
async def clerk_webhook(request: Request):
    """Receive Clerk user events and mirror them into the database."""
    body = await request.body()
    svix_id = request.headers.get("svix-id")
    svix_ts = request.headers.get("svix-timestamp")
    svix_sig = request.headers.get("svix-signature")

    headers = {
        "svix-id": svix_id or "",
        "svix-timestamp": svix_ts or "",
        "svix-signature": svix_sig or "",
    }
    if not verify_svix_webhook(headers, body):
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")

    import json

    event = json.loads(body)
    event_type = event.get("type", "")
    data = event.get("data", {})
    user_id = str(data.get("id") or "")

    if not user_id:
        raise HTTPException(status_code=400, detail="Webhook payload missing user id.")

    db = get_db()

    if event_type in ("user.created", "user.updated"):
        email = _primary_email(data)
        name = _display_name(data)
        image = data.get("image_url") or None

        def _upsert():
            existing = db.user.find_unique(where={"id": user_id})
            if existing is None:
                db.user.create(
                    data={
                        "id": user_id,
                        "email": email or f"{user_id}@clerk.local",
                        "name": name,
                        "imageUrl": image,
                        "referralCode": user_service._generate_referral_code(db),
                    }
                )
            else:
                update: dict = {}
                if email:
                    update["email"] = email
                if name:
                    update["name"] = name
                if image:
                    update["imageUrl"] = image
                if update:
                    db.user.update(where={"id": user_id}, data=update)

        await run_in_threadpool(_upsert)
        logger.info("Clerk webhook %s for %s", event_type, user_id)

    elif event_type == "user.deleted":
        def _delete():
            db.user.delete_many(where={"id": user_id})

        await run_in_threadpool(_delete)

    return {"received": event_type}


@router.get("/status")
async def auth_status():
    """Report whether a real auth provider is configured (for the UI)."""
    from ..core.config import get_settings

    settings = get_settings()
    return {
        "provider": "clerk" if settings.clerk_configured else "dev",
        "configured": settings.clerk_configured,
        "production": settings.is_production,
    }


@router.get("/me")
async def me(current: dict = Depends(get_current_user)):
    return current
