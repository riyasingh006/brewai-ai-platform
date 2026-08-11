"""Deterministic conversational ordering for the chat backend.

Parses Hinglish + English order commands and executes them against the real
DB-backed cart/order services (``order_service``). Handles CREATE_ORDER,
ADD_ITEM, REMOVE_ITEM, UPDATE_QUANTITY, CUSTOMIZE_ITEM, VIEW_CART,
CONFIRM_ORDER, CANCEL_ORDER, CHECK_ORDER_STATUS, REPEAT_LAST_ORDER and
CLEAR_CART intents without calling the AI model:

* Every price/total is computed server-side by ``order_service``.
* Ambiguous item mentions (or generic category words) ask a numbered list.
* Order creation always asks for a payment method before persisting.
* Orders are created with status ``confirmed`` and scoped to the
  authenticated user only.
* An in-memory idempotency guard stops retries / regenerate from creating a
  duplicate order for the same message.

Returns ``None`` when it does not own the message, so the caller
(``chat_service.run_chat``) can fall through to the legacy draft flow / the
Gemini agent unchanged.
"""

from __future__ import annotations

import logging
import re
import time

from prisma import Prisma

from . import order_service, users as user_service

logger = logging.getLogger(__name__)

_PENDING_TTL = 180.0
_DEDUPE_TTL = 45.0

_pending: dict[str, dict] = {}
_last_created: dict[tuple[str, str], tuple[float, str]] = {}


def _now() -> float:
    return time.monotonic()


def _norm(text: str) -> str:
    """Lower-case, strip punctuation, collapse whitespace."""
    text = (text or "").lower()
    text = re.sub(r"[^\w\s]|_", " ", text)
    return " ".join(text.split())


def _money(value: float) -> str:
    return f"${value:.2f}"


def _status_label(status: str) -> str:
    return {
        "pending": "PENDING",
        "confirmed": "CONFIRMED",
        "preparing": "PREPARING",
        "ready": "ON THE WAY",
        "completed": "COMPLETED",
        "cancelled": "CANCELLED",
    }.get(status, status.upper())


# ---------------------------------------------------------------- utils

_WORD_NUMBERS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "ek": 1, "do": 2, "teen": 3, "char": 4, "chaar": 4, "paanch": 5,
    "panch": 5, "chhe": 6, "che": 6, "chhai": 6, "saat": 7, "aath": 8,
    "nau": 9, "das": 10,
}

_QUANT_RE = re.compile(r"(\d+)\s*[xX]?\s*")


def _qty_in_text(text: str) -> int | None:
    for word, num in _WORD_NUMBERS.items():
        if re.search(rf"\b{word}\b", text):
            return num
    match = _QUANT_RE.search(text)
    if match:
        return int(match.group(1))
    return None


def _quantity_near(segment: str, item_name: str) -> int:
    lower = _norm(segment)
    name = _norm(item_name)
    idx = lower.find(name)
    if idx < 0:
        return _qty_in_text(lower) or 1
    before = lower[max(0, idx - 16):idx]
    after = lower[idx + len(name): idx + len(name) + 8]
    qty = _qty_in_text(before)
    if qty is not None:
        return qty
    qty = _qty_in_text(after)
    if qty is not None:
        return qty
    return 1


# --------------------------------------------------------------- the menu

def _load_db_menu(db: Prisma) -> list[dict]:
    """DB menu items (mirrors ``menu._menu_from_db``). Real ordering always
    needs the DB ids/prices, so the JSON fallback is only used for display."""
    rows = db.menuitem.find_many(order={"id": "asc"})
    if rows:
        return [user_service._serialize_menu_item(row) for row in rows]
    return []


_ALIAS_NAMES: dict[str, str] = {
    "chai": "Chai Latte",
    "matcha": "Matcha Latte",
    "nitro": "Nitro Cold Brew",
    "expresso": "Espresso",
    "capuccino": "Cappuccino",
    "cappucino": "Cappuccino",
    "cappacino": "Cappuccino",
    "kapuccino": "Cappuccino",
    "brownie": "Double Chocolate Brownie",
    "muffin": "Blueberry Muffin",
    "croissant": "Butter Croissant",
    "cheesecake": "New York Cheesecake",
    "bagel": "Egg & Bacon Bagel",
    "pancake": "Buttermilk Pancakes",
    "pancakes": "Buttermilk Pancakes",
    "avocado toast": "Avocado Toast",
    "spaghetti": "Spaghetti Bolognese",
    "bolognese": "Spaghetti Bolognese",
    "alfredo": "Chicken Alfredo Pasta",
    "penne": "Pesto Penne",
    "caprese": "Caprese Sandwich",
    "pesto": "Chicken Pesto Sandwich",
    "pepperoni": "Pepperoni Pizza",
    "margherita": "Margherita Pizza",
    "cheeseburger": "Classic Cheeseburger",
    "cheese burger": "Classic Cheeseburger",
    "veggie burger": "Veggie Burger",
    "bbq burger": "Bacon BBQ Burger",
    "bacon burger": "Bacon BBQ Burger",
    "veggie pizza": "Veggie Supreme Pizza",
    "mocha": "Mocha Frappe",
    "caramel frappe": "Caramel Frappe",
    "java chip": "Java Chip Frappe",
    "vanilla frappe": "Vanilla Bean Frappe",
    "strawberry smoothie": "Strawberry Banana Smoothie",
    "detox": "Green Detox Smoothie",
    "turkey sandwich": "Turkey & Swiss Sandwich",
    "chicken sandwich": "Chicken Pesto Sandwich",
    "chicken alfredo": "Chicken Alfredo Pasta",
}

