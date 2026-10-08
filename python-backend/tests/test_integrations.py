import hashlib
import hmac
import json
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import settings
from app.db.database import async_session_factory
from app.db.models import OrderModel
from app.main import app
from app.tools import lookup_order

client = TestClient(app)


def test_razorpay_webhook_signature_rejection():
    """Verify that razorpay webhook rejects requests with invalid signatures."""
    settings.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret_key_12345678"
    fake_body = json.dumps({"event": "payment.captured", "payload": {}}).encode("utf-8")

    # Missing signature -> 400
    res_missing = client.post("/api/v1/webhooks/razorpay", content=fake_body)
    assert res_missing.status_code == 400

    # Invalid signature -> 400
    res_invalid = client.post(
        "/api/v1/webhooks/razorpay",
        content=fake_body,
        headers={"X-Razorpay-Signature": "invalid_signature_hex_12345"}
    )
    assert res_invalid.status_code == 400

    # Valid HMAC signature -> 200
    valid_sig = hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
        fake_body,
        hashlib.sha256
    ).hexdigest()

    res_valid = client.post(
        "/api/v1/webhooks/razorpay",
        content=fake_body,
        headers={"X-Razorpay-Signature": valid_sig}
    )
    assert res_valid.status_code == 200
    assert res_valid.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_razorpay_webhook_updates_order_status():
    """Verify that a verified webhook event updates the database order status to PAID."""
    settings.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret_key_12345678"
    order_id = f"ord_hook_{uuid.uuid4().hex[:8]}"

    # Seed an unpaid order
    async with async_session_factory() as session:
        order = OrderModel(
            id=order_id,
            workspace_id="ws_hook_test",
            order_number=f"#ORD-{uuid.uuid4().hex[:6]}",
            customer_email="hook.buyer@teststore.org",
            total_amount=1200.0,
            status="PENDING",
            payment_status="PENDING",
        )
        session.add(order)
        await session.commit()

    # Webhook payload for payment.captured
    payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_test_999",
                    "order_id": order_id,
                    "status": "captured"
                }
            }
        }
    }
    raw_body = json.dumps(payload).encode("utf-8")
    sig = hmac.new(settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

    res = client.post(
        "/api/v1/webhooks/razorpay",
        content=raw_body,
        headers={"X-Razorpay-Signature": sig}
    )
    assert res.status_code == 200

    # Verify status in database
    async with async_session_factory() as session:
        updated = (await session.execute(select(OrderModel).where(OrderModel.id == order_id))).scalars().first()
        assert updated.status == "PAID"
        assert updated.payment_status == "PAID"


def test_persistent_idempotency_keys():
    """Verify that Razorpay order creation persists idempotency key and returns idempotent cached response."""
    ws_id = f"ws_idemp_{uuid.uuid4().hex[:8]}"
    # 1. Create a product first
    prod_res = client.post("/api/v1/commerce/products", json={
        "workspace_id": ws_id,
        "title": "Idempotent Test Item",
        "price": 899.0,
        "inventory": 10
    })
    prod_id = prod_res.json()["product"]["id"]

    idemp_key = f"idemp_{uuid.uuid4().hex}"
    req_body = {
        "productId": prod_id,
        "quantity": 1
    }

    # First request
    res1 = client.post(
        "/api/v1/commerce/razorpay/create-order",
        json=req_body,
        headers={"Idempotency-Key": idemp_key}
    )
    assert res1.status_code == 200
    data1 = res1.json()

    # Second request with identical idempotency key -> must return exact cached response
    res2 = client.post(
        "/api/v1/commerce/razorpay/create-order",
        json=req_body,
        headers={"Idempotency-Key": idemp_key}
    )
    assert res2.status_code == 200
    data2 = res2.json()

    assert data1["order"]["id"] == data2["order"]["id"]
    assert data1["order"]["receipt"] == data2["order"]["receipt"]


def test_background_sync_trigger_and_job_status():
    """Verify triggering background catalog sync and querying job state."""
    ws_id = f"ws_sync_{uuid.uuid4().hex[:8]}"
    trigger_res = client.post("/api/v1/commerce/sync/trigger", json={
        "workspace_id": ws_id,
        "connector_type": "shopify"
    })
    assert trigger_res.status_code == 200
    data = trigger_res.json()
    assert data["success"] is True
    job_id = data["job_id"]
    assert job_id.startswith("job_")

    # Fetch job status
    job_res = client.get(f"/api/v1/commerce/sync/jobs/{job_id}")
    assert job_res.status_code == 200
    job_data = job_res.json()["job"]
    assert job_data["workspace_id"] == ws_id
    assert job_data["connector_type"] == "shopify"
    assert job_data["status"] in ("PENDING", "SYNCING", "COMPLETED", "FAILED")


@pytest.mark.asyncio
async def test_order_tracking_never_invents_fake_carrier():
    """Verify that lookup_order returns 'tracking unavailable' when no real tracking exists."""
    ws_id = f"ws_track_{uuid.uuid4().hex[:8]}"
    ord_id = f"ord_{uuid.uuid4().hex[:8]}"
    ord_number = f"#ORD-{uuid.uuid4().hex[:6]}"
    cust_email = "real.customer@trackingtest.org"

    # Create an order with NO carrier and NO tracking
    async with async_session_factory() as session:
        order = OrderModel(
            id=ord_id,
            workspace_id=ws_id,
            order_number=ord_number,
            customer_email=cust_email,
            total_amount=500.0,
            status="PROCESSING",
            carrier=None,
            tracking_number=None,
            shipping_address="Real Delivery Address"
        )
        session.add(order)
        await session.commit()

    tracking_result = lookup_order(
        workspace_id=ws_id,
        order_number=ord_number,
        customer_email=cust_email
    )

    assert tracking_result["found"] is True
    ord_data = tracking_result["order"]
    # Carrier and tracking MUST NOT be invented fake values like 'Bluedart Express' or 'BD-...'
    assert ord_data["carrier"] == "carrier unavailable"
    assert ord_data["tracking_number"] == "tracking unavailable"
