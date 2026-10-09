"""
Tests for Phase 4 Security Account Features:
1. MFA with TOTP (QR setup, verify code, enable, block login without code, verify with code, disable).
2. Active sessions tracking, list sessions, revoke specific session, log out everywhere.
3. API Keys management: create scoped keys, hash verification, rotation, revocation, tenant boundary.
"""
import uuid
import pytest
import pyotp
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.auth import create_access_token, hash_password, hash_secure_token
from app.db.database import async_session_factory
from app.db.models import ApiKeyModel, UserModel, UserSessionModel, WorkspaceMemberModel, WorkspaceModel
from app.main import app

client = TestClient(app)


def auth_header(workspace_id: str, user_id: str, role: str = "OWNER") -> dict[str, str]:
    token = create_access_token(
        user_id=user_id,
        email=f"{user_id}@shopmate.org",
        workspace_id=workspace_id,
        role=role,
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_mfa_setup_verify_and_login_flow():
    """Verify MFA lifecycle: setup -> verify -> login requires TOTP -> successful login."""
    ws_id = f"ws_mfa_{uuid.uuid4().hex[:8]}"
    user_id = f"usr_mfa_{uuid.uuid4().hex[:8]}"
    email = f"mfa_{uuid.uuid4().hex[:6]}@shopmate.org"
    password = "SuperSecurePassword123!"

    async with async_session_factory() as session:
        ws = WorkspaceModel(id=ws_id, name="MFA Store", slug=f"mfa-{uuid.uuid4().hex[:6]}")
        user = UserModel(
            id=user_id,
            email=email,
            name="MFA User",
            password_hash=hash_password(password),
            is_verified=True,
            role="OWNER",
            mfa_enabled=False,
        )
        mem = WorkspaceMemberModel(id=f"wsm_{uuid.uuid4().hex[:8]}", workspace_id=ws_id, user_id=user_id, role="OWNER")
        session.add_all([ws, user, mem])
        await session.commit()

    headers = auth_header(ws_id, user_id, "OWNER")

    # 1. Setup MFA
    setup_res = client.post("/api/v1/auth/mfa/setup", headers=headers)
    assert setup_res.status_code == 200
    setup_data = setup_res.json()
    assert setup_data["success"] is True
    assert "secret" in setup_data
    assert "qr_code" in setup_data
    assert len(setup_data["recovery_codes"]) == 10
    secret = setup_data["secret"]
    recovery_code = setup_data["recovery_codes"][0]

    # 2. Verify with wrong code -> 400
    bad_verify = client.post("/api/v1/auth/mfa/verify", headers=headers, json={"code": "000000"})
    assert bad_verify.status_code == 400

    # 3. Verify with valid TOTP code
    totp = pyotp.TOTP(secret)
    valid_code = totp.now()
    good_verify = client.post("/api/v1/auth/mfa/verify", headers=headers, json={"code": valid_code})
    assert good_verify.status_code == 200
    assert good_verify.json()["mfa_enabled"] is True

    # 4. Attempt login without MFA code -> 403 MFA_REQUIRED
    login_no_mfa = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login_no_mfa.status_code == 403
    assert "mfa_required" in login_no_mfa.json()["detail"].lower()

    # 5. Attempt login with bad code -> 401
    login_bad_mfa = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password, "mfa_code": "999999"}
    )
    assert login_bad_mfa.status_code == 401

    # 6. Attempt login with valid TOTP code -> 200
    login_good_mfa = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password, "mfa_code": totp.now()}
    )
    assert login_good_mfa.status_code == 200
    assert "access_token" in login_good_mfa.json()

    # 7. Login with recovery code -> 200
    login_rec = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password, "recovery_code": recovery_code}
    )
    assert login_rec.status_code == 200

    # 8. Re-using same recovery code fails -> 401
    login_rec_reuse = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password, "recovery_code": recovery_code}
    )
    assert login_rec_reuse.status_code == 401

    # 9. Disable MFA
    disable_res = client.post(
        "/api/v1/auth/mfa/disable",
        headers=headers,
        json={"code": totp.now(), "password": password}
    )
    assert disable_res.status_code == 200
    assert disable_res.json()["mfa_enabled"] is False


