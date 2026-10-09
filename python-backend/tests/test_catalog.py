import uuid

from fastapi.testclient import TestClient

from app.auth import create_access_token
from app.main import app

client = TestClient(app)


def auth_header(workspace_id: str, role: str = "ADMIN") -> dict[str, str]:
    token = create_access_token(
        user_id=f"usr_{workspace_id}",
        email=f"merchant@{workspace_id}.org",
        workspace_id=workspace_id,
        role=role
    )
    return {"Authorization": f"Bearer {token}"}


def test_health_check_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HEALTHY"
    assert "timestamp" in data
    assert "X-Request-ID" in res.headers


def test_ready_check_endpoint():
    res = client.get("/ready")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "READY"
    assert data["database"] == "CONNECTED"


def test_unknown_product_returns_404_on_order_creation():
    """Verify that unknown product IDs return 404 and NEVER fall back to default price or fake product."""
    ws = f"ws_brand_{uuid.uuid4().hex[:8]}"
    unknown_id = f"prod_nonexistent_{uuid.uuid4().hex[:8]}"
    res = client.post(
        "/api/v1/commerce/orders",
        headers=auth_header(ws),
        json={
            "productId": unknown_id,
            "quantity": 1,
            "customerEmail": "buyer@teststore.org"
        }
    )
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_unknown_product_returns_404_on_razorpay_order():
    """Verify that razorpay create-order returns 404 on unknown products."""
    ws = f"ws_brand_{uuid.uuid4().hex[:8]}"
    unknown_id = f"prod_nonexistent_{uuid.uuid4().hex[:8]}"
    res = client.post(
        "/api/v1/commerce/razorpay/create-order",
        headers=auth_header(ws),
        json={
            "productId": unknown_id,
            "quantity": 2
        }
    )
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_real_product_creation_and_order_lifecycle():
    """Verify creating a real product with a specific price and placing an order with exact price calculation."""
    unique_ws = f"ws_brand_{uuid.uuid4().hex[:8]}"
    prod_res = client.post(
        "/api/v1/commerce/products",
        headers=auth_header(unique_ws),
        json={
            "title": "Industrial Canvas Tote",
            "description": "Heavyweight organic cotton tote bag",
            "price": 1450.0,
            "category": "Accessories",
            "inventory": 25,
            "sku": "ICT-NATURAL-01"
        }
    )
    assert prod_res.status_code == 200
    prod_data = prod_res.json()["product"]
    prod_id = prod_data["id"]
    assert prod_data["price"] == 1450.0

    # Retrieve products for workspace
    get_res = client.get("/api/v1/commerce/products", headers=auth_header(unique_ws))
    assert get_res.status_code == 200
    catalog = get_res.json()
    assert catalog["total"] == 1
    assert catalog["products"][0]["title"] == "Industrial Canvas Tote"

    # Place order for 3 units -> total must be exactly 3 * 1450.0 = 4350.0 (NO 999.0 fallback!)
    order_res = client.post(
        "/api/v1/commerce/orders",
        headers=auth_header(unique_ws),
        json={
            "productId": prod_id,
            "quantity": 3,
            "customerName": "Rohan Sharma",
            "customerEmail": "rohan.sharma@teststore.org",
            "shippingAddress": "42 MG Road, Bengaluru"
        }
    )
    assert order_res.status_code == 200
    order_data = order_res.json()["order"]
    assert order_data["total_amount"] == 4350.0
    assert order_data["customer_email"] == "rohan.sharma@teststore.org"

    # Retrieve order by order number
    ord_num = order_data["order_number"].lstrip("#")
    fetch_ord = client.get(
        f"/api/v1/commerce/orders?order_number={ord_num}&customer_email=rohan.sharma@teststore.org",
        headers=auth_header(unique_ws)
    )
    assert fetch_ord.status_code == 200
    assert fetch_ord.json()["order"]["total_amount"] == 4350.0


def test_commerce_sync_returns_real_metrics_and_not_configured():
    """Verify that sync status returns real database counts and 'not configured' for unconfigured connectors."""
    ws = f"ws_brand_{uuid.uuid4().hex[:8]}"
    res = client.get("/api/v1/commerce/sync", headers=auth_header(ws, "VIEWER"))
    assert res.status_code == 200
    data = res.json()
    assert "metrics" in data
    assert "productsCount" in data["metrics"]
    assert "ordersCount" in data["metrics"]
    assert isinstance(data["metrics"]["productsCount"], int)
    assert isinstance(data["metrics"]["ordersCount"], int)

    # Must NOT contain hardcoded fake activeConnectors: 5 or '100% OPERATIONAL'
    sync_ts = data["syncTimestamps"]
    assert sync_ts.get("shopify_storefront") in ("not configured", "CONNECTED", "ACTIVE")
    assert sync_ts.get("woocommerce") in ("not configured", "CONNECTED", "ACTIVE")


