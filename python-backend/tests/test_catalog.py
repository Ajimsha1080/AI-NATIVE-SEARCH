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

def test_commerce_products_catalog():
    res = client.get("/api/v1/commerce/products")
    assert res.status_code == 200
    data = res.json()
    assert "products" in data
    assert len(data["products"]) > 0
    assert "categories" in data

def test_ai_mode_search():
    res = client.post("/api/v1/ai-mode/search", json={"query": "shirts"})
    assert res.status_code == 200
    data = res.json()
    assert "products" in data
    assert data["total_matches"] > 0
    assert "latency_ms" in data
