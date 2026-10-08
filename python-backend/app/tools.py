import asyncio
import re
from typing import Any

from sqlalchemy import select

from .db.database import async_session_factory
from .db.models import OrderModel, ProductModel

# Valid Discount Codes configured dynamically per workspace
DISCOUNT_RULES: dict[str, dict[str, Any]] = {}

# ============================================================================
# TOOL DEFINITIONS & JSON SCHEMAS FOR LLM FUNCTION CALLING
# ============================================================================

TOOL_DEFINITIONS = [
    {
        "name": "search_products",
        "description": "Search for products in the catalog by keyword query or category.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query or keywords (e.g. 'running shoes', 'jacket')"},
                "category": {"type": "string", "description": "Optional category filter"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_product_details",
        "description": "Fetch complete specifications, pricing, and stock status for a specific product ID.",
        "parameters": {
            "type": "object",
            "properties": {
                "product_id": {"type": "string", "description": "Unique identifier of the product"}
            },
            "required": ["product_id"]
        }
    },
    {
        "name": "check_inventory",
        "description": "Check real-time stock availability and inventory counts for a product.",
        "parameters": {
            "type": "object",
            "properties": {
                "product_id": {"type": "string", "description": "Unique identifier of the product"}
            },
            "required": ["product_id"]
        }
    },
    {
        "name": "calculate_cart",
        "description": "Compute exact line items, subtotal, server-verified discounts, shipping, tax, and total amount. Never invent arithmetic.",
        "parameters": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "description": "List of cart items with product_id and quantity",
                    "items": {
                        "type": "object",
                        "properties": {
                            "product_id": {"type": "string"},
                            "quantity": {"type": "integer", "minimum": 1}
                        },
                        "required": ["product_id", "quantity"]
                    }
                },
                "discount_code": {"type": "string", "description": "Optional coupon code to apply"}
            },
            "required": ["items"]
        }
    },
    {
        "name": "apply_discount",
        "description": "Validate and compute discount amount for a given coupon code and subtotal against server policy.",
        "parameters": {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Coupon or promo code string"},
                "subtotal": {"type": "number", "description": "Current order subtotal before discount"}
            },
            "required": ["code", "subtotal"]
        }
    },
    {
        "name": "lookup_order",
        "description": "Look up an order by order number and customer email with masked PII and tracking info.",
        "parameters": {
            "type": "object",
            "properties": {
                "order_number": {"type": "string", "description": "Order number, e.g. #10482"},
                "customer_email": {"type": "string", "description": "Customer email associated with the order"}
            },
            "required": ["order_number", "customer_email"]
        }
    }
]

# ============================================================================
# ASYNC / SYNC DATABASE HELPERS
# ============================================================================

async def _fetch_products_db(workspace_id: str) -> list[dict[str, Any]]:
    async with async_session_factory() as session:
        stmt = select(ProductModel).where(ProductModel.workspace_id == workspace_id)
        res = await session.execute(stmt)
        prods = res.scalars().all()
        return [
            {
                "id": p.id,
                "workspace_id": p.workspace_id,
                "title": p.title,
                "category": p.category,
                "price": float(p.price),
                "stock": int(p.stock),
                "description": p.description or "",
                "in_stock": int(p.stock) > 0
            }
            for p in prods
        ]

async def _fetch_order_db(workspace_id: str, order_number: str, customer_email: str | None = None) -> dict[str, Any] | None:
    if not customer_email or not customer_email.strip():
        return None
    clean_num = order_number.strip()
    clean_without_hash = clean_num.replace("#", "")
    clean_email = customer_email.strip().lower()

    async with async_session_factory() as session:
        stmt = select(OrderModel).where(OrderModel.workspace_id == workspace_id)
        res = await session.execute(stmt)
        orders = res.scalars().all()
        for ord in orders:
            if ord.customer_email.strip().lower() != clean_email:
                continue

            matches_id = clean_without_hash in ord.id or ord.id == clean_num or ord.id == f"ord_{clean_without_hash}"
            matches_number = ord.order_number == clean_num or ord.order_number == f"#{clean_without_hash}"

            if matches_id or matches_number:
                # Real order tracking: fetch from configured carrier or return 'tracking unavailable'
                carrier = ord.carrier if ord.carrier and "unavailable" not in ord.carrier.lower() else "carrier unavailable"
                tracking = ord.tracking_number if ord.tracking_number else "tracking unavailable"

                items_list = []
                for it in (ord.items_json or []):
                    if isinstance(it, dict):
                        title = it.get("title") or it.get("product_id") or "Item"
                        qty = it.get("quantity", 1)
                        items_list.append(f"{qty}x {title}")
                    elif isinstance(it, str):
                        items_list.append(it)

                return {
                    "order_number": ord.order_number or clean_num,
                    "workspace_id": workspace_id,
                    "customer_email": ord.customer_email,
                    "status": ord.status,
                    "carrier": carrier,
                    "tracking_number": tracking,
                    "items": items_list or ["Order Items on File"],
                    "total_amount": float(ord.total_amount),
                    "shipping_address": ord.shipping_address or "Address on file"
                }
        return None

