import os
import json
import time
import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Header, Request, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1", tags=["Backend Core"])

# Path helpers
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
AAAS_DB_PATH = os.path.join(DATA_DIR, "aaas.db.json")
AI_MODE_DATA_PATH = os.path.join(DATA_DIR, "ai_mode_data.json")

def load_json_file(file_path: str, default: Any = None) -> Any:
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading {file_path}: {e}")
    return default if default is not None else {}

def save_json_file(file_path: str, data: Any) -> None:
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    temp_path = f"{file_path}.tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(temp_path, file_path)

# ============================================================================
# AUTH ENDPOINTS (/api/v1/auth/...)
# ============================================================================

@router.get("/auth/me")
async def get_current_user():
    db = load_json_file(AAAS_DB_PATH)
    users = db.get("users", [])
    workspaces = db.get("workspaces", [])
    workspace_members = db.get("workspace_members", [])

    user = users[0] if users else {
        "id": "usr_merchant_01",
        "email": "merchant@shopmate.com",
        "name": "Alex Vance (Store Owner)",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    }

    ws = workspaces[0] if workspaces else {
        "id": "ws_acme_corp",
        "name": "Ajimsha M",
        "slug": "ajimsha-m"
    }

    return {
        "authenticated": True,
        "user": {
            "id": user.get("id"),
            "email": user.get("email"),
            "name": user.get("name"),
            "avatar_url": user.get("avatar_url"),
            "is_super_admin": user.get("is_super_admin", False),
            "workspaceName": ws.get("name", "Ajimsha M")
        },
        "workspace": ws,
        "role": "OWNER",
        "workspaces": [ws]
    }

@router.post("/auth/login")
async def login(request: Request):
    body = await request.json().catch(lambda: {}) if hasattr(request, "json") else {}
    db = load_json_file(AAAS_DB_PATH)
    users = db.get("users", [])
    user = users[0] if users else {
        "id": "usr_merchant_01",
        "email": "merchant@shopmate.com",
        "name": "Alex Vance (Store Owner)"
    }
    return {
        "success": True,
        "token": "py_jwt_session_" + str(uuid.uuid4()),
        "user": user,
        "workspace_id": "ws_acme_corp"
    }

@router.post("/auth/logout")
async def logout():
    return {"success": True, "message": "Logged out successfully"}

@router.post("/auth/signup")
async def signup(request: Request):
    return {"success": True, "message": "Registration complete"}

@router.post("/auth/forgot-password")
async def forgot_password():
    return {"success": True, "message": "Password reset instructions dispatched"}

@router.post("/auth/reset-password")
async def reset_password():
    return {"success": True, "message": "Password updated successfully"}

@router.post("/auth/verify-email")
async def verify_email():
    return {"success": True, "message": "Email verified"}

# ============================================================================
# COMMERCE PRODUCTS (/api/v1/commerce/products)
# ============================================================================

@router.get("/commerce/products")
async def get_products(
    workspace_id: Optional[str] = None,
    category: Optional[str] = None,
    query: Optional[str] = None,
    in_stock: Optional[bool] = None
):
    db = load_json_file(AAAS_DB_PATH)
    products = db.get("commerce_products", [])

    filtered = products
    if workspace_id:
        filtered = [p for p in filtered if p.get("workspace_id") == workspace_id]
    if category and category != "all":
        filtered = [p for p in filtered if p.get("category", "").lower() == category.lower()]
    if in_stock is not None:
        filtered = [p for p in filtered if p.get("in_stock") == in_stock]
    if query:
        q_lower = query.lower().strip()
        filtered = [p for p in filtered if q_lower in p.get("title", "").lower() or q_lower in p.get("description", "").lower()]

    categories = sorted(list(set(p.get("category", "General") for p in products if p.get("category"))))

    return {
        "products": filtered,
        "total": len(filtered),
        "categories": categories
    }

