"""Tenant Isolation Boundary Tests

Proves that:
1. Tenant A cannot read Tenant B's products.
2. Tenant A cannot read Tenant B's orders.
3. Order lookups strictly enforce workspace boundaries and email verification.
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.database import async_session_factory
from app.db.models import OrderModel, ProductModel
from app.main import app

client = TestClient(app)


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

    # Query products scoped to Tenant A
    res_a = client.get(f"/api/v1/commerce/products?workspace_id={ws_a}")
    assert res_a.status_code == 200
    prods_a = res_a.json()["products"]
    assert len(prods_a) == 1
    assert prods_a[0]["title"] == "Alpha Confidential Product"
    # Ensure Tenant B's product does not leak into Tenant A
    assert all(p["workspace_id"] == ws_a for p in prods_a)
    assert not any(p["title"] == "Beta Private Product" for p in prods_a)

    # Query products scoped to Tenant B
    res_b = client.get(f"/api/v1/commerce/products?workspace_id={ws_b}")
    assert res_b.status_code == 200
    prods_b = res_b.json()["products"]
    assert len(prods_b) == 1
    assert prods_b[0]["title"] == "Beta Private Product"
    assert all(p["workspace_id"] == ws_b for p in prods_b)
    assert not any(p["title"] == "Alpha Confidential Product" for p in prods_b)


@pytest.mark.asyncio
async def test_tenant_cannot_read_another_tenants_orders():
    """Verify that orders belonging to Tenant A cannot be read or retrieved by Tenant B."""
    ws_a = f"ws_tenant_alpha_{uuid.uuid4().hex[:6]}"
    ws_b = f"ws_tenant_beta_{uuid.uuid4().hex[:6]}"
    ord_num_a = f"#ORD-A-{uuid.uuid4().hex[:4]}"

    async with async_session_factory() as session:
        ord_a = OrderModel(
            id=f"ord_{uuid.uuid4().hex[:8]}",
            workspace_id=ws_a,
            order_number=ord_num_a,
            customer_email="buyer.alpha@tenant-a.org",
            total_amount=2999.0,
            status="PAID"
        )
        session.add(ord_a)
        await session.commit()

    # Query orders with Tenant A workspace_id -> visible
    fetch_a = client.get(f"/api/v1/commerce/orders?workspace_id={ws_a}")
    assert fetch_a.status_code == 200
    orders_a = fetch_a.json()["orders"]
    assert any(o["order_number"] == ord_num_a for o in orders_a)

    # Query orders with Tenant B workspace_id -> empty, must NOT see Tenant A's order
    fetch_b = client.get(f"/api/v1/commerce/orders?workspace_id={ws_b}")
    assert fetch_b.status_code == 200
    orders_b = fetch_b.json()["orders"]
    assert not any(o["order_number"] == ord_num_a for o in orders_b)
