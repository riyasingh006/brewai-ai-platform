"""Backend runtime configuration.

Reads the project-root ``.env`` file (shared with the CLI/Gemini config) and
exposes typed settings. Sensitive values are only read from the environment —
never logged.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_FILE = PROJECT_ROOT / ".env"

_env_loaded = False


def load_env() -> None:
    """Load the project-root ``.env`` exactly once (never overrides)."""
    global _env_loaded
    if _env_loaded:
        return
    _env_loaded = True
    if ENV_FILE.exists():
        load_dotenv(ENV_FILE, override=False)


def _get(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _get_list(name: str, default: list[str] | None = None) -> list[str]:
    raw = _get(name)
    if not raw:
        return default or []
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@dataclass(frozen=True)
class Settings:
    env: str = field(default_factory=lambda: _get("APP_ENV", "development"))
    database_url: str = field(
        default_factory=lambda: _get("DATABASE_URL", "file:./backend/prisma/dev.db")
    )

    # Clerk (production auth). In development without Clerk keys the backend
    # accepts an explicit dev identity (see core/security.py).
    clerk_secret_key: str = field(default_factory=lambda: _get("CLERK_SECRET_KEY"))
    clerk_jwt_key: str = field(default_factory=lambda: _get("CLERK_JWT_KEY"))
    clerk_issuer: str = field(default_factory=lambda: _get("CLERK_ISSUER"))
    clerk_webhook_secret: str = field(default_factory=lambda: _get("CLERK_WEBHOOK_SECRET"))

    frontend_url: str = field(default_factory=lambda: _get("FRONTEND_URL", "http://localhost:3000"))
    cors_origins: list[str] = field(
        default_factory=lambda: _get_list("CORS_ORIGINS") or ["http://localhost:3000"]
    )

    chat_rate_limit: str = field(default_factory=lambda: _get("CHAT_RATE_LIMIT", "30/minute"))
    payment_provider: str = field(default_factory=lambda: _get("PAYMENT_PROVIDER", "sandbox"))
    loyalty_points_per_order: int = field(
        default_factory=lambda: int(_get("LOYALTY_POINTS_PER_ORDER", "10"))
    )
    referral_reward_points: int = field(
        default_factory=lambda: int(_get("REFERRAL_REWARD_POINTS", "50"))
    )
    birthday_coupon_code: str = field(default_factory=lambda: _get("BIRTHDAY_COUPON_CODE", "BIRTHDAY20"))
    birthday_discount: int = field(default_factory=lambda: int(_get("BIRTHDAY_DISCOUNT", "20")))
    tax_rate: float = field(default_factory=lambda: float(_get("TAX_RATE", "0.05")))

    # Admin bootstrap. On startup the user matching ``admin_email`` is promoted
    # to ``admin`` when ``admin_bootstrap_secret`` matches (or always, when no
    # secret is configured and we are not in production). A secret is the only
    # way to bootstrap in production, mirroring the seed script's dev identity.
    admin_email: str = field(default_factory=lambda: _get("ADMIN_EMAIL", "admin@coffeeshop.local"))
    admin_bootstrap_secret: str = field(default_factory=lambda: _get("ADMIN_BOOTSTRAP_SECRET"))
    admin_dev_password: str = field(
        default_factory=lambda: _get("ADMIN_DEV_PASSWORD", "Admin@12345")
    )

    # First-party authentication. ``admin_secret_key`` gates admin account
    # creation (/api/auth/admin/register) and lives ONLY in the server
    # environment — never in frontend code or API responses. ``auth_secret``
    # signs the session JWTs issued at login; both are required for the
    # password flows and are shared with the frontend middleware for
    # server-side route protection (never exposed to the browser).
    admin_secret_key: str = field(default_factory=lambda: _get("ADMIN_SECRET_KEY"))
    auth_secret: str = field(default_factory=lambda: _get("AUTH_SECRET"))
    session_ttl_seconds: int = field(
        default_factory=lambda: int(_get("SESSION_TTL_SECONDS", "604800"))
    )

    @property
    def is_production(self) -> bool:
        return self.env.lower() == "production"

    @property
    def clerk_configured(self) -> bool:
        return bool(self.clerk_secret_key or self.clerk_jwt_key or self.clerk_issuer)


def get_settings() -> Settings:
    """Return the cached application settings."""
    load_env()
    return Settings()