_FUNCTION_WORDS = {
    "please", "plz", "pls", "order", "kro", "karo", "kardo", "krdo", "kar",
    "karna", "kijiye", "dena", "de", "do", "bhejo", "dejna", "chahiye",
    "chaiye", "chahta", "chahti", "lena", "le", "lo", "lijiye", "want",
    "would", "like", "give", "get", "bhej", "bheja", "mujhe", "mujhko",
    "mera", "mere", "main", "mai", "mujh", "kuch", "yaar", "bhai", "ki",
    "ke", "ka", "se", "me", "kya",
}

_CATEGORY_TOKENS: dict[str, str] = {
    "cold coffee": "Cold Coffee",
    "coffee": "Coffee",
    "smoothie": "Smoothies",
    "frappe": "Frappes",
    "frappes": "Frappes",
    "refresher": "Refreshers",
    "refreshers": "Refreshers",
    "pizza": "Pizza",
    "burger": "Burgers",
    "burgers": "Burgers",
    "pasta": "Pasta",
    "sandwich": "Sandwiches",
    "sandwiches": "Sandwiches",
    "dessert": "Desserts",
    "desserts": "Desserts",
    "breakfast": "Breakfast",
}


def _alias_map(menu: list[dict]) -> dict[str, dict]:
    by_name = {_norm(item["name"]): item for item in menu}
    out: dict[str, dict] = {}
    for token, name in _ALIAS_NAMES.items():
        item = by_name.get(_norm(name))
        if item is not None:
            out[_norm(token)] = item
    return out


def _candidates_for_segment(segment: str, menu: list[dict]) -> list[dict]:
    seg = _norm(segment)
    hits: dict[int, dict] = {}
    for token, item in _alias_map(menu).items():
        if token in seg:
            hits.setdefault(item["id"], item)
    for item in menu:
        name = _norm(item["name"])
        if name and name in seg:
            hits.setdefault(item["id"], item)
    return sorted(hits.values(), key=lambda i: i["id"])


# ----------------------------------------------------------- segmentation

_SEGMENT_SPLIT = re.compile(
    r"\s+(?:aur|and|plus|ke\s*sath|ke\s*saath|sath\s*me|sath)\s+"
    r"|[,;&]"
)


def _starts_with_customization(tail: str) -> bool:
    """True when ``tail`` begins with a customization phrase, so that
    "cappuccino with oat milk" is kept together instead of being split."""
    norm = _norm(tail)
    for phrase in _CUSTOMIZATION_PHRASES:
        key = _norm(phrase)
        if key and norm.startswith(key):
            return True
    return False


def _segment(message: str) -> list[str]:
    parts = _SEGMENT_SPLIT.split(message)
    out: list[str] = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        # Split on "with" only when the following text is NOT a customization,
        # so customizations stay glued to their item mention.
        rest = part
        while True:
            match = re.search(r"\bwith\b", rest)
            if not match:
                out.append(rest.strip())
                break
            tail = rest[match.end():].strip()
            if _starts_with_customization(tail):
                out.append(rest.strip())
                break
            out.append(rest[: match.start()].strip())
            rest = tail
            if not rest:
                break
    return [p for p in (o.strip() for o in out) if p]


# -------------------------------------------------------------- customize

_MILK_MAP = {
    "oat milk": "oat", "oat": "oat", "soy milk": "soy", "soy": "soy",
    "almond milk": "almond", "almond": "almond", "skim milk": "skim",
    "skim": "skim", "low fat": "skim", "full cream": "full cream",
    "whole milk": "whole",
}
_SIZE_MAP = {"small": "small", "tall": "small", "medium": "medium",
             "grande": "medium", "large": "large", "venti": "large",
             "double": "large", "bada": "large", "chota": "small"}
_SUGAR_MAP = {"no sugar": "none", "without sugar": "none", "less sugar": "less",
              "extra sugar": "extra", "sugar free": "none"}
_ICE_MAP = {"no ice": "none", "less ice": "light", "extra ice": "extra"}
_TOPPINGS = ("extra shot", "double shot", "whipped cream", "caramel drizzle",
             "chocolate chips", "hazelnut", "vanilla syrup", "almond syrup")

_CUSTOMIZATION_PHRASES = (
    tuple(_MILK_MAP) + tuple(_SIZE_MAP) + tuple(_SUGAR_MAP) + tuple(_ICE_MAP) + tuple(_TOPPINGS)
)