def test_storefront_order_lookup_redaction_and_security():
    """Verify storefront order lookups require email, return 404 on mismatch, and redact PII."""
    import asyncio

    from app.db.database import async_session_factory
    from app.db.models import DeploymentModel

    ws = f"ws_brand_{uuid.uuid4().hex[:8]}"
    dep_key = f"dep_key_{uuid.uuid4().hex[:8]}"

    # Setup deployment
    async def _setup_deployment():
        async with async_session_factory() as session:
            dep = DeploymentModel(
                id=f"dep_{uuid.uuid4().hex[:8]}",
                workspace_id=ws,
                name="Storefront Order Test",
                status="LIVE",
                public_key=dep_key
            )
            session.add(dep)
            await session.commit()

    asyncio.run(_setup_deployment())

    # Create product and order
    prod_res = client.post(
        "/api/v1/commerce/products",
        headers=auth_header(ws),
        json={"title": "Test Watch", "price": 5000.0, "category": "Watches"}
    )
    prod_id = prod_res.json()["product"]["id"]

    order_res = client.post(
        "/api/v1/commerce/orders",
        headers=auth_header(ws),
        json={
            "productId": prod_id,
            "quantity": 1,
            "customerName": "Alice Secret",
            "customerEmail": "alice@secret.org",
            "shippingAddress": "123 Classified St, Mumbai"
        }
    )
    order_data = order_res.json()["order"]
    ord_num = order_data["order_number"].lstrip("#")

    # 1. Missing customer_email via storefront key -> 400
    res_no_email = client.get(
        f"/api/v1/commerce/orders?order_number={ord_num}",
        headers={"X-Deployment-Key": dep_key}
    )
    assert res_no_email.status_code == 400

    # 2. Wrong customer_email via storefront key -> 404
    res_wrong_email = client.get(
        f"/api/v1/commerce/orders?order_number={ord_num}&customer_email=wrong@hacker.org",
        headers={"X-Deployment-Key": dep_key}
    )
    assert res_wrong_email.status_code == 404

    # 3. Correct order_number + customer_email via storefront key -> 200 with REDACTED PII
    res_valid_storefront = client.get(
        f"/api/v1/commerce/orders?order_number={ord_num}&customer_email=alice@secret.org",
        headers={"X-Deployment-Key": dep_key}
    )
    assert res_valid_storefront.status_code == 200
    sf_order = res_valid_storefront.json()["order"]
    assert sf_order["order_number"] == order_data["order_number"]
    assert sf_order["total_amount"] == 5000.0
    # Customer PII must NOT be present
    assert "customer_name" not in sf_order
    assert "customer_email" not in sf_order
    assert "shipping_address" not in sf_order

    # 4. Merchant lookup with JWT -> Full data including PII
    res_merchant = client.get(
        f"/api/v1/commerce/orders?order_number={ord_num}",
        headers=auth_header(ws)
    )
    assert res_merchant.status_code == 200
    m_order = res_merchant.json()["order"]
    assert m_order["customer_name"] == "Alice Secret"
    assert m_order["customer_email"] == "alice@secret.org"
    assert m_order["shipping_address"] == "123 Classified St, Mumbai"


def test_post_knowledge_and_retrieve_via_chat():
    """Verify that posting knowledge saves it strictly under tenant auth context and RAG chat retrieves it."""
    ws = f"ws_brand_{uuid.uuid4().hex[:8]}"

    # 1. Create a deployment key so storefront chat can query this workspace
    dep_res = client.post(
        "/api/v1/ai-mode/deployments",
        headers=auth_header(ws),
        json={"name": "Test Storefront"}
    )
    assert dep_res.status_code == 200
    dep_key = dep_res.json()["deployment"]["public_key"]

    # 2. Add knowledge using POST /api/v1/ai-mode/knowledge
    # Even if client tries to pass workspace_id="ws_hacker", the endpoint binds to auth.workspace_id (ws)
    know_res = client.post(
        "/api/v1/ai-mode/knowledge",
        headers=auth_header(ws),
        json={
            "name": "Shipping and Returns Guide",
            "content": "All orders ship with 48-hour delivery across Mumbai and Bangalore. Free returns within 14 days.",
            "type": "DOCUMENTS",
            "workspace_id": "ws_malicious_target"
        }
    )
    assert know_res.status_code == 200
    source = know_res.json()["source"]
    assert source["workspace_id"] == ws
    assert source["name"] == "Shipping and Returns Guide"

    # 3. Chat with storefront key asking about returns
    chat_res = client.post(
        "/api/v1/ai-mode/chat",
        headers={"X-Deployment-Key": dep_key},
        json={
            "user_message": "What is the return window for Mumbai?",
            "workspace_id": ws
        }
    )
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert chat_data["workspace_id"] == ws
    # Check that citations retrieved the posted document
    citations = chat_data.get("citations", [])
    assert len(citations) > 0
    assert any("Shipping and Returns Guide" in c["document_name"] for c in citations)
    assert any("Free returns within 14 days" in c["chunk_text"] for c in citations)


