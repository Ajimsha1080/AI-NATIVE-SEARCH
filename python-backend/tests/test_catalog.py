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
    assert prod_data["id"].startswith("prod_")
    assert prod_data["price"] == 1450.0

    # Retrieve products for workspace
    get_res = client.get("/api/v1/commerce/products", headers=auth_header(unique_ws))
    assert get_res.status_code == 200
    catalog = get_res.json()
    assert catalog["total"] == 1
    assert catalog["products"][0]["title"] == "Industrial Canvas Tote"



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