def _extract_customization(segment: str) -> dict:
    seg = _norm(segment)
    out: dict[str, str | list[str]] = {}
    for key, value in _MILK_MAP.items():
        if re.search(rf"\b{re.escape(key)}\b", seg):
            out["milk"] = value
            break
    for key, value in _SIZE_MAP.items():
        if re.search(rf"\b{re.escape(key)}\b", seg):
            out["size"] = value
            break
    for key, value in _SUGAR_MAP.items():
        if re.search(rf"\b{re.escape(key)}\b", seg):
            out["sugar"] = value
            break
    for key, value in _ICE_MAP.items():
        if re.search(rf"\b{re.escape(key)}\b", seg):
            out["ice"] = value
            break
    toppings = [t for t in _TOPPINGS if re.search(rf"\b{re.escape(t)}\b", seg)]
    if toppings:
        out["toppings"] = toppings
    return out


# ---------------------------------------------------------------- intents

_ADD_VERBS = (
    "add", "add to cart", "add to my order", "add to order", "add it",
    "add this", "add karo", "aur add", "extra add", "plus",
)
_CREATE_VERBS = (
    "order", "order kr do", "order krdo", "order kardo", "order kar do",
    "order karo", "order de do", "order dena", "order de", "order bhejo",
    "place order", "place an order", "confirm order", "checkout",
    "checkout karo", "order confirm kar", "de do", "de dijiye", "bhejo",
    "dena", "chahiye", "chaiye", "chahi", "chahta", "chahti", "lena hai",
    "lena", "le lo", "lijiye", "want", "i want", "i'd like", "i would like",
    "get me", "give me", "i'll take", "ill take", "i'll have", "ill have",
    "can i get", "can i have", "kharidna", "kharid", "mangta", "mangti",
    "mang raha", "mang rahi", "want to order",
)
_CANCEL_VERBS = ("cancel", "cancelled", "cancel kr do", "cancel kardo",
                 "cancel kar", "cancel kar do", "cancel de do", "band kar",
                 "roko", "rukwao")
_STATUS_VERBS = ("where is my order", "order status", "status of my order",
                 "track my order", "track order", "order kahan hai",
                 "kahan hai", "kitni der", "kab banega", "kab aayega",
                 "kab milega", "order ka status", "order kitna time")
_REPEAT_VERBS = ("repeat", "same order", "phir se order", "phir se",
                 "ek aur baar", "dubara", "dobaara", "reorder",
                 "repeat my last order", "order again", "again order",
                 "same again", "same order phir")
_VIEW_CART_VERBS = ("show cart", "my cart", "cart dikhao", "cart kya hai",
                    "kya order hai", "kya items", "what's in my cart",
                    "what is in my cart", "current order", "show my order",
                    "kya kya", "cart show", "order me kya")
_CLEAR_VERBS = ("clear cart", "empty cart", "cart clear", "cart saaf",
                "cart khaali", "remove all items", "remove everything",
                "clear my cart", "sab hata do")
_CONFIRM_VERBS = ("checkout", "place order", "place the order",
                  "confirm order", "order confirm", "order place kar",
                  "checkout kar", "payment kar do", "bag kar do",
                  "order bhejo", "pay now", "pay")
_REMOVE_VERBS = ("remove", "hatao", "hata do", "hata", "nikalo", "remove the",
                 "delete the", "remove my", "hata dena")
_UPDATE_VERBS = ("make it", "instead of", "make that", "update quantity",
                 "quantity of", "double it", "triple it")
_CUSTOMIZE_VERBS = ("customize", "customize my", "customise", "customise my",
                    "make my", "make that with", "make this with", "change my",
                    "update my")

_PAYMENT_METHODS = ("upi", "card", "cash", "wallet")


def _has_any(message: str, phrases: tuple[str, ...]) -> bool:
    return any(phrase in message for phrase in phrases)


_INFO_QUESTION_RE = re.compile(
    r"\b(what|which|how|why|when|where|recommend|suggest|about|know|"
    r"tell me|show|price|cost|nutrition|calories|difference|menu|"
    r"popular|best|favorite|favourite|available)\b"
)


def _is_info_question(message: str) -> bool:
    """True when the message reads as an informational menu question rather
    than an order command (e.g. "i want to know about your coffee")."""
    return _INFO_QUESTION_RE.search(message) is not None


def _extract_payment_method(message: str) -> str | None:
    seg = _norm(message)
    for method in _PAYMENT_METHODS:
        if re.search(rf"\b{method}\b", seg):
            return method
    return None


def _extract_order_number(message: str) -> str | None:
    match = re.search(r"\b(CS[-\s]\d{8}[-\s]\d{6})\b", message.upper())
    return match.group(1).replace(" ", "-") if match else None


# -------------------------------------------------------------- mentions

