import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.compliance import record_audit_event
from app.auth import create_access_token

client = TestClient(app)

@pytest.mark.asyncio
async def test_record_audit_event_direct():
    """Verify that record_audit_event writes an immutable audit record."""
    entry = await record_audit_event(
        workspace_id="ws_test_compliance",
        action="TEST_ADMIN_MUTATION",
        actor_id="admin_user_99",
        resource_type="config",
        resource_id="cfg_001",
        ip_address="192.168.1.10",
        details={"setting": "currency", "old": "USD", "new": "INR"}
    )
    assert entry is not None
    assert entry.workspace_id == "ws_test_compliance"
    assert entry.action == "TEST_ADMIN_MUTATION"
    assert entry.actor_id == "admin_user_99"
    assert entry.details_json["new"] == "INR"

def test_get_audit_logs_endpoint():
    """Verify retrieving audit logs via API."""
    res = client.get("/api/v1/compliance/audit-logs?workspace_id=ws_test_compliance")
    assert res.status_code == 200
    data = res.json()
    assert "audit_logs" in data
    assert data["workspace_id"] == "ws_test_compliance"
    # The record created above should be in the list
    assert any(log["action"] == "TEST_ADMIN_MUTATION" for log in data["audit_logs"])

def test_dpdp_customer_data_export():
    """Verify customer data export under DPDP Act 2023."""
    payload = {
        "customer_email": "dpdp_test_user@example.com",
        "workspace_id": "ws_test_compliance"
    }
    res = client.post("/api/v1/compliance/export", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert "dpdp_export_id" in data
    assert data["customer_email"] == "dpdp_test_user@example.com"
    assert "orders" in data["data"]
    assert "conversations" in data["data"]

def test_dpdp_customer_data_erasure():
    """Verify customer right to erasure / right to be forgotten under DPDP Act 2023."""
    payload = {
        "customer_email": "dpdp_erase_user@example.com",
        "workspace_id": "ws_test_compliance",
        "reason": "Exercising DPDP Act Section 12 Right to Erasure"
    }
    res = client.post("/api/v1/compliance/erase", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert "erasure_id" in data
    assert "anonymized_identifier" in data
    assert "dpdp-purged.local" in data["anonymized_identifier"]
