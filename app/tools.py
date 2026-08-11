"""Production-quality tools for querying the Coffee Shop menu.

All functions are pure data operations over ``data/menu.json``. The menu is
loaded once and cached. ``menu_answer()`` is the router used by the CLI to
decide when a question can be answered from menu data instead of Gemini.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
MENU_FILE = DATA_DIR / "menu.json"

REQUIRED_FIELDS = ("id", "name", "category", "price", "description", "available")

HOT_DRINK_CATEGORIES = ("Coffee", "Tea")
COLD_DRINK_CATEGORIES = ("Cold Coffee", "Frappes", "Refreshers", "Smoothies")
DRINK_CATEGORIES = HOT_DRINK_CATEGORIES + COLD_DRINK_CATEGORIES
FOOD_CATEGORIES = ("Sandwiches", "Pizza", "Burgers", "Pasta", "Breakfast", "Desserts")

FOOD_BY_TIME = {
    "breakfast": ("Breakfast", "Sandwiches"),
    "lunch": ("Sandwiches", "Burgers", "Pizza", "Pasta"),
    "dinner": ("Pizza", "Burgers", "Pasta", "Sandwiches"),
    "snack": ("Desserts", "Frappes", "Smoothies"),
}

FAVORITE_DRINK_NAMES = ("Cold Brew", "Flat White", "Mango Smoothie", "Matcha Latte")

_menu_cache: list[dict[str, Any]] | None = None


class MenuError(RuntimeError):
    """Raised when the menu data cannot be loaded or validated."""


def _normalize(text: str) -> str:
    """Lower-case, collapse whitespace for robust keyword matching."""
    return " ".join((text or "").lower().split())


_FAVORITE_DRINKS = {_normalize(name) for name in FAVORITE_DRINK_NAMES}


def _coerce_price(value: Any) -> float:
    """Accept int/float or a numeric string (e.g. '5', '$5.50', '200')."""
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = re.sub(r"[^\d.]", "", value)
        if not cleaned:
            raise ValueError(f"Invalid price: {value!r}")
        return float(cleaned)
    raise ValueError(f"Invalid price: {value!r}")


def load_menu() -> list[dict[str, Any]]:
    """Load and validate the menu from disk (cached after first call).

    Returns:
        A list of menu item dicts.

    Raises:
        MenuError: If the file is missing, malformed, or items are invalid.
    """
    global _menu_cache
    if _menu_cache is not None:
        return _menu_cache

    if not MENU_FILE.exists():
        raise MenuError(f"Menu file not found: {MENU_FILE}")

    try:
        with open(MENU_FILE, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        raise MenuError(f"Failed to read menu file: {exc}") from exc

    if not isinstance(data, list) or not data:
        raise MenuError("Menu file must contain a non-empty JSON list of items.")

    for idx, item in enumerate(data):
        if not isinstance(item, dict):
            raise MenuError(f"Menu item #{idx} is not an object.")
        missing = [field for field in REQUIRED_FIELDS if field not in item]
        if missing:
            raise MenuError(
                f"Menu item #{idx} ({item.get('name')!r}) is missing "
                f"fields: {', '.join(missing)}"
            )
        try:
            item["price"] = _coerce_price(item["price"])
        except ValueError as exc:
            raise MenuError(f"Menu item #{idx} ({item.get('name')!r}): {exc}") from exc

    _menu_cache = data
    logger.info("Loaded %d menu items from %s", len(data), MENU_FILE)
    return _menu_cache


def get_full_menu() -> list[dict[str, Any]]:
    """Return every menu item in the file."""
    return load_menu()


def search_item(name: str) -> list[dict[str, Any]]:
    """Find items whose name appears in the search text.

    Args:
        name: Search text, e.g. "cold brew" or "tiramisu".

    Returns:
        Matching items (name is a case-insensitive substring of ``name``).

    Raises:
        ValueError: If ``name`` is empty.
    """
    query = _normalize(name)
    if not query:
        raise ValueError("Item name must not be empty.")
    return [item for item in load_menu() if _normalize(item["name"]) in query]


def filter_category(category: str) -> list[dict[str, Any]]:
    """Return all items in a given category (case-insensitive)."""
    target = _normalize(category)
    if not target:
        raise ValueError("Category must not be empty.")
    return [item for item in load_menu() if _normalize(item["category"]) == target]


def price_under(max_price: Any) -> list[dict[str, Any]]:
    """Return items priced at or below ``max_price`` (inclusive)."""
    limit = _coerce_price(max_price)
    return [item for item in load_menu() if item["price"] <= limit]


def price_between(min_price: Any, max_price: Any) -> list[dict[str, Any]]:
    """Return items priced between ``min_price`` and ``max_price`` (inclusive)."""
    low, high = _coerce_price(min_price), _coerce_price(max_price)
    if low > high:
        raise ValueError(f"Invalid range: min ({low}) is greater than max ({high}).")
    return [item for item in load_menu() if low <= item["price"] <= high]


def available_items() -> list[dict[str, Any]]:
    """Return only items currently in stock."""
    return [item for item in load_menu() if item["available"]]


def recommend_drink(weather: str) -> list[dict[str, Any]]:
    """Recommend drinks based on the weather.

    Args:
        weather: A short description, e.g. "hot and sunny", "rainy day",
            or "favorite"/"best" for the barista's signature picks.

    Returns:
        Matching in-stock drinks.
    """
    desc = _normalize(weather)
    if not desc:
        raise ValueError("Weather must be a non-empty description.")

    if any(word in desc for word in ("favorite", "favourite", "best", "signature", "popular")):
        picks = [
            item
            for item in load_menu()
            if _normalize(item["name"]) in _FAVORITE_DRINKS and item["available"]
        ]
        if picks:
            return picks
        # Fallback: top three available drinks by price.
        return sorted(available_items(), key=lambda i: i["price"], reverse=True)[:3]

    if any(word in desc for word in ("hot", "warm", "sunny", "heat", "summer", "humid")):
        return [i for i in available_items() if i["category"] in COLD_DRINK_CATEGORIES]

    if any(word in desc for word in ("cold", "chilly", "winter", "snow", "rain", "autumn")):
        return [i for i in available_items() if i["category"] in HOT_DRINK_CATEGORIES]

    return [i for i in available_items() if i["category"] in DRINK_CATEGORIES]


def recommend_food(time_of_day: str) -> list[dict[str, Any]]:
    """Recommend food based on the time of day.

    Args:
        time_of_day: One of "breakfast", "lunch", "dinner", "snack", or
            "any" for a general selection.

    Returns:
        Matching in-stock food items.
    """
    when = _normalize(time_of_day)
    if not when:
        raise ValueError("Time of day must be a non-empty value.")

    categories = None
    for key, values in FOOD_BY_TIME.items():
        if key in when:
            categories = values
            break
    if categories is None:
        if any(word in when for word in ("any", "all", "something", "recommend")):
            categories = FOOD_CATEGORIES
        else:
            raise ValueError(f"Unrecognized time of day: {time_of_day!r}")

    return [i for i in available_items() if i["category"] in categories]


def format_menu(items: list[dict[str, Any]]) -> str:
    """Render a list of items as a plain-text block (for logs/tests)."""
    if not items:
        return "No menu items to display."
    lines = []
    for item in items:
        price = f"${item['price']:.2f}"
        flag = "" if item["available"] else " [SOLD OUT]"
        lines.append(
            f"{item['id']:>3}. {item['name']:<30} {price:<9} "
            f"[{item['category']}]{flag}"
        )
    return "\n".join(lines)


# --- Intent detection helpers used by the router -----------------------------

_CATEGORY_RULES = (
    ("frap", "Frappes"),
    ("refresher", "Refreshers"),
    ("smoothie", "Smoothies"),
    ("pizza", "Pizza"),
    ("burger", "Burgers"),
    ("pasta", "Pasta"),
    ("sandwich", "Sandwiches"),
    ("dessert", "Desserts"),
    ("breakfast", "Breakfast"),
)

_PRICE_UNDER_RE = re.compile(
    r"(?:under|below|less\s+than|cheaper\s+than)\s+\$?\s*([\d.]+)"
)
_PRICE_BETWEEN_RE = re.compile(
    r"between\s+\$?\s*([\d.]+)\s*(?:and|to|-)\s*\$?\s*([\d.]+)"
)

_WEATHER_CONTEXT = ("drink", "recommend", "weather", "should", "best", "good", "have", "day", "today")

# Words that signal a question is asking about the menu (vs. just mentioning
# a menu word in passing, e.g. "tell me a joke about coffee").
_MENU_REQUEST_CUES = (
    "have",
    "show",
    "do you",
    "list",
    "what",
    "which",
    "menu",
    "under",
    "below",
    "less",
    "between",
    "price",
    "cost",
    "how much",
    "recommend",
    "suggest",
    "available",
    "in stock",
    "got",
    "offer",
    "want",
    "like",
    "need",
    "is there",
    "tell me about",
    "you sell",
    "on the menu",
)


def _looks_like_menu_query(query: str) -> bool:
    """True if the query reads like a request for menu information."""
    return any(cue in query for cue in _MENU_REQUEST_CUES)


def _detect_weather(query: str) -> str | None:
    # "cold"/"hot" only count as weather when they are NOT naming a drink.
    if any(k in query for k in ("cold coffee", "cold brew", "iced", "nitro")):
        return None
    hot = any(k in query for k in ("hot", "warm", "sunny", "heat", "summer", "humid"))
    cold = any(k in query for k in ("cold", "chilly", "winter", "snow", "rain", "autumn"))
    if not (hot or cold):
        return None
    if not any(ctx in query for ctx in _WEATHER_CONTEXT):
        return None
    return "hot" if hot else "cold"


def _detect_time(query: str) -> str:
    if any(k in query for k in ("breakfast", "morning")):
        return "breakfast"
    if any(k in query for k in ("lunch", "noon", "afternoon")):
        return "lunch"
    if any(k in query for k in ("dinner", "evening", "night", "supper")):
        return "dinner"
    if any(k in query for k in ("snack", "sweet")):
        return "snack"
    return "any"


def _detect_category(query: str) -> str | None:
    if "iced" in query:
        return "Tea" if any(k in query for k in ("tea", "chai", "matcha")) else "Cold Coffee"
    if any(k in query for k in ("cold coffee", "nitro")):
        return "Cold Coffee"
    if any(k in query for k in ("tea", "chai", "matcha")):
        return "Tea"
    if any(k in query for k in (
        "coffee", "espresso", "latte", "cappuccino", "americano", "cortado",
        "flat white", "macchiato",
    )):
        return "Coffee"
    for keyword, category in _CATEGORY_RULES:
        if keyword in query:
            return category
    return None


_GREETING_RE = re.compile(
    r"\b(hello|hiya|howdy|hey|hi|hola)\b|\bgood\s+(morning|afternoon|evening|day)\b"
)


def _time_from_greeting(query: str) -> str | None:
    """Map a greeting to the best meal window for that time of day."""
    if any(k in query for k in ("good morning", "morning", "breakfast")):
        return "breakfast"
    if any(k in query for k in ("good afternoon", "afternoon", "noon", "lunch")):
        return "lunch"
    if any(k in query for k in ("good evening", "evening", "night", "dinner", "supper")):
        return "dinner"
    return None


def _reason_for(item: dict[str, Any], context: dict[str, Any]) -> str:
    """One-line, deterministic reason an item was recommended."""
    name, category = _normalize(item["name"]), item["category"]
    weather = context.get("weather")
    time_of_day = context.get("time")
    if weather == "hot" and category in COLD_DRINK_CATEGORIES:
        return "iced & refreshing for today"
    if weather == "cold" and category in HOT_DRINK_CATEGORIES:
        return "warm and cozy for today"
    if time_of_day == "breakfast" and category in ("Breakfast", "Sandwiches"):
        return "a great way to start the day"
    if time_of_day == "lunch" and category in FOOD_CATEGORIES:
        return "light and filling for lunch"
    if time_of_day == "dinner" and category in FOOD_CATEGORIES:
        return "a hearty pick for dinner"
    if time_of_day == "snack" and category in ("Desserts", "Frappes", "Smoothies"):
        return "a perfect bite for a snack"
    if category == "Desserts":
        return "a sweet treat to finish"
    if name in _FAVORITE_DRINKS:
        return "a barista favorite"
    return "a customer favorite"


def _attach_reasons(items: list[dict[str, Any]], context: dict[str, Any]) -> None:
    """Add a deterministic reason to each pick (operates on copies)."""
    for item in items:
        item["reason"] = _reason_for(item, context)


def _addon_prompt(items: list[dict[str, Any]]) -> str:
    """Ask whether the customer wants add-ons for the recommended items."""
    if any(item["category"] in DRINK_CATEGORIES for item in items):
        return (
            "Want any of these added to your order? I can customize the size, "
            "milk, or add toppings — just tell me which one."
        )
    return "Want me to add any of these to your order?"


def _proactive_picks(query: str) -> tuple[str, list[dict[str, Any]], str] | None:
    """Proactive picks for greetings and open-ended asks.

    Combines time-of-day food with weather-aware drinks, attaches reasons,
    and returns an add-on prompt. Returns ``None`` when nothing matches.
    """
    weather = _detect_weather(query)
    time_of_day = _time_from_greeting(query)
    context = {"weather": weather, "time": time_of_day}

    seen: dict[int, dict[str, Any]] = {}

    def add(candidates: list[dict[str, Any]], limit: int) -> None:
        added = 0
        for item in candidates:
            if added >= limit or len(seen) >= 6:
                break
            if item["id"] not in seen:
                seen[item["id"]] = dict(item)
                added += 1

    if time_of_day:
        add(recommend_food(time_of_day), 3)
    if weather:
        add(recommend_drink(weather), 2)
    elif time_of_day:
        add(recommend_drink("favorite"), 2)
    if not seen:
        add(recommend_drink("favorite"), 2)
        add(recommend_food("any"), 2)
    if not seen:
        return None

    picks = list(seen.values())
    _attach_reasons(picks, context)

    if time_of_day == "breakfast":
        title = "Good morning! Today's picks"
    elif time_of_day == "lunch":
        title = "Good afternoon! Today's picks"
    elif time_of_day == "dinner":
        title = "Good evening! Today's picks"
    elif weather:
        title = "Today's picks"
    else:
        title = "Barista's picks for you"
    return title, picks, _addon_prompt(picks)


def menu_answer(query: str) -> tuple[str, list[dict[str, Any]], str | None] | None:
    """Route a user question to menu data when possible.

    Returns ``(title, items, prompt)`` when the question can be answered
    from the menu, or ``None`` to signal that Gemini should handle it.
    ``prompt`` is an optional follow-up question (e.g. offering add-ons for
    recommendations). Recommended items carry a deterministic ``reason``.

    Example queries handled:
        "What coffees do you have?"      -> Coffee category
        "Show burgers"                   -> Burgers category
        "Tea under 200"                  -> price + category filter
        "Recommend something"            -> barista picks
        "What is today's best drink?"    -> signature drink picks
        "hello" / "good morning"         -> proactive time/weather picks
    """
    query = _normalize(query)
    if not query:
        return None

    menu = load_menu()

    # 1) Price filters (optionally combined with a category).
    match = _PRICE_BETWEEN_RE.search(query)
    if match:
        low, high = float(match.group(1)), float(match.group(2))
        items = price_between(low, high)
        title = f"Items between ${low:.2f} and ${high:.2f}"
    else:
        match = _PRICE_UNDER_RE.search(query)
        if match:
            limit = float(match.group(1))
            items = price_under(limit)
            title = f"Items under ${limit:.2f}"
        else:
            items, title = None, ""

    if items is not None:
        category = _detect_category(query)
        if category:
            items = [i for i in items if i["category"] == category]
            title = f"{category} {title.lower()}"
        return title, items, None

    # 2) Availability.
    if any(k in query for k in ("available", "in stock")):
        return "Available now", available_items(), None

    # 3) Weather-based drink suggestions.
    weather = _detect_weather(query)
    if weather:
        items = [dict(i) for i in recommend_drink(weather)]
        _attach_reasons(items, {"weather": weather})
        title = "Cold drinks" if weather == "hot" else "Warm drinks"
        return f"{title} for today", items, _addon_prompt(items)

    # 4) Signature / recommended drinks.
    if "drink" in query and any(
        k in query for k in ("best", "favorite", "favourite", "recommend", "today")
    ):
        items = [dict(i) for i in recommend_drink("favorite")]
        _attach_reasons(items, {})
        return "Barista's drink picks", items, _addon_prompt(items)

    # 5) Proactive greeting picks (the barista suggests before you ask).
    #    Skips when the greeting is really a specific menu/price/food request.
    if _GREETING_RE.search(query) and not any(
        k in query for k in _MENU_REQUEST_CUES
    ) and not any(
        k in query for k in ("eat", "food", "breakfast", "lunch", "dinner", "snack", "meal")
    ) and _detect_weather(query) is None:
        picks = _proactive_picks(query)
        if picks:
            return picks

    # 6) Specific item lookup by name (only for obvious menu questions).
    if _looks_like_menu_query(query):
        for item in menu:
            if _normalize(item["name"]) in query:
                return f"'{item['name']}'", [item], None

        # 7) Category filter.
        category = _detect_category(query)
        if category:
            return category, filter_category(category), None

    # 8) Food by time of day.
    time = _detect_time(query)
    if time != "any" and any(
        k in query
        for k in ("eat", "food", "recommend", "suggest", "good", "meal", "get", "should", "what")
    ):
        items = [dict(i) for i in recommend_food(time)[:6]]
        _attach_reasons(items, {"time": time})
        return f"{time.title()} picks", items, _addon_prompt(items)

    # 9) Hungry? Food first.
    if "hungry" in query or any(k in query for k in ("meal", "snack", "eat")):
        items = [dict(i) for i in recommend_food("any")[:6]]
        _attach_reasons(items, {})
        return "Food picks", items, _addon_prompt(items)

    # 9) General recommendations.
    if any(k in query for k in (
        "recommend",
        "suggest",
        "favorites",
        "best sellers",
        "popular",
        "surprise",
        "what should i",
        "fancy",
    )):
        picks = [dict(i) for i in recommend_drink("favorite")[:2] + recommend_food("any")[:4]]
        _attach_reasons(picks, {})
        return "Barista's picks", picks, _addon_prompt(picks)

    # 10) Full menu.
    if any(k in query for k in ("menu", "what do you have", "everything", "show all", "full menu")):
        return "Full menu", get_full_menu(), None

    return None