def _parse_mentions(message: str, menu: list[dict]) -> list[dict]:
    """Split the message into product mentions. Each mention carries its
    quantity, customization and candidate items; unique matches are auto
    chosen, ambiguous ones wait for the user."""
    mentions: list[dict] = []
    for segment in _segment(message):
        seg = _norm(segment)
        if not seg:
            continue
        candidates = _candidates_for_segment(segment, menu)
        category = None
        if not candidates:
            for token, cat in _CATEGORY_TOKENS.items():
                if re.search(rf"\b{re.escape(token)}\w*\b", seg):
                    category = cat
                    break
            if category:
                candidates = [i for i in menu if i["category"] == category and i["available"]]
        unknown = (not candidates) and (category is None)
        if unknown:
            words = [w for w in seg.split() if w]
            if words and all(w in _FUNCTION_WORDS for w in words):
                continue
        mention: dict = {
            "text": segment,
            "quantity": 1,
            "customization": _extract_customization(segment),
            "candidates": candidates,
            "chosen": None,
            "category": category,
            "unknown": unknown,
        }
        if len(candidates) == 1:
            mention["chosen"] = candidates[0]
        if candidates:
            mention["quantity"] = _quantity_near(segment, candidates[0]["name"])
        mentions.append(mention)
    return mentions


def _has_item_mentions(mentions: list[dict]) -> bool:
    return any(m["candidates"] or m["category"] for m in mentions)


def _classify(message: str, mentions: list[dict]) -> str | None:
    seg = _norm(message)
    has_items = _has_item_mentions(mentions)
    if _has_any(seg, _CANCEL_VERBS):
        return "cancel"
    if _has_any(seg, _STATUS_VERBS):
        return "status"
    if _has_any(seg, _REPEAT_VERBS):
        return "repeat"
    if _has_any(seg, _VIEW_CART_VERBS):
        return "view_cart"
    if _has_any(seg, _CLEAR_VERBS):
        return "clear_cart"
    if _has_any(seg, _REMOVE_VERBS) and has_items:
        return "remove"
    if _has_any(seg, _UPDATE_VERBS) and has_items:
        return "update_qty"
    if _has_any(seg, _CUSTOMIZE_VERBS) and has_items:
        return "customize"
    if _has_any(seg, _CONFIRM_VERBS) and not has_items:
        return "confirm"
    if _has_any(seg, _ADD_VERBS) and has_items:
        return "add"
    if _has_any(seg, _CREATE_VERBS) and has_items and not _is_info_question(message):
        return "create"
    return None


# ---------------------------------------------------------------- pending

def _set_pending(user_id: str, kind: str, payload: dict) -> None:
    _pending[user_id] = {"kind": kind, "payload": payload, "ts": _now()}


def _get_pending(user_id: str) -> dict | None:
    entry = _pending.get(user_id)
    if entry is None:
        return None
    if _now() - entry["ts"] > _PENDING_TTL:
        _pending.pop(user_id, None)
        return None
    return entry


def _clear_pending(user_id: str) -> None:
    _pending.pop(user_id, None)


# ------------------------------------------------------------- resolution

def _resolve_mentions(mentions: list[dict]) -> tuple[list[dict], list[str], list[str]]:
    items: list[dict] = []
    unavailable: list[str] = []
    unknown: list[str] = []
    for m in mentions:
        if m["chosen"]:
            item = m["chosen"]
            if not item["available"]:
                unavailable.append(f"{item['name']} is currently unavailable.")
                continue
            items.append({
                "menuItemId": item["id"],
                "name": item["name"],
                "unitPrice": item["price"],
                "quantity": m["quantity"],
                "customization": m["customization"],
            })
        elif m["unknown"]:
            unknown.append(m["text"])
    return items, unavailable, unknown


def _summary(items: list[dict]) -> str:
    return "\n".join(
        f"{i['quantity']}× {i['name']} — {_money(i['unitPrice'] * i['quantity'])}"
        for i in items
    )


def _build_payment_question(mentions: list[dict], note_parts: list[str]) -> str:
    items, unavailable, unknown = _resolve_mentions(mentions)
    lines = [f"I've got your order ready:\n{_summary(items)}"]
    for note in list(unavailable) + list(unknown) + note_parts:
        lines.append(f"Note: {note}")
    lines.append(
        "\nHow would you like to pay — **upi**, **card**, **cash**, or **wallet**? "
        "(reply with the method, or type *cancel* to drop this order)"
    )
    return "\n".join(lines)


def _ask_which(mention: dict) -> str:
    if mention["category"] and not mention["candidates"]:
        return f"Sorry, there are no {mention['category'].lower()} available right now."
    if mention["category"]:
        title = f"Which {mention['category'].lower()} would you like?"
    else:
        title = f'I found a few options for "{mention["text"]}". Which one would you like?'
    lines = [title]
    for i, item in enumerate(mention["candidates"], start=1):
        flag = " [SOLD OUT]" if not item["available"] else ""
        lines.append(f"{i}) {item['name']} — {_money(item['price'])}{flag}")
    lines.append("Reply with a number or the menu item name.")
    return "\n".join(lines)


