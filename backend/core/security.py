"""Authentication & webhook security.

Production path verifies Clerk JWTs (RS256) using either the configured PEM
key (``CLERK_JWT_KEY``) or the issuer's JWKS endpoint (``CLERK_ISSUER``).

First-party path signs and verifies HS256 session JWTs (``AUTH_SECRET``) for
accounts that register/login with an email + password on this backend.

Development path: when Clerk is not configured and the app is not in
production, an explicit dev identity header is accepted so the full stack
runs without external accounts. Role is ALWAYS resolved from the database,
never from the token/header.
"""

from __future__ import annotations

import base64
import logging
import time

import httpx
import jwt
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from .config import get_settings

logger = logging.getLogger(__name__)

JWKS_TTL_SECONDS = 3600
_WEBHOOK_TOLERANCE_SECONDS = 300

_jwks_cache: dict[str, object] | None = None
_jwks_fetched_at = 0.0


def _fetch_jwks(issuer: str) -> dict[str, object]:
    """Fetch and cache the issuer's JWKS (refreshed hourly)."""
    global _jwks_cache, _jwks_fetched_at
    if _jwks_cache is not None and time.time() - _jwks_fetched_at < JWKS_TTL_SECONDS:
        return _jwks_cache  # type: ignore[return-value]
    url = f"{issuer.rstrip('/')}/.well-known/jwks.json"
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    _jwks_cache = resp.json()
    _jwks_fetched_at = time.time()
    return _jwks_cache


def verify_clerk_token(token: str) -> dict[str, object]:
    """Verify a Clerk-signed JWT and return its claims.

    Raises ``jwt.InvalidTokenError`` when the token is invalid/expired.
    """
    settings = get_settings()
    if settings.clerk_jwt_key:
        jwks = {"keys": [{"kty": "RSA", "use": "sig", "alg": "RS256", "kid": "clerk"}]}
        # A full PEM key string is easier to verify with PyJWT directly.
        return jwt.decode(
            token,
            settings.clerk_jwt_key,
            algorithms=["RS256"],
            issuer=settings.clerk_issuer or None,
        )

    issuer = settings.clerk_issuer
    if not issuer:
        raise jwt.InvalidTokenError("CLERK_ISSUER is not configured.")

    jwks_client = jwt.PyJWKClient(
        f"{issuer.rstrip('/')}/.well-known/jwks.json",
        cache_keys=True,
    )
    return jwt.decode(
        token,
        jwks_client.get_signing_key_from_jwt(token).key,
        algorithms=["RS256"],
        issuer=issuer,
    )


# ------------------------------------------------------- session JWTs (HS256)

def create_session_token(user_id: str, role: str) -> str:
    """Issue a first-party HS256 session JWT for the given user."""
    settings = get_settings()
    if not settings.auth_secret:
        raise RuntimeError("AUTH_SECRET is not configured.")
    now = int(time.time())
    return jwt.encode(
        {
            "sub": user_id,
            "role": role,
            "iat": now,
            "exp": now + settings.session_ttl_seconds,
        },
        settings.auth_secret,
        algorithm="HS256",
    )


def verify_session_token(token: str) -> dict[str, object]:
    """Verify a first-party HS256 session JWT and return its claims.

    Raises ``jwt.InvalidTokenError`` when the secret is missing, the token is
    invalid or it has expired.
    """
    settings = get_settings()
    if not settings.auth_secret:
        raise jwt.InvalidTokenError("AUTH_SECRET is not configured.")
    return jwt.decode(token, settings.auth_secret, algorithms=["HS256"])


def _decode_webhook_secret(secret: str) -> bytes:
    raw = secret.removeprefix("whsec_")
    return base64.b64decode(raw)


def verify_svix_webhook(headers: dict[str, str], body: bytes) -> bool:
    """Verify a Clerk webhook signed with Svix (Ed25519) headers."""
    secret = get_settings().clerk_webhook_secret
    if not secret:
        logger.warning("CLERK_WEBHOOK_SECRET is not set; webhook rejected.")
        return False

    svix_id = headers.get("svix-id")
    svix_ts = headers.get("svix-timestamp")
    svix_sig = headers.get("svix-signature")
    if not (svix_id and svix_ts and svix_sig):
        return False

    try:
        timestamp = int(svix_ts)
    except ValueError:
        return False
    if abs(time.time() - timestamp) > _WEBHOOK_TOLERANCE_SECONDS:
        logger.warning("Webhook timestamp outside tolerance window.")
        return False

    content = f"{svix_id}.{svix_ts}.".encode() + body
    try:
        public_key = Ed25519PublicKey.from_public_bytes(_decode_webhook_secret(secret))
    except Exception:  # noqa: BLE001 - malformed secret must not crash
        logger.exception("Malformed CLERK_WEBHOOK_SECRET.")
        return False

    for segment in svix_sig.split():
        if not segment.startswith("v1,"):
            continue
        try:
            signature = base64.b64decode(segment[3:])
        except Exception:  # noqa: BLE001
            continue
        try:
            public_key.verify(signature, content)
            return True
        except InvalidSignature:
            continue
    return False


class DevAuthRequired(RuntimeError):
    """Raised when dev-mode auth is requested but disabled in production."""
