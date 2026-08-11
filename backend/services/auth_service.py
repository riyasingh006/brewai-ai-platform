"""First-party authentication service: PBKDF2 password hashing and the
customer / admin register + login flows.

Passwords are hashed with PBKDF2-HMAC-SHA256 (stdlib only — no bcrypt/passlib
dependency) and stored on the User model as ``passwordHash``. Roles are never
chosen by the caller: normal registration is always ``customer``; only
/register-admin, gated by ``ADMIN_SECRET_KEY``, may create ``admin`` accounts.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import secrets
import uuid

from prisma import Prisma
from prisma.errors import UniqueViolationError

from backend.core.config import get_settings
from backend.core.security import create_session_token

from .users import _generate_referral_code, _serialize_user

logger = logging.getLogger(__name__)

_PBKDF2_ITERATIONS = 210_000


class AuthError(Exception):
    """Raised for login/registration failures with a user-safe message."""

    def __init__(self, message: str, status_code: int = 401):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    return (
        f"pbkdf2${_PBKDF2_ITERATIONS}$"
        f"{base64.b64encode(salt).decode()}$"
        f"{base64.b64encode(digest).decode()}"
    )


def verify_password(password: str, stored: str | None) -> bool:
    if not stored or not stored.startswith("pbkdf2$"):
        return False
    try:
        _, iterations_str, salt_b64, hash_b64 = stored.split("$", 3)
        iterations = int(iterations_str)
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
    except (ValueError, TypeError):
        return False
    actual = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, iterations
    )
    return hmac.compare_digest(actual, expected)


def _new_user_id() -> str:
    return "user_" + uuid.uuid4().hex[:24]


def register_customer(
    db: Prisma, email: str, name: str | None, password: str
) -> dict:
    """Create a customer account. Role is always forced to ``customer``."""
    if not password or len(password) < 8:
        raise AuthError("Password must be at least 8 characters.", 400)
    user_id = _new_user_id()
    try:
        user = db.user.create(
            data={
                "id": user_id,
                "email": email,
                "name": name,
                "passwordHash": hash_password(password),
                "role": "customer",
                "referralCode": _generate_referral_code(db),
            }
        )
    except UniqueViolationError:
        raise AuthError("An account with this email already exists.", 409)
    logger.info("Registered customer %s (%s)", user_id, email)
    return _auth_payload(user)


def register_admin(
    db: Prisma, email: str, name: str | None, password: str, admin_key: str
) -> dict:
    """Create an admin account, gated by ``ADMIN_SECRET_KEY``."""
    settings = get_settings()
    if not settings.admin_secret_key:
        raise AuthError(
            "Admin registration is not configured on this server.", 503
        )
    if not hmac.compare_digest(admin_key or "", settings.admin_secret_key):
        raise AuthError("Invalid admin registration key.", 401)
    if not password or len(password) < 8:
        raise AuthError("Password must be at least 8 characters.", 400)
    user_id = _new_user_id()
    try:
        user = db.user.create(
            data={
                "id": user_id,
                "email": email,
                "name": name,
                "passwordHash": hash_password(password),
                "role": "admin",
                "referralCode": _generate_referral_code(db),
            }
        )
    except UniqueViolationError:
        raise AuthError("An account with this email already exists.", 409)
    logger.info("Registered admin %s (%s)", user_id, email)
    return _auth_payload(user)


def login_user(db: Prisma, email: str, password: str) -> dict:
    """Customer login. Admin accounts are rejected so an admin can never get a
    customer-scoped session through the customer endpoint."""
    user = _find_by_email(db, email)
    if user is None or not verify_password(password, user.passwordHash):
        raise AuthError("Invalid email or password.")
    if user.role != "customer":
        raise AuthError(
            "This is an administrator account. Sign in through the Admin gateway.",
            status_code=403,
        )
    return _auth_payload(user)


def login_admin(db: Prisma, email: str, password: str, admin_key: str) -> dict:
    """Admin login. Requires the shop-owner ``ADMIN_SECRET_KEY`` in addition to
    valid credentials, and the account must have the admin role."""
    settings = get_settings()
    if not settings.admin_secret_key:
        raise AuthError("Admin sign-in is not configured on this server.", 503)
    if not hmac.compare_digest(admin_key or "", settings.admin_secret_key):
        raise AuthError("Invalid admin sign-in key.", 401)
    user = _find_by_email(db, email)
    if user is None or not verify_password(password, user.passwordHash):
        raise AuthError("Invalid admin email or password.")
    if user.role != "admin":
        raise AuthError(
            "You don't have administrator access.", status_code=403
        )
    return _auth_payload(user)


def _find_by_email(db: Prisma, email: str):
    return db.user.find_unique(where={"email": email.strip().lower()})


def _auth_payload(user) -> dict:
    return {
        "user": _serialize_user(user),
        "token": create_session_token(user.id, user.role),
    }
