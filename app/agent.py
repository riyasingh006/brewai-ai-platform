"""CoffeeShopAgent: a reusable, Gemini-powered chat agent.

This module only implements the agent itself (no tools, no web API yet).
Configuration (API key loading, validation, model resolution) lives in
``app.config`` and is reused here to keep concerns separated.
"""

from __future__ import annotations

import asyncio
import logging
import re

from google import genai
from google.genai import errors
from google.genai import types
from google.genai.chats import Chat

from . import config

logger = logging.getLogger(__name__)

_RETRYABLE_CODES = {"500", "503"}
_RETRYABLE_STATUS = {"INTERNAL", "UNAVAILABLE"}
_RETRY_HINT_RE = re.compile(r"retry in (\d+(?:\.\d+)?)s", re.IGNORECASE)
_MAX_ATTEMPTS = 3
_MAX_BACKOFF = 30.0


def _retry_delay(exc: errors.APIError, attempt: int) -> float:
    """Backoff for a rate-limited call, honoring the provider's own hint."""
    match = _RETRY_HINT_RE.search(str(exc))
    if match:
        return min(float(match.group(1)) + 0.5, _MAX_BACKOFF)
    return min(2.0 ** attempt, _MAX_BACKOFF)


class AgentError(RuntimeError):
    """Raised when the agent cannot fulfil a chat request."""


