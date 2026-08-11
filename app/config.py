"""Gemini configuration for the Coffee Shop AI Agent.

Loads the Gemini API key from the project's ``.env`` file, validates it, and
provides a reusable, thread-safe ``genai.Client`` singleton built with the
latest ``google-genai`` SDK.
"""

from __future__ import annotations

import logging
import os
import threading
from pathlib import Path

from dotenv import load_dotenv
from google import genai

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"

API_KEY_ENV_VAR = "GEMINI_API_KEY"
MODEL_ENV_VAR = "GEMINI_MODEL"
MODEL_FALLBACKS_ENV_VAR = "GEMINI_MODEL_FALLBACKS"

DEFAULT_MODEL = "gemini-3.5-flash"
# Per-model free-tier quotas are small and independent, so the agent tries
# these in order when the primary model is rate-limited (RESOURCE_EXHAUSTED).
DEFAULT_MODEL_FALLBACKS = (
    "gemini-3.6-flash",
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
)
API_KEY_PREFIX = "AIza"
PLACEHOLDER_MARKERS = (
    "your-key",
    "your-key-here",
    "your_api_key",
    "changeme",
    "xxxxx",
)

_client: genai.Client | None = None
_client_lock = threading.Lock()
_env_loaded = False

__all__ = [
    "API_KEY_ENV_VAR",
    "ConfigurationError",
    "check_api_connection",
    "close_client",
    "get_api_key",
    "get_client",
    "get_model",
    "get_model_candidates",
    "validate_api_key",
]


class ConfigurationError(RuntimeError):
    """Raised when required Gemini configuration is missing or invalid."""


def _configure_logging() -> None:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    )


def _load_env() -> None:
    """Load the project ``.env`` file into the environment, once."""
    global _env_loaded
    if _env_loaded:
        return
    _env_loaded = True
    if ENV_FILE.exists():
        load_dotenv(ENV_FILE, override=False)
        logger.info("Loaded environment file: %s", ENV_FILE)
    else:
        logger.warning(
            "No .env file found at %s. Falling back to environment variables.",
            ENV_FILE,
        )


_configure_logging()
_load_env()


def get_api_key() -> str:
    """Return the configured Gemini API key.

    Raises :class:`ConfigurationError` if it is not set.
    """
    key = os.getenv(API_KEY_ENV_VAR, "").strip()
    if not key:
        logger.error("Environment variable %s is not set.", API_KEY_ENV_VAR)
        raise ConfigurationError(
            f"Missing Gemini API key: set {API_KEY_ENV_VAR} in {ENV_FILE} "
            "or in the environment."
        )
    return key


def validate_api_key(api_key: str | None = None) -> str:
    """Validate and return the API key.

    Raises :class:`ConfigurationError` when the key is missing, empty, or a
    placeholder. Logs a warning when the key does not match Google's usual
    ``AIza...`` format.
    """
    key = (api_key or get_api_key()).strip()
    if not key:
        logger.error("Gemini API key is empty.")
        raise ConfigurationError("Gemini API key must not be empty.")

    lowered = key.lower()
    if any(marker in lowered for marker in PLACEHOLDER_MARKERS):
        logger.error("Gemini API key looks like a placeholder.")
        raise ConfigurationError(
            f"The value of {API_KEY_ENV_VAR} looks like a placeholder. "
            "Paste a real key from https://aistudio.google.com/apikey"
        )

    if not key.startswith(API_KEY_PREFIX):
        logger.warning(
            "Gemini API key does not start with '%s'. It may be invalid or a "
            "different credential type.",
            API_KEY_PREFIX,
        )

    logger.info("Gemini API key present and format-validated.")
    return key


def get_model() -> str:
    """Return the model name, overridable via ``GEMINI_MODEL`` or ``MODEL_NAME``."""
    return os.getenv(MODEL_ENV_VAR) or os.getenv("MODEL_NAME") or DEFAULT_MODEL


def get_model_candidates() -> list[str]:
    """Ordered list of models to try: the configured model first, then the
    fallback chain (deduplicated). ``GEMINI_MODEL_FALLBACKS`` overrides the
    built-in chain (comma-separated)."""
    primary = get_model()
    override = [
        m.strip()
        for m in os.getenv(MODEL_FALLBACKS_ENV_VAR, "").split(",")
        if m.strip()
    ]
    chain = override or list(DEFAULT_MODEL_FALLBACKS)
    ordered: list[str] = []
    for model in [primary, *chain]:
        if model and model not in ordered:
            ordered.append(model)
    return ordered


def get_client() -> genai.Client:
    """Return a reusable, thread-safe Gemini client (created lazily once)."""
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                api_key = validate_api_key()
                _client = genai.Client(
                    api_key=api_key,
                    vertexai=False,
                )
                logger.info(
                    "Created Google GenAI client (model=%s).", get_model()
                )
    return _client


def check_api_connection(model: str | None = None) -> bool:
    """Perform a lightweight live check that the API key is valid.

    Queries model metadata only (no content generation, no cost).
    """
    client = get_client()
    try:
        client.models.get(model=model or get_model())
        logger.info("Gemini API connection OK.")
        return True
    except Exception as exc:  # noqa: BLE001 - surface any provider error
        logger.error("Gemini API connection failed: %s", exc)
        return False


def close_client() -> None:
    """Close the cached client and release its resources."""
    global _client
    with _client_lock:
        if _client is not None:
            _client.close()
            _client = None
            logger.info("Closed Gemini client.")