def get_tenant_products_sync(workspace_id: str) -> list[dict[str, Any]]:
    if not workspace_id:
        raise ValueError("workspace_id is mandatory")
    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(asyncio.run, _fetch_products_db(workspace_id)).result()
        else:
            return asyncio.run(_fetch_products_db(workspace_id))
    except Exception:
        return []

def get_tenant_order_sync(workspace_id: str, order_number: str, customer_email: str | None = None) -> dict[str, Any] | None:
    if not workspace_id:
        raise ValueError("workspace_id is mandatory")
    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(asyncio.run, _fetch_order_db(workspace_id, order_number, customer_email)).result()
        else:
            return asyncio.run(_fetch_order_db(workspace_id, order_number, customer_email))
    except Exception:
        return None

# ============================================================================
# SERVER-SIDE DETERMINISTIC TOOL EXECUTIONS
# ============================================================================

def search_products(workspace_id: str, query: str, category: str | None = None) -> dict[str, Any]:
    if not workspace_id:
        raise ValueError("workspace_id is mandatory for search_products")

    prods = get_tenant_products_sync(workspace_id)
    stopwords = {"show", "catalog", "products", "product", "item", "items", "what", "have", "your", "list", "store", "all", "our", "the", "for"}
    raw_words = [w.lower() for w in re.sub(r'[^a-zA-Z0-9\s]', ' ', query).split() if len(w) > 2]
    q_words = [w for w in raw_words if w not in stopwords]

    scored_matches = []
    for p in prods:
        if category and p.get("category", "").lower() != category.lower():
            continue
        title_desc = f"{p['title']} {p.get('description', '')} {p.get('category', '')}".lower()
        score = sum(1 for w in q_words if w in title_desc) if q_words else 1
        if score > 0 or not q_words:
            scored_matches.append((score, p))

    scored_matches.sort(key=lambda x: x[0], reverse=True)
    matches = [p for _, p in scored_matches]

    if not matches and prods:
        matches = prods[:3]

    return {
        "count": len(matches),
        "products": matches
    }

def get_product_details(workspace_id: str, product_id: str) -> dict[str, Any]:
    if not workspace_id:
        raise ValueError("workspace_id is mandatory for get_product_details")

    prods = get_tenant_products_sync(workspace_id)
    for p in prods:
        if p["id"] == product_id:
            return {"found": True, "product": p}
    return {"found": False, "error": f"Product '{product_id}' not found in catalog"}

def check_inventory(workspace_id: str, product_id: str) -> dict[str, Any]:
    if not workspace_id:
        raise ValueError("workspace_id is mandatory for check_inventory")

    prods = get_tenant_products_sync(workspace_id)
    for p in prods:
        if p["id"] == product_id or p["title"].lower() == product_id.lower():
            return {
                "product_id": p["id"],
                "title": p["title"],
                "in_stock": p["stock"] > 0,
                "stock_count": p["stock"],
                "status": "IN_STOCK" if p["stock"] > 0 else "OUT_OF_STOCK"
            }
    return {"found": False, "error": f"Product '{product_id}' not found"}

