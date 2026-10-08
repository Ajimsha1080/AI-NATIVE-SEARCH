import pytest
from app.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    revoke_token,
    is_token_revoked
)

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
    
    # Revoke token
    revoke_token(token)
    assert is_token_revoked(token)

    # Decoding must raise HTTPException 401
    with pytest.raises(Exception) as exc_info:
        decode_token(token)
    assert "revoked" in str(exc_info.value).lower()
