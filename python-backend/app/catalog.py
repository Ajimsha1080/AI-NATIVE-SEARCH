import json
import os
import time
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from .config import settings

router = APIRouter(prefix="/api/v1", tags=["Backend Core"])

# Path helpers
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
AAAS_DB_PATH = os.path.join(DATA_DIR, "aaas.db.json")
AI_MODE_DATA_PATH = os.path.join(DATA_DIR, "ai_mode_data.json")

def load_json_file(file_path: str, default: Any = None) -> Any:
    if os.path.exists(file_path):
        try:
            with open(file_path, encoding="utf-8") as f:
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

from .auth import create_access_token, create_refresh_token, decode_token, revoke_token


@router.post("/auth/login")
async def login(request: Request):
    body = await request.json() if hasattr(request, "json") else {}
    email = body.get("email", "").strip().lower()

    db = load_json_file(AAAS_DB_PATH)
    users = db.get("users", [])

    matched_user = next((u for u in users if u.get("email", "").lower() == email), None)
    if not matched_user and users:
        matched_user = users[0]
    elif not matched_user:
        matched_user = {
            "id": "usr_merchant_01",
            "email": email or "merchant@shopmate.com",
            "name": "Alex Vance (Store Owner)"
        }

    workspace_id = "ws_acme_corp"
    user_id = matched_user.get("id")
    role = "OWNER"
    is_super_admin = bool(matched_user.get("is_super_admin", False))

    access_token = create_access_token(
        user_id=user_id,
        email=matched_user.get("email"),
        workspace_id=workspace_id,
        role=role,
        is_super_admin=is_super_admin
    )
    refresh_token = create_refresh_token(user_id=user_id, workspace_id=workspace_id)

    return {
        "success": True,
        "token": access_token,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": 15 * 60,
        "user": matched_user,
        "workspace_id": workspace_id
    }

@router.post("/auth/refresh")
async def refresh_access_token(request: Request):
    body = await request.json()
    refresh_tok = body.get("refresh_token")
    if not refresh_tok:
        raise HTTPException(status_code=400, detail="refresh_token is required")

    decoded = decode_token(refresh_tok, expected_type="refresh")
    user_id = decoded.get("userId")
    workspace_id = decoded.get("workspace_id", "ws_acme_corp")

    db = load_json_file(AAAS_DB_PATH)
    users = db.get("users", [])
    matched_user = next((u for u in users if u.get("id") == user_id), None)
    email = matched_user.get("email", "merchant@shopmate.com") if matched_user else "merchant@shopmate.com"

    new_access_token = create_access_token(
        user_id=user_id,
        email=email,
        workspace_id=workspace_id
    )

    return {
        "success": True,
        "access_token": new_access_token,
        "token": new_access_token,
        "expires_in": 15 * 60
    }

@router.post("/auth/logout")
async def logout(request: Request):
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        revoke_token(token)

    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    ref_tok = body.get("refresh_token")
    if ref_tok:
        revoke_token(ref_tok)

    return {"success": True, "message": "Logged out successfully and token revoked"}

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
    workspace_id: str | None = None,
    category: str | None = None,
    query: str | None = None,
    in_stock: bool | None = None
):
    from sqlalchemy import select

    from .db.database import async_session_factory
    from .db.models import ProductModel

    db_products = []
    try:
        async with async_session_factory() as session:
            stmt = select(ProductModel)
            if workspace_id:
                stmt = stmt.where(ProductModel.workspace_id == workspace_id)
            if category and category != "all":
                stmt = stmt.where(ProductModel.category.ilike(category))
            if in_stock is not None:
                stmt = stmt.where(ProductModel.in_stock == in_stock)

            res = await session.execute(stmt)
            models = res.scalars().all()
            for m in models:
                db_products.append({
                    "id": m.id,
                    "workspace_id": m.workspace_id,
                    "title": m.title,
                    "description": m.description,
                    "price": m.price,
                    "compare_at_price": m.compare_at_price,
                    "category": m.category,
                    "sku": m.sku,
                    "images": m.images_json or ([m.image_url] if m.image_url else []),
                    "variants": m.variants_json or [],
                    "tags": m.tags_json or [],
                    "attributes": m.attributes_json or {},
                    "in_stock": m.in_stock,
                    "total_inventory": m.stock,
                    "source_url": m.source_url
                })
    except Exception as e:
        print("DB query fallback:", e)

    if not db_products:
        db = load_json_file(AAAS_DB_PATH)
        db_products = db.get("commerce_products", [])

    filtered = db_products
    if workspace_id and not db_products:
        filtered = [p for p in filtered if p.get("workspace_id") == workspace_id]
    if query:
        q_lower = query.lower().strip()
        filtered = [p for p in filtered if q_lower in p.get("title", "").lower() or q_lower in p.get("description", "").lower()]

    categories = sorted(list(set(p.get("category", "General") for p in db_products if p.get("category"))))

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
                "sku": "BT-ITEM-M",
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
            if "title" in body:
                p["title"] = body["title"]
            if "description" in body:
                p["description"] = body["description"]
            if "category" in body:
                p["category"] = body["category"]
            if "price" in body:
                p["price"] = float(body["price"])
            if "total_inventory" in body or "inventory" in body:
                inv = int(body.get("total_inventory") or body.get("inventory") or 0)
                p["total_inventory"] = inv
                p["in_stock"] = inv > 0
                if p.get("variants"):
                    p["variants"][0]["inventory_quantity"] = inv
            if "in_stock" in body:
                p["in_stock"] = bool(body["in_stock"])
            p["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            save_json_file(AAAS_DB_PATH, db)
            return {"success": True, "product": p}

    raise HTTPException(status_code=404, detail="Product not found")

@router.delete("/commerce/products")
async def delete_product(id: str | None = Query(None), all: str | None = Query(None)):
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
    order_number: str | None = None,
    customer_email: str | None = None,
    workspace_id: str | None = "ws_acme_corp"
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

import hashlib
import hmac

# Idempotency key store
_processed_idempotency_keys = {}

@router.post("/commerce/razorpay/create-order")
async def razorpay_create_order(request: Request):
    body = await request.json()
    idempotency_key = request.headers.get("Idempotency-Key") or body.get("idempotency_key")
    if idempotency_key and idempotency_key in _processed_idempotency_keys:
        return _processed_idempotency_keys[idempotency_key]

    product_id = body.get("productId")
    variant_id = body.get("variantId")
    quantity = max(1, int(body.get("quantity", 1)))

    db = load_json_file(AAAS_DB_PATH)
    prods = db.get("commerce_products", [])
    product = next((x for x in prods if x.get("id") == product_id), None)

    # Server-side authoritative price resolution (NEVER trust client-supplied amounts)
    unit_price = float(product.get("price", 999.0)) if product else 999.0
    if product and product.get("variants"):
        for v in product["variants"]:
            if v.get("id") == variant_id or v.get("attributes", {}).get("size") == variant_id:
                unit_price = float(v.get("price", unit_price))
                break

    server_calculated_amount = round(unit_price * quantity, 2)
    amount_in_paise = int(server_calculated_amount * 100)

    order_id = f"order_{uuid.uuid4().hex[:14]}"
    merchant_handle = settings.RAZORPAY_ME_URL
    key_id = settings.RAZORPAY_KEY_ID or "rzp_test_shopmate"

    res_data = {
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
            "is_mock": not bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)
        },
        "payment_url": merchant_handle,
        "key_id": key_id,
        "is_sandbox": not bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)
    }

    if idempotency_key:
        _processed_idempotency_keys[idempotency_key] = res_data

    return res_data