@pytest.mark.asyncio
async def test_active_sessions_and_logout_everywhere():
    """Verify session recording, session listing, single revocation and log out everywhere."""
    ws_id = f"ws_sess_{uuid.uuid4().hex[:8]}"
    user_id = f"usr_sess_{uuid.uuid4().hex[:8]}"
    email = f"sess_{uuid.uuid4().hex[:6]}@shopmate.org"
    password = "SessionSecurePassword123!"

    async with async_session_factory() as session:
        ws = WorkspaceModel(id=ws_id, name="Sessions Store", slug=f"sess-{uuid.uuid4().hex[:6]}")
        user = UserModel(
            id=user_id,
            email=email,
            name="Session User",
            password_hash=hash_password(password),
            is_verified=True,
            role="ADMIN",
        )
        mem = WorkspaceMemberModel(id=f"wsm_{uuid.uuid4().hex[:8]}", workspace_id=ws_id, user_id=user_id, role="ADMIN")
        session.add_all([ws, user, mem])
        await session.commit()

    # 1. Login to create session 1
    login1 = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login1.status_code == 200
    tok1 = login1.json()["access_token"]

    # 2. Login to create session 2
    login2 = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login2.status_code == 200
    tok2 = login2.json()["access_token"]

    # 3. List active sessions using token 2
    sess_list_res = client.get("/api/v1/auth/sessions", headers={"Authorization": f"Bearer {tok2}"})
    assert sess_list_res.status_code == 200
    sessions = sess_list_res.json()["sessions"]
    assert len(sessions) >= 2

    # Find session 1
    sess1_id = next(s["id"] for s in sessions if not s["is_current"])

    # 4. Revoke session 1
    revoke_res = client.post(f"/api/v1/auth/sessions/{sess1_id}/revoke", headers={"Authorization": f"Bearer {tok2}"})
    assert revoke_res.status_code == 200

    # 5. Token 1 should now be rejected as revoked (401)
    me_res_tok1 = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tok1}"})
    assert me_res_tok1.status_code == 401

    # Token 2 is still valid
    me_res_tok2 = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tok2}"})
    assert me_res_tok2.status_code == 200

    # 6. Log out everywhere
    revoke_all_res = client.post("/api/v1/auth/sessions/revoke-all", headers={"Authorization": f"Bearer {tok2}"})
    assert revoke_all_res.status_code == 200

    # Token 2 should now also be rejected
    me_res_tok2_after = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tok2}"})
    assert me_res_tok2_after.status_code == 401


@pytest.mark.asyncio
async def test_api_keys_crud_rotation_and_tenant_isolation():
    """Verify API keys generation, listing, rotation, revocation, and workspace isolation."""
    ws_a = f"ws_key_a_{uuid.uuid4().hex[:8]}"
    ws_b = f"ws_key_b_{uuid.uuid4().hex[:8]}"
    user_a = f"usr_a_{uuid.uuid4().hex[:8]}"
    user_b = f"usr_b_{uuid.uuid4().hex[:8]}"

    async with async_session_factory() as session:
        wa = WorkspaceModel(id=ws_a, name="Workspace A", slug=f"ws-a-{uuid.uuid4().hex[:6]}")
        wb = WorkspaceModel(id=ws_b, name="Workspace B", slug=f"ws-b-{uuid.uuid4().hex[:6]}")
        ua = UserModel(id=user_a, email=f"{user_a}@a.org", name="User A")
        ub = UserModel(id=user_b, email=f"{user_b}@b.org", name="User B")
        ma = WorkspaceMemberModel(id=f"wsm_{uuid.uuid4().hex[:8]}", workspace_id=ws_a, user_id=user_a, role="OWNER")
        mb = WorkspaceMemberModel(id=f"wsm_{uuid.uuid4().hex[:8]}", workspace_id=ws_b, user_id=user_b, role="OWNER")
        session.add_all([wa, wb, ua, ub, ma, mb])
        await session.commit()

    headers_a = auth_header(ws_a, user_a, "OWNER")
    headers_b = auth_header(ws_b, user_b, "OWNER")

    # 1. Create API key for Workspace A
    create_res = client.post(
        "/api/v1/api-keys",
        headers=headers_a,
        json={"name": "Production Bot", "scopes": ["catalog:read", "chat:write"], "expires_in_days": 30}
    )
    assert create_res.status_code == 200
    key_data = create_res.json()["api_key"]
    raw_key = key_data["key"]
    key_id = key_data["id"]
    assert raw_key.startswith("sm_live_")
    assert key_data["scopes"] == ["catalog:read", "chat:write"]

    # 2. Verify key hash stored at rest in DB
    async with async_session_factory() as session:
        stored_key = (await session.execute(select(ApiKeyModel).where(ApiKeyModel.id == key_id))).scalars().first()
        assert stored_key is not None
        assert stored_key.key_hash == hash_secure_token(raw_key)

    # 3. List keys for Workspace A
    list_res_a = client.get("/api/v1/api-keys", headers=headers_a)
    assert list_res_a.status_code == 200
    keys_a = list_res_a.json()["api_keys"]
    assert len(keys_a) == 1
    assert keys_a[0]["id"] == key_id
    assert keys_a[0]["is_active"] is True
    assert "key" not in keys_a[0]  # Raw key is never exposed again in listings

    # 4. Workspace B should NOT see Workspace A's key (Tenant Isolation)
    list_res_b = client.get("/api/v1/api-keys", headers=headers_b)
    assert list_res_b.status_code == 200
    assert len(list_res_b.json()["api_keys"]) == 0

    # 5. Workspace B cannot revoke or rotate Workspace A's key (404)
    rev_b = client.delete(f"/api/v1/api-keys/{key_id}", headers=headers_b)
    assert rev_b.status_code == 404

    # 6. Rotate API key for Workspace A
    rotate_res = client.post(f"/api/v1/api-keys/{key_id}/rotate", headers=headers_a, json={"expires_in_days": 60})
    assert rotate_res.status_code == 200
    new_key_data = rotate_res.json()["api_key"]
    assert new_key_data["key"].startswith("sm_live_")
    assert new_key_data["id"] != key_id

    # Old key is now revoked in Workspace A
    list_res_a_after = client.get("/api/v1/api-keys", headers=headers_a)
    assert list_res_a_after.status_code == 200
    all_keys = list_res_a_after.json()["api_keys"]
    assert len(all_keys) == 2
    old_key_entry = next(k for k in all_keys if k["id"] == key_id)
    assert old_key_entry["is_active"] is False
    assert old_key_entry["revoked_at"] is not None