def _confirmation_text(order: dict) -> str:
    lines = ["✅ Order confirmed!", ""]
    lines.append(f"Order #: **{order['orderNumber']}**")
    for item in order["items"]:
        lines.append(
            f"- {item['quantity']}× {item['name']} — {_money(item['unitPrice'] * item['quantity'])}"
        )
    lines.append(
        ""
        f"Subtotal: {_money(order['subtotal'])} · Tax: {_money(order['tax'])} · "
        f"**Total: {_money(order['total'])}**"
    )
    lines.append(f"Status: ✅ CONFIRMED · ETA ~{order['estMinutes']} min")
    return "\n".join(lines)


def _friendly_error(message: str) -> str:
    lower = message.lower()
    if "not found" in lower:
        return "Sorry, I couldn't find that item on the menu."
    if "sold out" in lower:
        return message.replace(" is currently sold out.", " is currently unavailable.")
    if "quantity" in lower:
        return "Please tell me how many you'd like (at least 1)."
    if "payment method" in lower:
        return "Please pick a payment method: upi, card, cash, or wallet."
    if "cart is empty" in lower:
        return "Your cart is empty — tell me what you'd like to order."
    logger.warning("Unmapped order error: %s", message)
    return "Sorry, I couldn't complete that right now. Please try again."


def _order_status_text(order: dict) -> str:
    lines = [
        f"Your order **{order['orderNumber']}** is **{_status_label(order['status'])}**.",
        _summary([{
            "quantity": i["quantity"],
            "name": i["name"],
            "unitPrice": i["unitPrice"],
        } for i in order["items"]]),
        f"Total: **{_money(order['total'])}**",
    ]
    return "\n".join(lines)


# ------------------------------------------------------------ execution

def _find_cart_item(cart: list[dict], mention: dict) -> dict | None:
    """Best-effort cart item match by mention text."""
    needle = _norm(mention["text"])
    if mention["chosen"]:
        needle = _norm(mention["chosen"]["name"])
    if not needle:
        return None
    best, best_score = None, 0
    for item in cart:
        name = _norm(item["name"])
        if needle == name:
            return item
        score = 0
        if name in needle or needle in name:
            score = 5
        elif name.split() and needle.split():
            overlap = set(name.split()) & set(needle.split())
            score = len(overlap)
        if score > best_score:
            best_score, best = score, item
    return best if best_score > 0 else None


def _execute_create(db: Prisma, user_id: str, payload: dict, method: str) -> dict:
    source = payload.get("source", "")
    key = (user_id, source)
    record = _last_created.get(key)
    if record and _now() - record[0] < _DEDUPE_TTL:
        try:
            order = order_service.get_order(db, record[1], user_id)
            return {"events": [("orderCreated", {"order": order})], "text": _confirmation_text(order)}
        except (KeyError, PermissionError):
            pass

    mentions = payload.get("mentions") or []
    items, _unavailable, _unknown = _resolve_mentions(mentions)
    if not items:
        return {
            "events": [],
            "text": "Sorry, your order is empty now. Tell me what you'd like and I'll restart it.",
        }
    try:
        order = order_service.create_order(db, user_id, payment_method=method, items=items)
    except ValueError as exc:
        return {"events": [], "text": _friendly_error(str(exc))}
    try:
        order = order_service.update_order_status(db, order["id"], "confirmed")
    except (KeyError, ValueError):
        pass
    _last_created[key] = (_now(), order["id"])
    return {"events": [("orderCreated", {"order": order})], "text": _confirmation_text(order)}


def _execute_confirm(db: Prisma, user_id: str, payload: dict, method: str) -> dict:
    source = payload.get("source", "")
    key = (user_id, source)
    record = _last_created.get(key)
    if record and _now() - record[0] < _DEDUPE_TTL:
        try:
            order = order_service.get_order(db, record[1], user_id)
            return {"events": [("orderCreated", {"order": order})], "text": _confirmation_text(order)}
        except (KeyError, PermissionError):
            pass
    try:
        order = order_service.create_order(db, user_id, payment_method=method)
    except ValueError as exc:
        return {"events": [], "text": _friendly_error(str(exc))}
    try:
        order = order_service.update_order_status(db, order["id"], "confirmed")
    except (KeyError, ValueError):
        pass
    _last_created[key] = (_now(), order["id"])
    return {"events": [("orderCreated", {"order": order})], "text": _confirmation_text(order)}


def _execute_add(db: Prisma, user_id: str, mentions: list[dict]) -> dict:
    items, unavailable, unknown = _resolve_mentions(mentions)
    if not items:
        note = " ".join(unavailable + unknown)
        return {"events": [], "text": "Sorry, I couldn't add that. " + note if note else "Sorry, I couldn't add that."}
    added = []
    for item in items:
        try:
            order_service.add_to_cart(
                db, user_id, item["menuItemId"], item["quantity"], item.get("customization")
            )
            added.append(f"{item['quantity']}× {item['name']}")
        except ValueError as exc:
            note = _friendly_error(str(exc))
            unavailable.append(note)
    cart = order_service.get_cart(db, user_id)
    subtotal = round(sum(i["unitPrice"] * i["quantity"] for i in cart), 2)
    lines = [f"Added to your order:\n" + _summary([{
        "quantity": i["quantity"], "name": i["name"], "unitPrice": i["unitPrice"],
    } for i in cart])]
    for note in unavailable:
        lines.append(f"Note: {note}")
    lines.append(f"\nCart subtotal: **{_money(subtotal)}**")
    return {"events": [("orderState", {"cart": cart})], "text": "\n".join(lines)}