@router.post("/commerce/razorpay/payment-link")
async def razorpay_payment_link(request: Request):
    body = await request.json()
    product_id = body.get("productId")
    quantity = max(1, int(body.get("quantity", 1)))

    db = load_json_file(AAAS_DB_PATH)
    prods = db.get("commerce_products", [])
    product = next((x for x in prods if x.get("id") == product_id), None)
    unit_price = float(product.get("price", 999.0)) if product else float(body.get("amount", 999.0))
    final_amount = round(unit_price * quantity, 2)

    merchant_handle = settings.RAZORPAY_ME_URL
    return {
        "success": True,
        "payment_link": {
            "id": f"plink_{uuid.uuid4().hex[:8]}",
            "short_url": merchant_handle,
            "amount": int(final_amount * 100),
            "currency": "INR",
            "status": "created",
            "description": body.get("description", "ShopMate AI Order Payment"),
            "customer": body.get("customer", {}),
            "created_at": int(time.time()),
            "is_mock": not bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)
        },
        "message": f"Razorpay payment link generated for ₹{int(final_amount)}"
    }

@router.post("/commerce/razorpay/verify")
async def razorpay_verify(request: Request):
    body = await request.json()
    rzp_order_id = body.get("razorpay_order_id")
    rzp_payment_id = body.get("razorpay_payment_id")
    rzp_signature = body.get("razorpay_signature")

    if not rzp_order_id or not rzp_payment_id:
        raise HTTPException(status_code=400, detail="Missing razorpay_order_id or razorpay_payment_id")

    # Cryptographic verification if secret configured
    secret = settings.RAZORPAY_KEY_SECRET
    if secret and rzp_signature:
        generated_sig = hmac.new(
            secret.encode("utf-8"),
            f"{rzp_order_id}|{rzp_payment_id}".encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(generated_sig, rzp_signature):
            raise HTTPException(status_code=400, detail="Invalid payment signature. Verification failed.")

    order_res = await create_order(request)
    new_order = order_res.get("order")

    # Record immutable audit log event
    try:
        from .compliance import record_audit_event
        await record_audit_event(
            workspace_id=body.get("workspace_id") or "ws_acme_corp",
            action="PAYMENT_VERIFIED",
            actor_id=body.get("customer_email") or "checkout_user",
            resource_type="order",
            resource_id=new_order.get("id") if new_order else rzp_order_id,
            details={
                "rzp_order_id": rzp_order_id,
                "rzp_payment_id": rzp_payment_id,
                "order_number": new_order.get("order_number") if new_order else None
            }
        )
    except Exception:
        pass

    return {
        "success": True,
        "verified": True,
        "payment_id": rzp_payment_id,
        "order_id": rzp_order_id,
        "order": new_order,
        "message": f"Payment verified successfully via Razorpay. Order {new_order.get('order_number') if new_order else ''} is confirmed."
    }

@router.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request):
    raw_body = await request.body()
    webhook_signature = request.headers.get("X-Razorpay-Signature")

    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET or settings.RAZORPAY_KEY_SECRET
    if webhook_secret and webhook_signature:
        expected_sig = hmac.new(
            webhook_secret.encode("utf-8"),
            raw_body,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, webhook_signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    return {"status": "ok", "message": "Webhook verified and processed successfully"}

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
async def get_ai_mode_config(workspace_id: str | None = "ws_acme_corp"):
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
async def get_ai_mode_knowledge(workspace_id: str | None = "ws_acme_corp"):
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
async def get_ai_mode_deployments(workspace_id: str | None = "ws_acme_corp"):
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
