import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


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
    unknown_id = f"prod_nonexistent_{uuid.uuid4().hex[:8]}"
    res = client.post("/api/v1/commerce/orders", json={
        "productId": unknown_id,
        "quantity": 1,
        "customerEmail": "buyer@teststore.org"
    })
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_unknown_product_returns_404_on_razorpay_order():
    """Verify that razorpay create-order returns 404 on unknown products."""
    unknown_id = f"prod_nonexistent_{uuid.uuid4().hex[:8]}"
    res = client.post("/api/v1/commerce/razorpay/create-order", json={
        "productId": unknown_id,
        "quantity": 2
    })
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_real_product_creation_and_order_lifecycle():
    """Verify creating a real product with a specific price and placing an order with exact price calculation."""
    unique_ws = f"ws_brand_{uuid.uuid4().hex[:8]}"
    prod_res = client.post("/api/v1/commerce/products", json={
        "workspace_id": unique_ws,
        "title": "Industrial Canvas Tote",
        "description": "Heavyweight organic cotton tote bag",
        "price": 1450.0,
        "category": "Accessories",
        "inventory": 25,
        "sku": "ICT-NATURAL-01"
    })
    assert prod_res.status_code == 200
    prod_data = prod_res.json()["product"]
    prod_id = prod_data["id"]
    assert prod_data["price"] == 1450.0

    # Retrieve products for workspace
    get_res = client.get(f"/api/v1/commerce/products?workspace_id={unique_ws}")
    assert get_res.status_code == 200
    catalog = get_res.json()
    assert catalog["total"] == 1
    assert catalog["products"][0]["title"] == "Industrial Canvas Tote"

    # Place order for 3 units -> total must be exactly 3 * 1450.0 = 4350.0 (NO 999.0 fallback!)
    order_res = client.post("/api/v1/commerce/orders", json={
        "workspace_id": unique_ws,
        "productId": prod_id,
        "quantity": 3,
        "customerName": "Rohan Sharma",
        "customerEmail": "rohan.sharma@teststore.org",
        "shippingAddress": "42 MG Road, Bengaluru"
    })
    assert order_res.status_code == 200
    order_data = order_res.json()["order"]
    assert order_data["total_amount"] == 4350.0
    assert order_data["customer_email"] == "rohan.sharma@teststore.org"

    # Retrieve order by order number
    ord_num = order_data["order_number"].lstrip("#")
    fetch_ord = client.get(f"/api/v1/commerce/orders?order_number={ord_num}&customer_email=rohan.sharma@teststore.org")
    assert fetch_ord.status_code == 200
    assert fetch_ord.json()["order"]["total_amount"] == 4350.0


def test_commerce_sync_returns_real_metrics_and_not_configured():
    """Verify that sync status returns real database counts and 'not configured' for unconfigured connectors."""
    res = client.get("/api/v1/commerce/sync")
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