class CoffeeShopAgent:
    """A multi-turn chat agent backed by a Gemini model.

    The agent keeps a single chat session so follow-up questions keep the
    conversation context. Dependency injection (``client``/``model``) makes
    it easy to test or swap backends.
    """

    DEFAULT_SYSTEM_INSTRUCTION = (
        "You are BrewAI, an intelligent AI Barista. "
        "You are friendly, conversational, and helpful. "
        "You can answer general knowledge questions, casual conversations, "
        "coding questions, career questions, and everyday queries like ChatGPT. "
        "When the conversation is related to coffee, food, orders, or "
        "recommendations, act as an expert barista. "
        "Never force coffee into unrelated conversations. "
        "Maintain conversation history. Remember previous messages. "
        "Respond naturally. Use emojis occasionally. Be concise but helpful."
    )

    def __init__(
        self,
        client: genai.Client | None = None,
        model: str | None = None,
        system_instruction: str = DEFAULT_SYSTEM_INSTRUCTION,
        temperature: float = 0.7,
    ) -> None:
        # Resolve client and model from config (which loads/validates the key).
        try:
            self._client = client or config.get_client()
            self._model = model or config.get_model()
        except config.ConfigurationError as exc:
            logger.error("Agent initialization failed: %s", exc)
            raise AgentError(str(exc)) from exc

        self._system_instruction = system_instruction
        self._temperature = temperature
        self._session: Chat | None = None

    @property
    def model(self) -> str:
        """The Gemini model name this agent talks to."""
        return self._model

    def _create_session(self) -> Chat:
        """Create a chat session lazily (once) so history is kept."""
        if self._session is None:
            logger.info("Creating chat session with model %s", self._model)
            self._session = self._client.chats.create(
                model=self._model,
                config=types.GenerateContentConfig(
                    system_instruction=self._system_instruction,
                    temperature=self._temperature,
                ),
            )
        return self._session

    def chat(self, message: str) -> str:
        """Send a user message and return the assistant's reply text.

        Args:
            message: The customer's message.

        Returns:
            The model's reply as a plain string.

        Raises:
            AgentError: On invalid input, API errors, or empty/blocked replies.
        """
        if not message or not message.strip():
            raise AgentError("Message must be a non-empty string.")

        last_error: AgentError | None = None
        for model in config.get_model_candidates():
            try:
                if self._session is None:
                    self._session = self._client.chats.create(
                        model=model,
                        config=types.GenerateContentConfig(
                            system_instruction=self._system_instruction,
                            temperature=self._temperature,
                        ),
                    )
                logger.info("Sending message to model %s", model)
                response = self._session.send_message(message)
            except errors.APIError as exc:
                code, status = str(exc.code), str(exc.status)
                if code == "429" or status == "RESOURCE_EXHAUSTED":
                    logger.warning(
                        "Model %s quota exhausted; trying next candidate.", model
                    )
                    self._session = None
                    last_error = AgentError(
                        f"Gemini API error ({status}): {exc.message}"
                    )
                    continue
                # 4xx (client) and 5xx (server) errors surface here with code/status.
                logger.error(
                    "Gemini API error [%s %s] model=%s: %s",
                    code,
                    status,
                    model,
                    exc.message,
                    exc_info=True,
                )
                raise AgentError(
                    f"Gemini API error ({status}): {exc.message}"
                ) from exc
            except Exception as exc:  # noqa: BLE001 - surface any unexpected failure
                logger.exception("Unexpected error during chat.")
                raise AgentError(
                    "Unexpected error while talking to the Gemini API."
                ) from exc

            if not response or not response.text:
                # e.g. content blocked by safety filters or an empty candidate.
                logger.warning("Empty or blocked response from model %s.", model)
                self._session = None
                continue

            logger.info("Received response from model %s", model)
            return response.text

        raise last_error or AgentError("All configured models failed.")

    def reset(self) -> None:
        """Start a fresh conversation (drops the current session history)."""
        self._session = None
        logger.info("Chat session reset.")

    # --- Streaming (used by the web backend; additive, chat() is unchanged) ---

    async def stream_with_history(
        self,
        message: str,
        history: list[dict[str, object]] | None = None,
    ):
        """Stream a reply token-by-token given a prior conversation.

        Args:
            message: The customer's message.
            history: Prior turns as ``{"role": "user"|"model", "text": str}``.

        Yields:
            Incremental text chunks of the assistant's reply.

        Raises:
            AgentError: On invalid input, API errors, or empty replies.
        """
        if not message or not message.strip():
            raise AgentError("Message must be a non-empty string.")

        content_parts: list[object] = []
        for turn in history or []:
            role = "model" if str(turn.get("role")) == "assistant" else "user"
            text = turn.get("text")
            if text:
                content_parts.append(
                    types.Content(role=role, parts=[{"text": str(text)}])
                )

        aio_client = self._client.aio
        last_error: AgentError | None = None
        for model in config.get_model_candidates():
            logger.info("Streaming with model %s", model)
            full: list[str] = []
            for attempt in range(_MAX_ATTEMPTS):
                try:
                    chat = aio_client.chats.create(
                        model=model,
                        config=types.GenerateContentConfig(
                            system_instruction=self._system_instruction,
                            temperature=self._temperature,
                        ),
                        history=content_parts,
                    )
                    stream = await chat.send_message_stream(message)
                    async for chunk in stream:
                        if chunk is None or not chunk.text:
                            continue
                        full.append(chunk.text)
                        yield chunk.text
                    break
                except errors.APIError as exc:
                    code = str(exc.code)
                    status = str(exc.status)
                    if code == "429" or status == "RESOURCE_EXHAUSTED":
                        # Per-model quota: switch to the next candidate.
                        logger.warning(
                            "Model %s quota exhausted; trying next candidate.",
                            model,
                        )
                        last_error = AgentError(
                            f"Gemini API error ({status}): {exc.message}"
                        )
                        break
                    transient = (
                        code in _RETRYABLE_CODES or status in _RETRYABLE_STATUS
                    )
                    if not transient or full or attempt >= _MAX_ATTEMPTS - 1:
                        logger.error(
                            "Gemini streaming API error [%s %s] model=%s: %s",
                            code,
                            status,
                            model,
                            exc.message,
                            exc_info=True,
                        )
                        raise AgentError(
                            f"Gemini API error ({status}): {exc.message}"
                        ) from exc
                    delay = _retry_delay(exc, attempt + 1)
                    logger.warning(
                        "Gemini transient error [%s %s] model=%s; "
                        "retry %d/%d in %.1fs",
                        code,
                        status,
                        model,
                        attempt + 1,
                        _MAX_ATTEMPTS - 1,
                        delay,
                    )
                    await asyncio.sleep(delay)
                except Exception as exc:  # noqa: BLE001 - surface unexpected failures
                    logger.exception("Unexpected error during streaming chat.")
                    raise AgentError(
                        "Unexpected error while talking to the Gemini API."
                    ) from exc

            if not full:
                # Quota exhausted on this model, empty reply, or no chunks:
                # fall through to the next candidate.
                if last_error is not None:
                    continue
                logger.warning("Empty or blocked response while streaming.")
                last_error = AgentError(
                    "The model returned an empty or blocked response."
                )
                continue
            logger.info(
                "Streaming complete (model=%s): %d characters",
                model,
                sum(len(c) for c in full),
            )
            return

        raise last_error or AgentError("All configured models failed.")
