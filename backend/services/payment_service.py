"""Payment service: gateway-ready provider abstraction.

A single interface (``PaymentProvider``) sits in front of checkout so real
gateways (Stripe, Razorpay, UPI via aggregators) can be dropped in without
touching the order flow. The default ``SandboxPaymentProvider`` simulates a
successful/failed charge so the entire funnel works end-to-end without keys.
"""

from __future__ import annotations

import logging
import random
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from ..core.config import get_settings

logger = logging.getLogger(__name__)

SUPPORTED_METHODS = ("upi", "card", "cash", "wallet")


class PaymentError(RuntimeError):
    """Raised when a payment cannot be completed."""


class PaymentProvider(ABC):
    name: str = "base"

    @abstractmethod
    def charge(self, *, amount: float, method: str, reference: str, details: dict | None = None) -> dict:
        """Charge an amount; returns a normalized payment result."""

    @abstractmethod
    def refund(self, *, payment_id: str) -> dict:
        """Reverse a previously captured payment."""


class SandboxPaymentProvider(PaymentProvider):
    """Deterministic, offline payment simulator.

    Charges fail only when the amount is exactly 0 (defensive) or when the
    method is unsupported. Everything else succeeds instantly so the order
    funnel is fully exercisable.
    """

    name = "sandbox"

    def charge(self, *, amount: float, method: str, reference: str, details: dict | None = None) -> dict:
        if method not in SUPPORTED_METHODS:
            raise PaymentError(f"Unsupported payment method: {method}")
        if amount <= 0:
            raise PaymentError("Payment amount must be positive.")
        payment_id = f"sndbx_{uuid.uuid4().hex[:16]}"
        logger.info("[sandbox] charge $%.2f via %s (%s)", amount, method, reference)
        return {
            "id": payment_id,
            "provider": self.name,
            "method": method,
            "amount": round(amount, 2),
            "currency": "INR",
            "status": "paid",
            "reference": reference,
            "txnId": f"TXN-{uuid.uuid4().hex[:10].upper()}",
            "paidAt": datetime.now(timezone.utc).isoformat(),
        }

    def refund(self, *, payment_id: str) -> dict:
        logger.info("[sandbox] refund %s", payment_id)
        return {"id": payment_id, "status": "refunded", "refundedAt": datetime.now(timezone.utc).isoformat()}


class StripeLikeProvider(PaymentProvider):
    """Reference shape for a real gateway integration.

    Wire this to your gateway SDK when keys are available. It intentionally
    raises PaymentError until configured, so production never silently
    accepts money.
    """

    name = "stripe-like"

    def __init__(self, secret_key: str | None = None) -> None:
        self._secret_key = secret_key

    def _ensure_ready(self) -> None:
        if not self._secret_key:
            raise PaymentError(
                f"{self.name} provider is not configured. Set its API key "
                "or switch PAYMENT_PROVIDER back to 'sandbox'."
            )

    def charge(self, *, amount: float, method: str, reference: str, details: dict | None = None) -> dict:
        self._ensure_ready()
        # Real implementation: gateway.PaymentIntents.create(amount=..., ...)
        raise NotImplementedError("Wire your gateway SDK here.")

    def refund(self, *, payment_id: str) -> dict:
        self._ensure_ready()
        raise NotImplementedError("Wire your gateway SDK here.")


def get_payment_provider() -> PaymentProvider:
    settings = get_settings()
    if settings.payment_provider == "sandbox":
        return SandboxPaymentProvider()
    if settings.payment_provider in ("stripe", "razorpay"):
        return StripeLikeProvider()
    raise PaymentError(f"Unknown payment provider: {settings.payment_provider}")