def _execute_remove(db: Prisma, user_id: str, mentions: list[dict]) -> dict:
    cart = order_service.get_cart(db, user_id)
    if not cart:
        return {"events": [], "text": "Your cart is empty."}
    target = _find_cart_item(cart, mentions[0]) if mentions else None
    if target is None:
        label = mentions[0]["text"] if mentions else "that item"
        return {"events": [], "text": f"I couldn't find \"{label}\" in your current order."}
    order_service.remove_cart_item(db, target["id"], user_id)
    cart = order_service.get_cart(db, user_id)
    lines = [f"Removed {target['name']} from your order."]
    if cart:
        subtotal = round(sum(i["unitPrice"] * i["quantity"] for i in cart), 2)
        lines.append(f"\nRemaining subtotal: **{_money(subtotal)}**")
    return {"events": [("orderState", {"cart": cart})], "text": "\n".join(lines)}


def _execute_update_qty(db: Prisma, user_id: str, mentions: list[dict]) -> dict:
    cart = order_service.get_cart(db, user_id)
    mention = mentions[0] if mentions else None
    if mention is None:
        return {"events": [], "text": "Which item would you like to change?"}
    target = _find_cart_item(cart, mention)
    if target is None:
        label = mention["chosen"]["name"] if mention["chosen"] else mention["text"]
        return {"events": [], "text": f"I couldn't find \"{label}\" in your current order."}
    qty = mention["quantity"]
    order_service.update_cart_item(db, target["id"], user_id, quantity=qty)
    cart = order_service.get_cart(db, user_id)
    return {
        "events": [("orderState", {"cart": cart})],
        "text": f"Updated {target['name']} to {qty}×.",
    }


def _execute_customize(db: Prisma, user_id: str, mentions: list[dict]) -> dict:
    cart = order_service.get_cart(db, user_id)
    mention = mentions[0] if mentions else None
    if mention is None:
        return {"events": [], "text": "Which item would you like to customize?"}
    target = _find_cart_item(cart, mention)
    if target is None:
        label = mention["chosen"]["name"] if mention["chosen"] else mention["text"]
        return {"events": [], "text": f"I couldn't find \"{label}\" in your current order."}
    merged = dict(target.get("customization") or {})
    merged.update(mention["customization"])
    order_service.update_cart_item(db, target["id"], user_id, customization=merged)
    cart = order_service.get_cart(db, user_id)
    return {
        "events": [("orderState", {"cart": cart})],
        "text": f"Updated **{target['name']}** with your customization.",
    }


def _execute_view_cart(db: Prisma, user_id: str) -> dict:
    cart = order_service.get_cart(db, user_id)
    if not cart:
        return {"events": [("orderState", {"cart": []})], "text": "Your cart is empty."}
    subtotal = round(sum(i["unitPrice"] * i["quantity"] for i in cart), 2)
    text = "Here's your current order:\n" + _summary([
        {"quantity": i["quantity"], "name": i["name"], "unitPrice": i["unitPrice"]} for i in cart
    ])
    text += f"\n\nSubtotal: **{_money(subtotal)}**"
    return {"events": [("orderState", {"cart": cart})], "text": text}


def _execute_clear(db: Prisma, user_id: str) -> dict:
    order_service.clear_cart(db, user_id)
    return {"events": [("orderState", {"cart": []})], "text": "Your cart has been cleared."}


def _execute_status(db: Prisma, user_id: str, message: str) -> dict:
    orders = order_service.list_orders(db, user_id)
    if not orders:
        return {"events": [], "text": "You don't have any orders yet."}
    number = _extract_order_number(message)
    target = next((o for o in orders if o["orderNumber"] == number), None) if number else None
    target = target or orders[0]
    return {"events": [("orderStatus", {"order": target})], "text": _order_status_text(target)}


