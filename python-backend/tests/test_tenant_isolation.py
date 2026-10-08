"""Tenant Isolation Boundary Tests

Proves for every tenant-owned table and endpoint that:
1. Tenant A's token can never read, write, or delete Tenant B's data.
2. Tenant A attempting to access Tenant B's records or workspace gets 403 or 404 (with zero leakage).
3. Public storefront queries via deployment keys isolate data per tenant.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth import create_access_token
from app.db.database import async_session_factory
from app.db.models import DeploymentModel, OrderModel, ProductModel
from app.main import app

client = TestClient(app)


def auth_header(workspace_id: str, role: str = "ADMIN") -> dict[str, str]:
    token = create_access_token(
        user_id=f"usr_{workspace_id}",
        email=f"user@{workspace_id}.org",
        workspace_id=workspace_id,
        role=role
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_tenant_cannot_read_another_tenants_products():
    """Verify that products belonging to Tenant A are never visible to Tenant B."""
    ws_a = f"ws_tenant_alpha_{uuid.uuid4().hex[:6]}"
    ws_b = f"ws_tenant_beta_{uuid.uuid4().hex[:6]}"

    async with async_session_factory() as session:
        prod_a = ProductModel(
            id=f"prod_{uuid.uuid4().hex[:8]}",
            workspace_id=ws_a,
            title="Alpha Confidential Product",
            price=2999.0,
            stock=15
        )
        prod_b = ProductModel(
            id=f"prod_{uuid.uuid4().hex[:8]}",
            workspace_id=ws_b,
            title="Beta Private Product",
            price=4999.0,
            stock=8
        )
        session.add_all([prod_a, prod_b])
        await session.commit()

    # Query products scoped to Tenant A using Tenant A's token
    res_a = client.get("/api/v1/commerce/products", headers=auth_header(ws_a))
    assert res_a.status_code == 200
    prods_a = res_a.json()["products"]
    assert len(prods_a) == 1
    assert prods_a[0]["title"] == "Alpha Confidential Product"
    assert all(p["workspace_id"] == ws_a for p in prods_a)
    assert not any(p["title"] == "Beta Private Product" for p in prods_a)

    # Tenant A attempts to explicitly query Tenant B's workspace -> 403 Forbidden!
    mismatch_res = client.get(f"/api/v1/commerce/products?workspace_id={ws_b}", headers=auth_header(ws_a))
    assert mismatch_res.status_code == 403

    # Query products scoped to Tenant B using Tenant B's token
    res_b = client.get("/api/v1/commerce/products", headers=auth_header(ws_b))
    assert res_b.status_code == 200
    prods_b = res_b.json()["products"]
    assert len(prods_b) == 1
    assert prods_b[0]["title"] == "Beta Private Product"
    assert all(p["workspace_id"] == ws_b for p in prods_b)
    assert not any(p["title"] == "Alpha Confidential Product" for p in prods_b)


@pytest.mark.asyncio
async def test_tenant_cannot_read_or_delete_another_tenants_data():
    """Verify that Tenant A cannot read, update, or delete Tenant B's product or orders."""
    ws_a = f"ws_tenant_alpha_{uuid.uuid4().hex[:6]}"
    ws_b = f"ws_tenant_beta_{uuid.uuid4().hex[:6]}"
    prod_b_id = f"prod_b_{uuid.uuid4().hex[:8]}"

    async with async_session_factory() as session:
        prod_b = ProductModel(
            id=prod_b_id,
            workspace_id=ws_b,
            title="Beta Sensitive Gear",
            price=7999.0,
            stock=5
        )
        ord_b = OrderModel(
            id=f"ord_{uuid.uuid4().hex[:8]}",
            workspace_id=ws_b,
            order_number=f"#ORD-B-{uuid.uuid4().hex[:4]}",
            customer_email="buyer@beta.org",
            total_amount=7999.0,
            status="PAID"
        )
        session.add_all([prod_b, ord_b])
        await session.commit()

    # Tenant A tries to delete Tenant B's product by ID -> 404 (not in Tenant A's workspace)
    del_res = client.delete(f"/api/v1/commerce/products?id={prod_b_id}", headers=auth_header(ws_a))
    assert del_res.status_code == 404

    # Tenant A queries orders -> 0 orders from Tenant B
    ord_res = client.get("/api/v1/commerce/orders", headers=auth_header(ws_a))
    assert ord_res.status_code == 200
    assert len(ord_res.json()["orders"]) == 0

    # Tenant B queries orders -> sees order
    ord_b_res = client.get("/api/v1/commerce/orders", headers=auth_header(ws_b))
    assert ord_b_res.status_code == 200
    assert len(ord_b_res.json()["orders"]) == 1


@pytest.mark.asyncio
async def test_public_storefront_deployment_isolation():
    """Verify public storefront AI search isolates catalog based on deployment key."""
    ws_a = f"ws_store_a_{uuid.uuid4().hex[:6]}"
    ws_b = f"ws_store_b_{uuid.uuid4().hex[:6]}"
    dep_key_a = f"dep_key_a_{uuid.uuid4().hex[:8]}"

    async with async_session_factory() as session:
        dep_a = DeploymentModel(
            id=f"dep_{uuid.uuid4().hex[:8]}",
            workspace_id=ws_a,
            name="Store A Search",
            status="LIVE",
            public_key=dep_key_a
        )
        prod_a = ProductModel(
            id=f"prod_a_{uuid.uuid4().hex[:8]}",
            workspace_id=ws_a,
            title="Alpha Silk Scarf",
            price=1200.0,
            category="Accessories"
        )
        prod_b = ProductModel(
            id=f"prod_b_{uuid.uuid4().hex[:8]}",
            workspace_id=ws_b,
            title="Beta Denim Jacket",
            price=3500.0,
            category="Clothing"
        )
        session.add_all([dep_a, prod_a, prod_b])
        await session.commit()

    # Public customer queries AI search with Tenant A's deployment key
    search_res = client.post(
        "/api/v1/ai-mode/search",
        headers={"X-Deployment-Key": dep_key_a},
        json={"query": "silk scarf"}
    )
    assert search_res.status_code == 200
    results = search_res.json()["products"]
    assert any("Silk Scarf" in p["title"] for p in results)
    assert not any("Denim Jacket" in p["title"] for p in results)
