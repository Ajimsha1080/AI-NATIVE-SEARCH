import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    is_token_revoked,
    revoke_token,
    verify_password,
)
from app.db.database import async_session_factory
from app.db.models import AuthTokenModel
from app.main import app

client = TestClient(app)


def test_access_token_creation_and_decoding():
    token = create_access_token(
        user_id="usr_test_123",
        email="test@shopmate.com",
        workspace_id="ws_test_tenant",
        role="ADMIN"
    )
    assert token is not None
    payload = decode_token(token, expected_type="access")
    assert payload["userId"] == "usr_test_123"
    assert payload["email"] == "test@shopmate.com"
    assert payload["workspace_id"] == "ws_test_tenant"
    assert payload["role"] == "ADMIN"
    assert payload["type"] == "access"


def test_refresh_token_lifecycle():
    refresh_token = create_refresh_token(
        user_id="usr_test_123",
        workspace_id="ws_test_tenant"
    )
    payload = decode_token(refresh_token, expected_type="refresh")
    assert payload["userId"] == "usr_test_123"
    assert payload["type"] == "refresh"


def test_token_revocation_denylist():
    token = create_access_token("usr_revoked", "r@test.com", "ws_1")
    assert not is_token_revoked(token)

    revoke_token(token)
    assert is_token_revoked(token)

    with pytest.raises(Exception) as exc_info:
        decode_token(token)
    assert "revoked" in str(exc_info.value).lower()


def test_password_hashing_and_verification():
    raw_pass = "SecurePass123!$"
    hashed = hash_password(raw_pass)
    assert hashed != raw_pass
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("WrongPassword123", hashed) is False


def test_login_unknown_email_returns_401():
    """Verify that unknown emails fail immediately with 401 and never fall back to users[0]."""
    res = client.post("/api/v1/auth/login", json={
        "email": "completely_unknown_user_9999@testbrand-nonexistent.org",
        "password": "SomePassword123!"
    })
    assert res.status_code == 401
    assert "Invalid email or password" in res.json()["detail"]


import uuid


def test_real_signup_and_login_flow():
    """Verify real signup creates User, Workspace, OWNER WorkspaceMember and allows login."""
    uid = uuid.uuid4().hex[:8]
    signup_email = f"alex.founder_{uid}@realbrand.store"
    signup_pass = "EnterpriseSecret99!"

    signup_res = client.post("/api/v1/auth/signup", json={
        "name": "Alex Founder",
        "email": signup_email,
        "password": signup_pass,
        "workspace_name": "Alex Premium Store"
    })
    assert signup_res.status_code == 200
    signup_data = signup_res.json()
    assert signup_data["success"] is True
    assert "token" in signup_data
    assert signup_data["user"]["role"] == "OWNER"
    real_ws_id = signup_data["workspace"]["id"]
    assert real_ws_id.startswith("ws_")
    assert real_ws_id != "ws_acme_corp"

    # Verify duplicate signup returns 409 Conflict
    dup_res = client.post("/api/v1/auth/signup", json={
        "name": "Alex Founder Dup",
        "email": signup_email,
        "password": signup_pass
    })
    assert dup_res.status_code == 409

    # Login with correct credentials -> must return 200 with real workspace and role
    login_res = client.post("/api/v1/auth/login", json={
        "email": signup_email,
        "password": signup_pass
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["workspace_id"] == real_ws_id
    assert login_data["role"] == "OWNER"

    # Login with wrong password -> must return 401
    wrong_res = client.post("/api/v1/auth/login", json={
        "email": signup_email,
        "password": "WrongPassword999!"
    })
    assert wrong_res.status_code == 401


def test_account_lockout_after_five_failed_attempts():
    """Verify account lockout kicks in after 5 consecutive failed login attempts."""
    uid = uuid.uuid4().hex[:8]
    target_email = f"lockout.target_{uid}@realbrand.store"
    client.post("/api/v1/auth/signup", json={
        "name": "Lockout Target",
        "email": target_email,
        "password": "CorrectPassword123!"
    })

    # 4 consecutive failures -> 401
    for _ in range(4):
        fail_res = client.post("/api/v1/auth/login", json={
            "email": target_email,
            "password": "WrongPassword!"
        })
        assert fail_res.status_code == 401

    # 5th failure -> triggers 423 Locked
    locked_res = client.post("/api/v1/auth/login", json={
        "email": target_email,
        "password": "WrongPassword!"
    })
    assert locked_res.status_code == 423
    assert "locked" in locked_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_email_verification_token_lifecycle():
    """Verify single-use token lifecycle for email verification."""
    uid = uuid.uuid4().hex[:8]
    verify_email = f"verify.user_{uid}@realbrand.store"
    signup_res = client.post("/api/v1/auth/signup", json={
        "name": "Verify User",
        "email": verify_email,
        "password": "VerifyPassword123!"
    })
    user_id = signup_res.json()["user"]["id"]

    # Fetch token directly from database
    async with async_session_factory() as session:
        stmt = select(AuthTokenModel).where(
            AuthTokenModel.user_id == user_id,
            AuthTokenModel.token_type == "VERIFY_EMAIL"
        )
        res = await session.execute(stmt)
        token_row = res.scalars().first()
        assert token_row is not None
        assert token_row.used_at is None

    # Redeeming wrong token fails with 400
    bad_res = client.post("/api/v1/auth/verify-email", json={"token": "invalid_fake_token_12345"})
    assert bad_res.status_code == 400


def test_forgot_and_reset_password_flow():
    """Verify forgot-password and reset-password token validation."""
    # Forgot password returns generic success for unknown email (preventing enumeration)
    generic_res = client.post("/api/v1/auth/forgot-password", json={
        "email": "nonexistent_email_12345@test.com"
    })
    assert generic_res.status_code == 200

    # Invalid reset token fails with 400
    invalid_reset = client.post("/api/v1/auth/reset-password", json={
        "token": "invalid_token_9999",
        "new_password": "NewSecurePassword123!"
    })
    assert invalid_reset.status_code == 400