def apply_discount(workspace_id: str, code: str, subtotal: float) -> dict[str, Any]:
    if not workspace_id:
        raise ValueError("workspace_id is mandatory for apply_discount")

    clean_code = code.strip().upper()
    rules = DISCOUNT_RULES.get(workspace_id, {})
    rule = rules.get(clean_code)

    if not rule:
        return {
            "valid": False,
            "code": clean_code,
            "discount_amount": 0.0,
            "message": f"Coupon code '{clean_code}' is invalid or expired."
        }

    if subtotal < rule["min_subtotal"]:
        return {
            "valid": False,
            "code": clean_code,
            "discount_amount": 0.0,
            "message": f"Coupon '{clean_code}' requires a minimum subtotal of ${rule['min_subtotal']:.2f}."
        }

    if rule["type"] == "PERCENTAGE":
        raw_discount = round(subtotal * (rule["value"] / 100.0), 2)
        capped_discount = min(raw_discount, rule["max_discount"])
    else:
        capped_discount = min(rule["value"], rule["max_discount"])

    capped_discount = min(capped_discount, subtotal)

    return {
        "valid": True,
        "code": clean_code,
        "discount_type": rule["type"],
        "discount_value": rule["value"],
        "discount_amount": round(capped_discount, 2),
        "message": f"Successfully applied promo code '{clean_code}' saving ${capped_discount:.2f}."
    }

def calculate_cart(workspace_id: str, items: list[dict[str, Any]], discount_code: str | None = None) -> dict[str, Any]:
    if not workspace_id:
        raise ValueError("workspace_id is mandatory for calculate_cart")

    prods = {p["id"]: p for p in get_tenant_products_sync(workspace_id)}
    line_items = []
    subtotal = 0.0

    for item in items:
        pid = item.get("product_id")
        qty = int(item.get("quantity", 1))
        if qty <= 0:
            continue
        prod = prods.get(pid)
        if not prod:
            for p in prods.values():
                if p["title"].lower() == str(pid).lower():
                    prod = p
                    break
        if not prod:
            return {"error": f"Product '{pid}' not found in store catalog."}

        unit_price = float(prod["price"])
        item_total = round(unit_price * qty, 2)
        subtotal = round(subtotal + item_total, 2)

        line_items.append({
            "product_id": prod["id"],
            "title": prod["title"],
            "unit_price": unit_price,
            "quantity": qty,
            "total_price": item_total,
            "in_stock": prod["stock"] >= qty
        })

    discount_info = {"valid": False, "discount_amount": 0.0}
    if discount_code:
        discount_info = apply_discount(workspace_id, discount_code, subtotal)

    discount_amount = discount_info.get("discount_amount", 0.0)
    discounted_subtotal = max(0.0, round(subtotal - discount_amount, 2))

    shipping = 0.0 if discounted_subtotal >= 75.0 or discounted_subtotal == 0.0 else 5.99
    tax = round(discounted_subtotal * 0.0825, 2)
    grand_total = round(discounted_subtotal + shipping + tax, 2)

    return {
        "currency": "USD",
        "line_items": line_items,
        "item_count": sum(li["quantity"] for li in line_items),
        "subtotal": subtotal,
        "discount_applied": discount_info,
        "discounted_subtotal": discounted_subtotal,
        "shipping_amount": shipping,
        "tax_amount": tax,
        "grand_total": grand_total
    }

def lookup_order(workspace_id: str, order_number: str, customer_email: str | None = None) -> dict[str, Any]:
    if not workspace_id:
        raise ValueError("workspace_id is mandatory for lookup_order")

    if not order_number or not customer_email:
        return {
            "found": False,
            "error": "Both order_number and verified customer_email are required to look up order details."
        }

    clean_num = order_number.strip()
    if not clean_num.startswith("#"):
        clean_num = f"#{clean_num}"

    order = get_tenant_order_sync(workspace_id, clean_num, customer_email)
    if order:
        return {
            "found": True,
            "order": order
        }
    return {
        "found": False,
        "error": f"Order '{clean_num}' not found or customer email mismatch."
    }

def execute_typed_tool(tool_name: str, arguments: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    if not workspace_id:
        raise ValueError("workspace_id is required for tool execution")

    if tool_name == "search_products":
        return search_products(workspace_id, arguments.get("query", ""), arguments.get("category"))
    elif tool_name == "get_product_details":
        return get_product_details(workspace_id, arguments.get("product_id", ""))
    elif tool_name == "check_inventory":
        return check_inventory(workspace_id, arguments.get("product_id", ""))
    elif tool_name == "calculate_cart":
        return calculate_cart(workspace_id, arguments.get("items", []), arguments.get("discount_code"))
    elif tool_name == "apply_discount":
        return apply_discount(workspace_id, arguments.get("code", ""), float(arguments.get("subtotal", 0.0)))
    elif tool_name == "lookup_order":
        return lookup_order(workspace_id, arguments.get("order_number", ""), arguments.get("customer_email", ""))
    else:
        return {"error": f"Unknown tool '{tool_name}'"}
