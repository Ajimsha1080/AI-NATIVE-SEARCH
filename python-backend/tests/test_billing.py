import hashlib
import hmac
import json
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.auth import create_access_token
from app.config import settings
from app.db.database import async_session_factory
from app.db.models import InvoiceModel, SubscriptionModel
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


def test_list_plans():
    """Verify listing available billing plans."""
    res = client.get("/api/v1/billing/plans")
    assert res.status_code == 200
    data = res.json()
    assert "plans" in data
    codes = [p["code"] for p in data["plans"]]
    assert "free" in codes
    assert "starter" in codes
    assert "pro" in codes
    assert "enterprise" in codes


def test_get_or_create_trial_subscription():
    """Verify workspace gets initialized on a 14-day free trial."""
    ws_id = f"ws_sub_trial_{uuid.uuid4().hex[:8]}"
    res = client.get("/api/v1/billing/subscription", headers=auth_header(ws_id))
    assert res.status_code == 200
    data = res.json()
    sub = data["subscription"]
    assert sub["workspace_id"] == ws_id
    assert sub["status"] == "TRIALING"
    assert sub["plan_code"] == "starter"
    assert sub["days_left_in_trial"] > 0
    assert data["plan"]["code"] == "starter"


def test_checkout_session_initiation():
    """Verify owner/admin can initiate a subscription checkout."""
    ws_id = f"ws_sub_co_{uuid.uuid4().hex[:8]}"
    res = client.post(
        "/api/v1/billing/checkout",
        headers=auth_header(ws_id, role="OWNER"),
        json={"plan_code": "pro"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "checkout_url" in data
    assert data["plan"]["code"] == "pro"


def test_cancel_subscription():
    """Verify owner/admin can cancel subscription."""
    ws_id = f"ws_sub_can_{uuid.uuid4().hex[:8]}"
    res = client.post(
        "/api/v1/billing/cancel",
        headers=auth_header(ws_id, role="OWNER")
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["cancel_at_period_end"] is True


def test_webhook_signature_rejection():
    """Verify invalid or missing signature on webhook returns 400."""
    settings.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret_key_123"

    # Missing header
    res_missing = client.post("/api/v1/billing/webhook/razorpay", json={"event": "subscription.activated"})
    assert res_missing.status_code == 400

    # Invalid header
    res_invalid = client.post(
        "/api/v1/billing/webhook/razorpay",
        headers={"X-Razorpay-Signature": "invalid_signature_hex"},
        json={"event": "subscription.activated"}
    )
    assert res_invalid.status_code == 400


@pytest.mark.asyncio
async def test_billing_webhook_full_lifecycle_and_idempotency():
    """Verify webhook state transitions and idempotency."""
    settings.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret_key_123"
    ws_id = f"ws_wh_life_{uuid.uuid4().hex[:8]}"
    provider_sub_id = f"sub_rzp_{uuid.uuid4().hex[:12]}"

    # Setup subscription record in DB
    async with async_session_factory() as session:
        sub = SubscriptionModel(
            id=f"sub_{uuid.uuid4().hex[:12]}",
            workspace_id=ws_id,
            plan_code="starter",
            status="TRIALING",
            provider="razorpay",
            provider_subscription_id=provider_sub_id
        )
        session.add(sub)
        await session.commit()

    def send_webhook(event_type: str, event_id: str, payload_data: dict):
        body = {
            "id": event_id,
            "event": event_type,
            "payload": payload_data
        }
        body_bytes = json.dumps(body).encode("utf-8")
        sig = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
            body_bytes,
            hashlib.sha256
        ).hexdigest()

        return client.post(
            "/api/v1/billing/webhook/razorpay",
            headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"},
            content=body_bytes
        )

    # 1. subscription.activated
    evt1_id = f"evt_{uuid.uuid4().hex[:10]}"
    res1 = send_webhook(
        "subscription.activated",
        evt1_id,
        {"subscription": {"entity": {"id": provider_sub_id, "notes": {"workspace_id": ws_id, "plan_code": "pro"}}}}
    )
    assert res1.status_code == 200

    # Check status changed to ACTIVE and plan to pro
    async with async_session_factory() as session:
        res = await session.execute(select(SubscriptionModel).where(SubscriptionModel.workspace_id == ws_id))
        sub = res.scalars().first()
        assert sub.status == "ACTIVE"
        assert sub.plan_code == "pro"

    # Idempotency: replay evt1
    res1_replay = send_webhook(
        "subscription.activated",
        evt1_id,
        {"subscription": {"entity": {"id": provider_sub_id}}}
    )
    assert res1_replay.status_code == 200
    assert res1_replay.json()["status"] == "ignored"

    # 2. subscription.charged (Generates Invoice)
    evt2_id = f"evt_{uuid.uuid4().hex[:10]}"
    res2 = send_webhook(
        "subscription.charged",
        evt2_id,
        {
            "subscription": {"entity": {"id": provider_sub_id}},
            "payment": {"entity": {"id": f"pay_{uuid.uuid4().hex[:8]}", "amount": 799900, "currency": "INR", "invoice_id": "inv_rzp_01"}}
        }
    )
    assert res2.status_code == 200

    # Check invoice created
    inv_res = client.get("/api/v1/billing/invoices", headers=auth_header(ws_id))
    assert inv_res.status_code == 200
    invoices = inv_res.json()["invoices"]
    assert len(invoices) == 1
    assert invoices[0]["amount"] == 7999.0
    assert invoices[0]["status"] == "PAID"

    # 3. subscription.payment.failed -> PAST_DUE
    evt3_id = f"evt_{uuid.uuid4().hex[:10]}"
    res3 = send_webhook(
        "subscription.payment.failed",
        evt3_id,
        {"subscription": {"entity": {"id": provider_sub_id}}, "payment": {"entity": {"amount": 799900}}}
    )
    assert res3.status_code == 200

    async with async_session_factory() as session:
        res = await session.execute(select(SubscriptionModel).where(SubscriptionModel.workspace_id == ws_id))
        sub = res.scalars().first()
        assert sub.status == "PAST_DUE"
        assert sub.grace_period_end is not None

    # 4. subscription.halted -> HALTED
    evt4_id = f"evt_{uuid.uuid4().hex[:10]}"
    res4 = send_webhook(
        "subscription.halted",
        evt4_id,
        {"subscription": {"entity": {"id": provider_sub_id}}}
    )
    assert res4.status_code == 200

    async with async_session_factory() as session:
        res = await session.execute(select(SubscriptionModel).where(SubscriptionModel.workspace_id == ws_id))
        sub = res.scalars().first()
        assert sub.status == "HALTED"


@pytest.mark.asyncio
async def test_billing_tenant_isolation():
    """Verify Tenant A cannot access Tenant B's subscription or invoices."""
    ws_a = f"ws_iso_a_{uuid.uuid4().hex[:8]}"
    ws_b = f"ws_iso_b_{uuid.uuid4().hex[:8]}"

    # Initialize Tenant B subscription & invoice
    async with async_session_factory() as session:
        sub_b = SubscriptionModel(
            id=f"sub_b_{uuid.uuid4().hex[:8]}",
            workspace_id=ws_b,
            plan_code="enterprise",
            status="ACTIVE"
        )
        inv_b = InvoiceModel(
            id=f"inv_b_{uuid.uuid4().hex[:8]}",
            workspace_id=ws_b,
            amount=24999.0,
            currency="INR",
            status="PAID"
        )
        session.add_all([sub_b, inv_b])
        await session.commit()

    # Query invoices as Tenant A
    res_a = client.get("/api/v1/billing/invoices", headers=auth_header(ws_a))
    assert res_a.status_code == 200
    assert len(res_a.json()["invoices"]) == 0

    # Query subscription as Tenant A
    sub_res_a = client.get("/api/v1/billing/subscription", headers=auth_header(ws_a))
    assert sub_res_a.status_code == 200
    assert sub_res_a.json()["subscription"]["workspace_id"] == ws_a
    assert sub_res_a.json()["subscription"]["plan_code"] == "starter"  # Not enterprise
