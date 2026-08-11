"""Seed the database for local development.

Usage:
    python backend/scripts/seed.py

Creates the schema (if needed), imports the AI core menu, creates dev
identities, starter coupons and an active festival offer.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
BACKEND = Path(__file__).resolve().parent.parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))  # exposes the `generated` client package

from backend.core.config import get_settings, load_env  # noqa: E402
from backend.db import datasource_override  # noqa: E402
from backend.services import admin_service  # noqa: E402

load_env()

from prisma import Prisma  # noqa: E402


def _upsert_user(db: Prisma, user_id: str, email: str, name: str, role: str) -> None:
    existing = db.user.find_unique(where={"id": user_id})
    if existing is None:
        db.user.create(
            data={
                "id": user_id,
                "email": email,
                "name": name,
                "role": role,
                "referralCode": f"SEED-{user_id[-4:].upper()}",
            }
        )
        print(f"  user {user_id} ({email})")
    else:
        print(f"  user {user_id} exists")


def _upsert_coupon(db: Prisma, code: str, description: str, dtype: str, value: float, min_order: float = 0, max_discount: float | None = None, expires_in_days: int = 60) -> None:
    if db.coupon.find_unique(where={"code": code}):
        return
    db.coupon.create(
        data={
            "code": code,
            "description": description,
            "discountType": dtype,
            "discountValue": value,
            "minOrder": min_order,
            "maxDiscount": max_discount,
            "expiresAt": datetime.now(timezone.utc) + timedelta(days=expires_in_days),
        }
    )
    print(f"  coupon {code}")


def main() -> None:
    print("Connecting to database...")
    override = datasource_override()
    db = (
        Prisma(auto_register=True, datasource=override)
        if override is not None
        else Prisma(auto_register=True)
    )
    db.connect()

    print("Importing menu from data/menu.json...")
    count = admin_service.import_menu_from_json(db)
    print(f"  {count} menu items")

    print("Seeding dev identities...")
    _upsert_user(db, "dev_admin", "admin@coffeeshop.local", "Barista Admin", "admin")
    _upsert_user(db, "dev_customer", "customer@coffeeshop.local", "Coffee Lover", "customer")

    print("Seeding coupons...")
    _upsert_coupon(db, "WELCOME10", "10% off your first order", "percentage", 10, min_order=5)
    _upsert_coupon(db, "SUMMER15", "15% off cold drinks", "percentage", 15, min_order=8, max_discount=100)

    print("Seeding festival offer...")
    now = datetime.now(timezone.utc)
    if db.festival.count() == 0:
        db.festival.create(
            data={
                "name": "Monsoon Madness",
                "emoji": "🌧️",
                "description": "Cozy warm brews 15% off while it rains.",
                "theme": "monsoon",
                "startsAt": now - timedelta(days=1),
                "endsAt": now + timedelta(days=30),
            }
        )
        print("  festival Monsoon Madness")

    print("Seeding tags on menu items...")
    tags = {"Cold Brew": ["popular"], "Flat White": ["popular"], "Espresso": ["popular"], "Matcha Latte": ["new"], "Seasonal Spice Latte": ["seasonal", "new"], "Tiramisu": ["new"]}
    for name, tlist in tags.items():
        item = db.menuitem.find_first(where={"name": name})
        if item:
            db.menuitem.update(where={"id": item.id}, data={"tags": json.dumps(tlist)})

    db.disconnect()
    print("Seed complete.")


if __name__ == "__main__":
    main()
