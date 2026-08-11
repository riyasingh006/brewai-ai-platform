"""Pydantic request/response schemas for the API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, EmailStr, Field, field_validator


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    sessionId: str | None = Field(default=None, max_length=64)
    weather: str | None = Field(default=None, max_length=80)
    timeOfDay: str | None = Field(default=None, max_length=80)
    city: str | None = Field(default=None, max_length=80)

    @field_validator("message")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("message must not be blank")
        return value


class NewSessionRequest(BaseModel):
    title: str | None = Field(default=None, max_length=80)


class ProfileUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=30)
    birthday: str | None = None
    imageUrl: str | None = Field(default=None, max_length=500)


class AddressPayload(BaseModel):
    label: str = Field(default="home", max_length=30)
    line1: str = Field(min_length=1, max_length=200)
    line2: str | None = Field(default=None, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    zip: str | None = Field(default=None, max_length=20)
    country: str = Field(default="IN", max_length=4)
    isDefault: bool = False


class CardPayload(BaseModel):
    brand: str = Field(min_length=1, max_length=30)
    last4: str = Field(min_length=4, max_length=4)
    expiry: str = Field(min_length=4, max_length=7)
    isDefault: bool = False


class Customization(BaseModel):
    size: str | None = None
    milk: str | None = None
    sugar: str | None = None
    ice: str | None = None
    toppings: list[str] = Field(default_factory=list)

    @field_validator("toppings")
    @classmethod
    def _max_toppings(cls, value: list[str]) -> list[str]:
        if len(value) > 5:
            raise ValueError("Too many toppings.")
        return value


class CartAddRequest(BaseModel):
    menuItemId: int
    quantity: int = Field(default=1, ge=1, le=20)
    customization: Customization | None = None


class CartUpdateRequest(BaseModel):
    quantity: int | None = Field(default=None, ge=1, le=20)
    customization: Customization | None = None


class CheckoutRequest(BaseModel):
    paymentMethod: str = Field(pattern="^(upi|card|cash|wallet)$")
    couponCode: str | None = Field(default=None, max_length=40)
    tip: float = Field(default=0.0, ge=0, le=1000)
    notes: str | None = Field(default=None, max_length=500)
    paymentDetails: dict[str, Any] | None = None


class ChargeRequest(BaseModel):
    orderId: str
    method: str = Field(pattern="^(upi|card|cash|wallet)$")
    details: dict[str, Any] | None = None


class ReviewRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class StatusUpdateRequest(BaseModel):
    status: str = Field(pattern="^(pending|confirmed|preparing|ready|completed|cancelled)$")


class MenuItemUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    category: str | None = Field(default=None, max_length=60)
    price: float | None = Field(default=None, gt=0)
    description: str | None = Field(default=None, max_length=500)
    available: bool | None = None
    imageUrl: str | None = Field(default=None, max_length=500)
    featured: bool | None = None
    tags: list[str] | None = None


class MenuItemCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(default="Beverages", max_length=60)
    price: float = Field(gt=0, le=10000)
    description: str | None = Field(default=None, max_length=500)
    available: bool = True
    imageUrl: str | None = Field(default=None, max_length=500)
    featured: bool = False
    tags: list[str] | None = None