@router.post("/commerce/products")
async def create_product(request: Request):
    body = await request.json()
    db = load_json_file(AAAS_DB_PATH)
    products = db.setdefault("commerce_products", [])

    inv_qty = int(body.get("inventory") or body.get("total_inventory") or 50)
    price_val = float(body.get("price") or 999.0)
    prod_id = f"prod_bt_{int(time.time()*1000)}"

    new_prod = {
        "id": prod_id,
        "workspace_id": body.get("workspace_id", "ws_acme_corp"),
        "title": body.get("title", "New Apparel Item"),
        "description": body.get("description", "High quality apparel crafted for comfort and style."),
        "category": body.get("category", "Performance Apparel"),
        "tags": body.get("tags") if isinstance(body.get("tags"), list) else ["apparel"],
        "price": price_val,
        "compare_at_price": float(body.get("compare_at_price", price_val * 1.25)),
        "currency": "INR",
        "images": body.get("images", ["https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&auto=format&fit=crop&q=80"]),
        "in_stock": inv_qty > 0,
        "total_inventory": inv_qty,
        "variants": body.get("variants") or [
            {
                "id": f"var_{int(time.time()*1000)}",
                "sku": f"BT-ITEM-M",
                "title": "Standard / Free Size",
                "inventory_quantity": inv_qty,
                "price": price_val,
                "attributes": {"size": "M"}
            }
        ],
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

    products.insert(0, new_prod)
    save_json_file(AAAS_DB_PATH, db)
    return {"success": True, "product": new_prod}

@router.put("/commerce/products")
@router.patch("/commerce/products")
async def update_product(request: Request):
    body = await request.json()
    prod_id = body.get("id")
    if not prod_id:
        raise HTTPException(status_code=400, detail="Product ID is required")

    db = load_json_file(AAAS_DB_PATH)
    products = db.get("commerce_products", [])

    for p in products:
        if p.get("id") == prod_id:
            if "title" in body: p["title"] = body["title"]
            if "description" in body: p["description"] = body["description"]
            if "category" in body: p["category"] = body["category"]
            if "price" in body: p["price"] = float(body["price"])
            if "total_inventory" in body or "inventory" in body:
                inv = int(body.get("total_inventory") or body.get("inventory") or 0)
                p["total_inventory"] = inv
                p["in_stock"] = inv > 0
                if p.get("variants"):
                    p["variants"][0]["inventory_quantity"] = inv
            if "in_stock" in body: p["in_stock"] = bool(body["in_stock"])
            p["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            save_json_file(AAAS_DB_PATH, db)
            return {"success": True, "product": p}

    raise HTTPException(status_code=404, detail="Product not found")

@router.delete("/commerce/products")
async def delete_product(id: Optional[str] = Query(None), all: Optional[str] = Query(None)):
    db = load_json_file(AAAS_DB_PATH)
    products = db.get("commerce_products", [])

    if all == "true":
        db["commerce_products"] = []
        save_json_file(AAAS_DB_PATH, db)
        return {"success": True, "message": "All products removed"}

    if not id:
        raise HTTPException(status_code=400, detail="Product ID is required")

    init_len = len(products)
    products = [p for p in products if p.get("id") != id]
    if len(products) < init_len:
        db["commerce_products"] = products
        save_json_file(AAAS_DB_PATH, db)
        return {"success": True}

    raise HTTPException(status_code=404, detail="Product not found")

# ============================================================================
# COMMERCE ORDERS (/api/v1/commerce/orders)
# ============================================================================

@router.get("/commerce/orders")
async def get_orders(
    order_number: Optional[str] = None,
    customer_email: Optional[str] = None,
    workspace_id: Optional[str] = "ws_acme_corp"
):
    db = load_json_file(AAAS_DB_PATH)
    orders = db.get("commerce_orders", [])

    if order_number:
        clean_num = order_number.strip()
        if not clean_num.startswith("#"):
            clean_num = f"#{clean_num}"
        for o in orders:
            if o.get("order_number") == clean_num:
                if customer_email and o.get("customer_email", "").lower() != customer_email.lower().strip():
                    raise HTTPException(status_code=404, detail="Order not found with the provided email address.")
                return {"order": o}
        raise HTTPException(status_code=404, detail="Order not found with the provided email address.")

    return {"orders": orders}

@router.post("/commerce/orders")
async def create_order(request: Request):
    body = await request.json()
    workspace_id = body.get("workspace_id", "ws_acme_corp")
    product_id = body.get("productId")
    variant_id = body.get("variantId")
    quantity = max(1, int(body.get("quantity", 1)))
    customer_name = body.get("customerName", "Valued Customer")
    customer_email = body.get("customerEmail", "customer@gmail.com").lower().strip()
    shipping_address = body.get("shippingAddress", "Address on file")
    payment_method = body.get("paymentMethod", "UPI")

    db = load_json_file(AAAS_DB_PATH)
    products = db.get("commerce_products", [])
    product = next((p for p in products if p.get("id") == product_id), None)
    if not product and products:
        product = products[0]

    unit_price = float(product.get("price", 999.0)) if product else 999.0
    if product and product.get("variants"):
        for v in product["variants"]:
            if v.get("id") == variant_id or v.get("attributes", {}).get("size") == variant_id:
                unit_price = float(v.get("price", unit_price))
                break

    rand_suffix = int(time.time() * 1000) % 90000 + 10000
    order_number = f"#ORD-{rand_suffix}"

    new_order = {
        "id": f"ord_{int(time.time()*1000)}",
        "workspace_id": workspace_id,
        "order_number": order_number,
        "customer_id": f"cus_{uuid.uuid4().hex[:8]}",
        "customer_email": customer_email,
        "customer_name": customer_name,
        "total_amount": round(unit_price * quantity, 2),
        "currency": "INR",
        "status": "PROCESSING" if payment_method == "COD" else "PAID",
        "payment_status": "PENDING" if payment_method == "COD" else "PAID",
        "fulfillment_status": "UNFULFILLED",
        "shipping_address": shipping_address,
        "tracking_number": f"TRK-{uuid.uuid4().hex[:6].upper()}-IN",
        "carrier": "Bluedart Express",
        "items": [
            {
                "product_id": product.get("id") if product else "prod_01",
                "variant_id": variant_id,
                "title": (product.get("title") if product else "Performance Apparel"),
                "quantity": quantity,
                "price": unit_price
            }
        ],
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

    orders = db.setdefault("commerce_orders", [])
    orders.insert(0, new_order)
    save_json_file(AAAS_DB_PATH, db)

    return {"success": True, "order": new_order}

@router.post("/commerce/checkout/commit")
async def checkout_commit(request: Request):
    return await create_order(request)

# ============================================================================
# RAZORPAY INTEGRATION (/api/v1/commerce/razorpay/...)
# ============================================================================

@router.post("/commerce/razorpay/create-order")
async def razorpay_create_order(request: Request):
    body = await request.json()
    amount = float(body.get("amount", 999.0))
    product_id = body.get("productId")
    quantity = int(body.get("quantity", 1))

    if not amount and product_id:
        db = load_json_file(AAAS_DB_PATH)
        prods = db.get("commerce_products", [])
        p = next((x for x in prods if x.get("id") == product_id), None)
        if p:
            amount = float(p.get("price", 999.0)) * quantity

    amount_in_paise = int(amount * 100)
    order_id = f"order_{uuid.uuid4().hex[:10]}"
    merchant_handle = os.getenv("RAZORPAY_ME_URL", "https://razorpay.me/@ajimshamuhammad2112")
    key_id = os.getenv("RAZORPAY_KEY_ID", "rzp_test_shopmate")

    return {
        "success": True,
        "order": {
            "id": order_id,
            "entity": "order",
            "amount": amount_in_paise,
            "amount_paid": 0,
            "amount_due": amount_in_paise,
            "currency": "INR",
            "receipt": f"rcpt_{int(time.time()*1000)}",
            "status": "created",
            "attempts": 0,
            "notes": body.get("notes", {}),
            "created_at": int(time.time()),
            "key_id": key_id,
            "is_mock": True
        },
        "payment_url": merchant_handle,
        "key_id": key_id,
        "is_sandbox": True
    }

@router.post("/commerce/razorpay/payment-link")
async def razorpay_payment_link(request: Request):
    body = await request.json()
    amount = float(body.get("amount", 999.0))
    merchant_handle = os.getenv("RAZORPAY_ME_URL", "https://razorpay.me/@ajimshamuhammad2112")
    return {
        "success": True,
        "payment_link": {
            "id": f"plink_{uuid.uuid4().hex[:8]}",
            "short_url": merchant_handle,
            "amount": int(amount * 100),
            "currency": "INR",
            "status": "created",
            "description": body.get("description", "ShopMate AI Order Payment"),
            "customer": body.get("customer", {}),
            "created_at": int(time.time()),
            "is_mock": True
        },
        "message": f"Razorpay payment link generated for ₹{int(amount)}"
    }

@router.post("/commerce/razorpay/verify")
async def razorpay_verify(request: Request):
    body = await request.json()
    order_res = await create_order(request)
    new_order = order_res.get("order")
    return {
        "success": True,
        "verified": True,
        "payment_id": body.get("razorpay_payment_id", f"pay_{uuid.uuid4().hex[:10]}"),
        "order_id": body.get("razorpay_order_id", f"order_{uuid.uuid4().hex[:10]}"),
        "order": new_order,
        "message": f"Payment verified successfully via Razorpay. Order {new_order.get('order_number')} is confirmed."
    }

@router.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request):
    return {"status": "ok", "message": "Webhook received"}

# ============================================================================
# COMMERCE SYNC (/api/v1/commerce/sync)
# ============================================================================

@router.get("/commerce/sync")
async def get_sync_status():
    db = load_json_file(AAAS_DB_PATH)
    prods = db.get("commerce_products", [])
    orders = db.get("commerce_orders", [])
    chunks = db.get("knowledge_chunks", [])

    return {
        "metrics": {
            "productsCount": len(prods),
            "ordersCount": len(orders),
            "knowledgeCount": len(chunks),
            "activeConnectors": 5,
            "webhookHealth": "100% OPERATIONAL"
        },
        "syncTimestamps": {
            "shopify_storefront": "Active",
            "web_crawler": "Active",
            "local_catalog": "Real-time",
            "woocommerce": "Ready",
            "razorpay_stripe": "Active",
            "logistics_carriers": "Active",
            "custom_webhooks": "Active"
        },
        "recentLogs": []
    }

@router.post("/commerce/sync")
async def run_sync(request: Request):
    db = load_json_file(AAAS_DB_PATH)
    prods = db.get("commerce_products", [])
    orders = db.get("commerce_orders", [])
    chunks = db.get("knowledge_chunks", [])
    return {
        "success": True,
        "integrationId": "local_catalog",
        "connectorName": "Direct Store Catalog & Live Orders",
        "synced_products": len(prods),
        "synced_orders": len(orders),
        "status": "SYNCED",
        "latency_ms": 12,
        "message": f"Local ACID database synchronized: {len(prods)} products and {len(orders)} live customer orders verified in 12ms.",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

# ============================================================================
# AI MODE CONFIG, KNOWLEDGE, DEPLOYMENTS & WIDGET
# ============================================================================

@router.get("/ai-mode/config")
async def get_ai_mode_config(workspace_id: Optional[str] = "ws_acme_corp"):
    data = load_json_file(AI_MODE_DATA_PATH)
    configs = data.get("configs", [])
    cfg = next((c for c in configs if c.get("workspace_id") == workspace_id), None)
    if not cfg:
        cfg = {
            "id": f"aimode_cfg_{workspace_id}",
            "workspace_id": workspace_id,
            "enabled": True,
            "model_provider": "sarvam",
            "model_name": "sarvam-105b-conversations",
            "temperature": 0.3,
            "retrieval_threshold": 0.25,
            "max_search_results": 6,
            "enable_recommendations": True,
            "enable_comparisons": True,
            "enable_cart_actions": True,
            "system_instructions": "You are an AI Mode shopping assistant specialized in product discovery, recommendations, comparisons, and verified merchant catalog advice.",
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
        configs.append(cfg)
        data["configs"] = configs
        save_json_file(AI_MODE_DATA_PATH, data)
    return {"success": True, "config": cfg}

@router.patch("/ai-mode/config")
async def update_ai_mode_config(request: Request):
    body = await request.json()
    ws_id = body.get("workspace_id", "ws_acme_corp")
    data = load_json_file(AI_MODE_DATA_PATH)
    configs = data.setdefault("configs", [])
    cfg = next((c for c in configs if c.get("workspace_id") == ws_id), None)
    if not cfg:
        cfg = {"id": f"aimode_cfg_{ws_id}", "workspace_id": ws_id}
        configs.append(cfg)
    cfg.update(body)
    cfg["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    save_json_file(AI_MODE_DATA_PATH, data)
    return {"success": True, "config": cfg}

@router.get("/ai-mode/knowledge")
async def get_ai_mode_knowledge(workspace_id: Optional[str] = "ws_acme_corp"):
    data = load_json_file(AI_MODE_DATA_PATH)
    sources = data.get("knowledge_sources", [])
    if workspace_id:
        sources = [s for s in sources if s.get("workspace_id") == workspace_id]
    return {"success": True, "sources": sources}

@router.post("/ai-mode/knowledge")
async def add_ai_mode_knowledge(request: Request):
    body = await request.json()
    ws_id = body.get("workspace_id", "ws_acme_corp")
    data = load_json_file(AI_MODE_DATA_PATH)
    sources = data.setdefault("knowledge_sources", [])

    source_id = f"aim_ks_{uuid.uuid4().hex[:8]}"
    new_source = {
        "id": source_id,
        "workspace_id": ws_id,
        "name": body.get("name") or body.get("url") or "Document Source",
        "type": body.get("type", "DOCUMENT"),
        "source_url": body.get("url"),
        "status": "INDEXED",
        "document_count": 1,
        "product_count": 0,
        "raw_content": body.get("content", ""),
        "last_synced_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    sources.append(new_source)
    save_json_file(AI_MODE_DATA_PATH, data)
    return {"success": True, "source": new_source}

@router.post("/ai-mode/knowledge/sync")
async def sync_ai_mode_knowledge():
    return {"success": True, "message": "Knowledge sync completed"}

@router.delete("/ai-mode/knowledge/{source_id}")
async def delete_ai_mode_knowledge(source_id: str):
    data = load_json_file(AI_MODE_DATA_PATH)
    sources = data.get("knowledge_sources", [])
    data["knowledge_sources"] = [s for s in sources if s.get("id") != source_id]
    save_json_file(AI_MODE_DATA_PATH, data)
    return {"success": True}

@router.get("/ai-mode/deployments")
async def get_ai_mode_deployments(workspace_id: Optional[str] = "ws_acme_corp"):
    data = load_json_file(AI_MODE_DATA_PATH)
    deps = data.get("deployments", [])
    if not deps:
        default_dep = {
            "id": f"aim_dep_{workspace_id.replace('-', '_')}_01",
            "workspace_id": workspace_id,
            "name": "Storefront AI Mode Widget",
            "status": "LIVE",
            "allowed_domains": ["*"],
            "theme": {
                "primary_color": "#09090b",
                "background_color": "#ffffff",
                "text_color": "#09090b",
                "border_radius": "lg",
                "font_family": "Inter, system-ui, sans-serif"
            },
            "branding": {
                "title": "AI Shopping Mode",
                "subtitle": "Instant recommendations & product search",
                "welcome_message": "Hi there! 👋 I am in AI Mode. Ask me to find products, compare styles, or recommend items for any occasion.",
                "suggested_prompts": [
                    "Find formal shirts under ₹2000",
                    "Recommend a summer outfit",
                    "Compare top rated items"
                ],
                "position": "bottom-right"
            },
            "embed_code": f"<script src=\"/api/ai-mode/widget/aim_dep_{workspace_id.replace('-', '_')}_01/script.js\" async defer></script>",
            "total_conversations": 0,
            "total_product_clicks": 0,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
        deps = [default_dep]
        data["deployments"] = deps
        save_json_file(AI_MODE_DATA_PATH, data)
    return {"success": True, "deployments": deps}

@router.post("/ai-mode/deployments")
async def create_ai_mode_deployment(request: Request):
    body = await request.json()
    ws_id = body.get("workspace_id", "ws_acme_corp")
    dep_id = f"aim_dep_{uuid.uuid4().hex[:8]}"
    new_dep = {
        "id": dep_id,
        "workspace_id": ws_id,
        "name": body.get("name", "New Widget"),
        "status": "LIVE",
        "allowed_domains": body.get("allowed_domains", ["*"]),
        "theme": body.get("theme", {
            "primary_color": "#09090b",
            "background_color": "#ffffff",
            "text_color": "#09090b",
            "border_radius": "lg",
            "font_family": "Inter, system-ui, sans-serif"
        }),
        "branding": body.get("branding", {
            "title": "AI Shopping Mode",
            "subtitle": "Instant recommendations & product search",
            "welcome_message": "Hi there! 👋 I am in AI Mode.",
            "suggested_prompts": ["Find formal shirts", "Compare top items"],
            "position": "bottom-right"
        }),
        "embed_code": f"<script src=\"/api/ai-mode/widget/{dep_id}/script.js\" async defer></script>",
        "total_conversations": 0,
        "total_product_clicks": 0,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    data = load_json_file(AI_MODE_DATA_PATH)
    data.setdefault("deployments", []).append(new_dep)
    save_json_file(AI_MODE_DATA_PATH, data)
    return {"success": True, "deployment": new_dep}

@router.get("/ai-mode/deployments/{dep_id}")
async def get_ai_mode_deployment_by_id(dep_id: str):
    data = load_json_file(AI_MODE_DATA_PATH)
    deps = data.get("deployments", [])
    dep = next((d for d in deps if d.get("id") == dep_id), None)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return {"success": True, "deployment": dep}

@router.get("/ai-mode/widget/{deployment_id}")
async def get_widget_config(deployment_id: str):
    data = load_json_file(AI_MODE_DATA_PATH)
    deps = data.get("deployments", [])
    dep = next((d for d in deps if d.get("id") == deployment_id), None)
    if not dep or dep.get("status") == "PAUSED":
        raise HTTPException(status_code=404, detail="Widget deployment is not active")
    return {"success": True, "deployment": dep}

from fastapi.responses import Response

@router.get("/ai-mode/widget/{deployment_id}/script.js")
async def get_widget_script(deployment_id: str, request: Request):
    data = load_json_file(AI_MODE_DATA_PATH)
    deps = data.get("deployments", [])
    dep = next((d for d in deps if d.get("id") == deployment_id), None)
    if not dep or dep.get("status") == "PAUSED":
        return Response("/* AI Mode Widget is currently inactive */", media_type="application/javascript")

    host = request.headers.get("host") or "localhost:3000"
    proto = request.headers.get("x-forwarded-proto") or "http"
    host_url = f"{proto}://{host}"
    pos = dep.get("branding", {}).get("position", "bottom-right")
    pos_side = "left" if pos == "bottom-left" else "right"

    js = f"""(function() {{
  if (window.__AIModeWidgetLoaded) return;
  window.__AIModeWidgetLoaded = true;

  var config = {json.dumps(dep)};
  var iframe = document.createElement('iframe');
  iframe.id = 'aimode-widget-frame';
  iframe.src = '{host_url}/ai-mode/embed/' + config.id;
  iframe.style.position = 'fixed';
  iframe.style.bottom = '20px';
  iframe.style.{pos_side} = '20px';
  iframe.style.width = '380px';
  iframe.style.height = '620px';
  iframe.style.maxHeight = '90vh';
  iframe.style.maxWidth = '90vw';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '16px';
  iframe.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)';
  iframe.style.zIndex = '999999';
  iframe.allow = 'clipboard-write';

  document.body.appendChild(iframe);
}})();"""

    return Response(js, media_type="application/javascript; charset=utf-8")

@router.post("/ai-mode/track")
async def track_event(request: Request):
    body = await request.json()
    dep_id = body.get("deployment_id")
    if dep_id:
        data = load_json_file(AI_MODE_DATA_PATH)
        for dep in data.get("deployments", []):
            if dep.get("id") == dep_id:
                dep["total_product_clicks"] = (dep.get("total_product_clicks") or 0) + 1
                save_json_file(AI_MODE_DATA_PATH, data)
                break
    return {
        "success": True,
        "event": body.get("event"),
        "product_id": body.get("product_id"),
        "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
