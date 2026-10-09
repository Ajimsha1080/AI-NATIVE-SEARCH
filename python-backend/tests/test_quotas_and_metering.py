import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth import create_access_token
from app.billing.metering import (
    current_month_str,
    get_monthly_usage_totals,
    increment_monthly_usage,
    reconcile_usage_to_db,
)
from app.db.database import async_session_factory
from app.db.models import DeploymentModel, ProductModel, SubscriptionModel, UsageRecordModel
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


@pytest.mark.asyncio
async def test_monthly_usage_increment_and_totals():
    """Verify incrementing and querying monthly Redis usage counters."""
    ws_id = f"ws_meter_{uuid.uuid4().hex[:8]}"

    # Increment usage
    res = await increment_monthly_usage(
        workspace_id=ws_id,
        searches=5,
        chats=2,
        tokens_in=1000,
        tokens_out=2000,
        crawls=1
    )
    assert res["cost_delta"] > 0

    # Query totals
    totals = await get_monthly_usage_totals(ws_id)
    assert totals["searches"] >= 5
    assert totals["chats"] >= 2
    assert totals["tokens_in"] >= 1000
    assert totals["tokens_out"] >= 2000
    assert totals["crawls"] >= 1
    assert totals["cost_usd"] > 0


@pytest.mark.asyncio
async def test_reconcile_usage_to_database():
    """Verify reconciling Redis usage counters into the persistent database table."""
    ws_id = f"ws_recon_{uuid.uuid4().hex[:8]}"
    month = current_month_str()

    await increment_monthly_usage(ws_id, searches=10, chats=5, tokens_in=5000, tokens_out=5000)

    async with async_session_factory() as session:
        rec = await reconcile_usage_to_db(session, ws_id, month)
        assert rec.workspace_id == ws_id
        assert rec.period_month == month
        assert rec.search_requests >= 10
        assert rec.chat_requests >= 5
        assert rec.tokens_in >= 5000


@pytest.mark.asyncio
async def test_quota_exceeded_blocks_merchant_with_402():
    """Verify that hitting a plan quota returns HTTP 402 with upgrade instructions."""
    ws_id = f"ws_quota_402_{uuid.uuid4().hex[:8]}"

    # Set workspace to 'free' plan (limit 50 products)
    async with async_session_factory() as session:
        sub = SubscriptionModel(
            id=f"sub_{uuid.uuid4().hex[:8]}",
            workspace_id=ws_id,
            plan_code="free",
            status="ACTIVE"
        )
        session.add(sub)

        # Seed 50 products to max out allowance
        products = [
            ProductModel(
                id=f"prod_bulk_{i}_{uuid.uuid4().hex[:6]}",
                workspace_id=ws_id,
                title=f"Bulk Item {i}",
                price=100.0,
                stock=5
            )
            for i in range(50)
        ]
        session.add_all(products)
        await session.commit()

    # Attempt to create product #51
    res = client.post(
        "/api/v1/commerce/products",
        headers=auth_header(ws_id, role="ADMIN"),
        json={
            "title": "Exceeding Product 51",
            "price": 299.0
        }
    )
    assert res.status_code == 402
    data = res.json()["detail"]
    assert data["error"] == "PLAN_QUOTA_EXCEEDED"
    assert data["metric"] == "products"
    assert "/ai-mode/billing" in data["upgrade_url"]


@pytest.mark.asyncio
async def test_storefront_graceful_quota_response():
    """Verify that storefront search gracefully handles quota limits without crashing."""
    ws_id = f"ws_storefront_grace_{uuid.uuid4().hex[:8]}"
    dep_key = f"dep_grace_{uuid.uuid4().hex[:8]}"

    # Create deployment and free subscription
    async with async_session_factory() as session:
        dep = DeploymentModel(
            id=f"dep_{uuid.uuid4().hex[:8]}",
            workspace_id=ws_id,
            name="Grace Store",
            status="LIVE",
            public_key=dep_key
        )
        sub = SubscriptionModel(
            id=f"sub_{uuid.uuid4().hex[:8]}",
            workspace_id=ws_id,
            plan_code="free",
            status="ACTIVE"
        )
        session.add_all([dep, sub])
        await session.commit()

    # Max out search allowance for free plan (1000 searches)
    await increment_monthly_usage(ws_id, searches=1005)

    # Storefront searches should not crash with 500; they return a graceful empty response
    res = client.post(
        "/api/v1/ai-mode/search",
        headers={"X-Deployment-Key": dep_key},
        json={"query": "silk shirt"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_matches"] == 0
    assert len(data["products"]) == 0


@pytest.mark.asyncio
async def test_usage_records_tenant_isolation_rls():
    """Verify tenant isolation for usage records."""
    ws_a = f"ws_usg_iso_a_{uuid.uuid4().hex[:8]}"
    ws_b = f"ws_usg_iso_b_{uuid.uuid4().hex[:8]}"
    month = current_month_str()

    async with async_session_factory() as session:
        rec_b = UsageRecordModel(
            id=f"usg_b_{uuid.uuid4().hex[:8]}",
            workspace_id=ws_b,
            period_month=month,
            search_requests=999,
            tokens_in=100000
        )
        session.add(rec_b)
        await session.commit()

    # Query usage as Tenant A
    res_a = client.get("/api/v1/billing/usage", headers=auth_header(ws_a))
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert data_a["workspace_id"] == ws_a
    # Tenant A must NOT see Tenant B's 999 searches
    assert data_a["meters"]["searches"]["used"] == 0