def _execute_cancel(db: Prisma, user_id: str, message: str, mentions: list[dict]) -> dict:
    orders = order_service.list_orders(db, user_id)
    active = [o for o in orders if o["status"] in ("pending", "confirmed", "preparing")]
    if not active:
        return {"events": [], "text": "You don't have any active orders to cancel."}

    number = _extract_order_number(message)
    target = next((o for o in active if o["orderNumber"] == number), None) if number else None
    if target is None and mentions and _has_item_mentions(mentions):
        needle = _norm(mentions[0]["chosen"]["name"]) if mentions[0]["chosen"] else _norm(mentions[0]["text"])
        for order in active:
            if any(needle in _norm(i["name"]) or _norm(i["name"]) in needle for i in order["items"]):
                target = order
                break

    if target is not None:
        if target["status"] in ("ready", "completed"):
            return {"events": [], "text": f"Sorry, order **{target['orderNumber']}** is already {_status_label(target['status'])} and can't be cancelled."}
        if target["status"] == "preparing":
            return {"events": [], "text": f"Sorry, order **{target['orderNumber']}** is already being prepared and can't be cancelled."}
        order = order_service.update_order_status(db, target["id"], "cancelled")
        return {
            "events": [("orderCancelled", {"order": order})],
            "text": f"✅ Cancelled order **{order['orderNumber']}**.",
        }

    if len(active) == 1:
        order = order_service.update_order_status(db, active[0]["id"], "cancelled")
        return {
            "events": [("orderCancelled", {"order": order})],
            "text": f"✅ Cancelled order **{order['orderNumber']}**.",
        }

    lines = ["You have a few active orders. Which one would you like to cancel?"]
    for i, order in enumerate(active[:6], start=1):
        lines.append(f"{i}) {order['orderNumber']} — {_money(order['total'])} ({_status_label(order['status'])})")
    lines.append("Reply with the number or the order number.")
    _set_pending(user_id, "cancel_pick", {"orders": active, "source": message})
    return {"events": [], "text": "\n".join(lines)}


def _execute_repeat(db: Prisma, user_id: str, message: str) -> dict:
    orders = order_service.list_orders(db, user_id)
    if not orders:
        return {"events": [], "text": "You don't have any past orders to repeat yet."}
    last = orders[0]
    menu = _load_db_menu(db)
    by_name = {_norm(item["name"]): item for item in menu}
    items: list[dict] = []
    skipped: list[str] = []
    for order_item in last["items"]:
        item = by_name.get(_norm(order_item["name"]))
        if item is None or not item["available"]:
            skipped.append(order_item["name"])
            continue
        items.append({
            **item,
            "quantity": order_item["quantity"],
            "customization": order_item.get("customization") or {},
        })
    if not items:
        return {"events": [], "text": "Sorry, I can't reorder that right now — those items aren't available."}
    mentions = [{
        "text": item["name"], "quantity": item["quantity"],
        "customization": item["customization"],
        "candidates": [item], "chosen": None, "category": None, "unknown": False,
    } for item in items]
    for m, item in zip(mentions, items):
        m["chosen"] = item
    note_parts = [f"{name} is no longer available — I left it out." for name in skipped] if skipped else []
    text = _build_payment_question(mentions, note_parts)
    _set_pending(user_id, "payment", {"mentions": mentions, "source": message})
    return {"events": [], "text": text}


# ------------------------------------------------------------ pending flow

def _resolve_pick_choice(message: str, candidates: list[dict]) -> dict | None:
    seg = _norm(message)
    match = re.search(r"\b([1-9]\d*)\b", seg)
    if match:
        idx = int(match.group(1)) - 1
        if 0 <= idx < len(candidates):
            return candidates[idx]
    for item in candidates:
        if _norm(item["name"]) in seg:
            return item
    return None


def _cancel_pick_target(message: str, orders: list[dict]) -> dict | None:
    number = _extract_order_number(message)
    if number:
        return next((o for o in orders if o["orderNumber"] == number), None)
    match = re.search(r"\b([1-9]\d*)\b", _norm(message))
    if match:
        idx = int(match.group(1)) - 1
        if 0 <= idx < len(orders):
            return orders[idx]
    return None


def _do_cancel(db: Prisma, user_id: str, order: dict) -> dict:
    if order["status"] in ("ready", "completed"):
        return {"events": [], "text": f"Sorry, order **{order['orderNumber']}** is already {_status_label(order['status'])} and can't be cancelled."}
    if order["status"] == "preparing":
        return {"events": [], "text": f"Sorry, order **{order['orderNumber']}** is already being prepared and can't be cancelled."}
    updated = order_service.update_order_status(db, order["id"], "cancelled")
    return {"events": [("orderCancelled", {"order": updated})], "text": f"✅ Cancelled order **{updated['orderNumber']}**."}


def _resolve_pending(db: Prisma, user_id: str, pending: dict, message: str) -> dict | None:
    """Try to answer the previous question. Returns None when the message is
    not an answer (the caller then classifies it as a fresh intent)."""
    kind = pending["kind"]
    payload = pending["payload"]

    if kind == "payment":
        method = _extract_payment_method(message)
        if method is not None:
            _clear_pending(user_id)
            if payload.get("from_cart"):
                return _execute_confirm(db, user_id, payload, method)
            return _execute_create(db, user_id, payload, method)
        seg = _norm(message)
        if seg.split() and seg.split()[0] in ("cancel", "drop", "nahi", "no"):
            _clear_pending(user_id)
            return {"events": [], "text": "Alright, I've dropped that order. Let me know if you'd like something else."}
        return {"events": [], "text": "I still need a payment method — **upi**, **card**, **cash**, or **wallet**?"}

    if kind == "pick":
        mentions = payload["mentions"]
        action = payload.get("action", "create")
        mention = mentions[0]
        # A fresh order command beats the stale pick prompt.
        if _classify(message, _parse_mentions(message, _load_db_menu(db))) is not None:
            return None
        choice = _resolve_pick_choice(message, mention["candidates"])
        if choice is None:
            return {"events": [], "text": "Reply with a number or a menu item name to pick."}
        mention["chosen"] = choice
        unresolved = [m for m in mentions if m["chosen"] is None and not m["unknown"]]
        if unresolved:
            _set_pending(user_id, "pick", {"mentions": mentions, "action": action})
            return {"events": [], "text": _ask_which(unresolved[0])}
        _clear_pending(user_id)
        if action == "add":
            return _execute_add(db, user_id, mentions)
        if action == "create":
            _set_pending(user_id, "payment", {"mentions": mentions, "source": payload.get("source", "")})
            return {"events": [], "text": _build_payment_question(mentions, [])}
        return {"events": [], "text": "Alright."}

    if kind == "cancel_pick":
        orders = payload["orders"]
        # A fresh order command beats the stale cancel prompt.
        if _classify(message, _parse_mentions(message, _load_db_menu(db))) is not None:
            return None
        target = _cancel_pick_target(message, orders)
        if target is None:
            return {"events": [], "text": "Reply with the number of the order you'd like to cancel."}
        _clear_pending(user_id)
        return _do_cancel(db, user_id, target)

    return None


# ------------------------------------------------------------------ main

def handle_order_intent(
    db: Prisma,
    user_id: str,
    message: str,
) -> dict | None:
    """Handle an order message. Returns ``{events, text}`` when handled, or
    ``None`` to let the caller continue with the legacy flow / Gemini."""
    menu = _load_db_menu(db)
    if not menu:
        return {"events": [], "text": "Sorry, the menu isn't available right now."}

    pending = _get_pending(user_id)
    if pending is not None:
        resolved = _resolve_pending(db, user_id, pending, message)
        if resolved is not None:
            return resolved
        # Message isn't an answer to the pending question — re-classify as a
        # fresh intent, replacing the pending state if it is one.
        mentions = _parse_mentions(message, menu)
        action = _classify(message, mentions)
        if action is None:
            if pending["kind"] == "payment":
                return {"events": [], "text": "I still need a payment method — **upi**, **card**, **cash**, or **wallet**?"}
            return None
        _clear_pending(user_id)
    else:
        mentions = _parse_mentions(message, menu)
        action = _classify(message, mentions)

    if action is None:
        return None

    return _run_action(db, user_id, action, mentions, message)


def _run_action(
    db: Prisma,
    user_id: str,
    action: str,
    mentions: list[dict],
    message: str,
) -> dict:
    if action in ("create", "add"):
        unresolved = [m for m in mentions if m["chosen"] is None and not m["unknown"]]
        if unresolved:
            first = unresolved[0]
            if first["category"] and not first["candidates"]:
                return {"events": [], "text": f"Sorry, there are no {first['category'].lower()} available right now."}
            _set_pending(user_id, "pick", {"mentions": mentions, "action": action, "source": message})
            return {"events": [], "text": _ask_which(first)}
        items, _unavailable, _unknown = _resolve_mentions(mentions)
        if not items:
            note = " ".join(_unavailable + _unknown)
            return {"events": [], "text": "Sorry, I couldn't find anything available to order." + (f" {note}" if note else "")}
        if action == "add":
            return _execute_add(db, user_id, mentions)
        _set_pending(user_id, "payment", {"mentions": mentions, "source": message})
        return {"events": [], "text": _build_payment_question(mentions, [])}

    if action == "remove":
        return _execute_remove(db, user_id, mentions)
    if action == "update_qty":
        return _execute_update_qty(db, user_id, mentions)
    if action == "customize":
        return _execute_customize(db, user_id, mentions)
    if action == "view_cart":
        return _execute_view_cart(db, user_id)
    if action == "clear_cart":
        return _execute_clear(db, user_id)
    if action == "status":
        return _execute_status(db, user_id, message)
    if action == "cancel":
        return _execute_cancel(db, user_id, message, mentions)
    if action == "repeat":
        return _execute_repeat(db, user_id, message)
    if action == "confirm":
        cart = order_service.get_cart(db, user_id)
        if not cart:
            return {"events": [], "text": "Your cart is empty — tell me what you'd like and I'll add it first."}
        lines = ["I've got your order ready:\n" + _summary([
            {"quantity": i["quantity"], "name": i["name"], "unitPrice": i["unitPrice"]} for i in cart
        ])]
        lines.append(
            "\nHow would you like to pay — **upi**, **card**, **cash**, or **wallet**? "
            "(reply with the method, or type *cancel* to drop this order)"
        )
        _set_pending(user_id, "payment", {"mentions": [], "from_cart": True, "source": message})
        return {"events": [], "text": "\n".join(lines)}

    return {"events": [], "text": "Sorry, I didn't catch that."}
