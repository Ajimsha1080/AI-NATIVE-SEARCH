import time
from typing import Any

import jwt
from fastapi import Depends, Header, HTTPException

from .config import settings

ALLOWED_ALGORITHMS = ["HS256"]
ACCESS_TOKEN_EXPIRE_SECONDS = 15 * 60  # 15 minutes
REFRESH_TOKEN_EXPIRE_SECONDS = 7 * 24 * 60 * 60  # 7 days

# Token Revocation Store (In-Memory with Redis protocol readiness)
_revoked_tokens = set()

def revoke_token(jti_or_token: str) -> None:
    _revoked_tokens.add(jti_or_token)

def is_token_revoked(jti_or_token: str) -> bool:
    return jti_or_token in _revoked_tokens

def create_access_token(
    user_id: str,
    email: str,
    workspace_id: str,
    role: str = "OWNER",
    is_super_admin: bool = False
) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "userId": user_id,
        "email": email,
        "workspace_id": workspace_id,
        "workspaceId": workspace_id,
        "role": role,
        "is_super_admin": is_super_admin,
        "type": "access",
        "iss": "shopmate-auth",
        "aud": "shopmate-api",
        "iat": now,
        "exp": now + ACCESS_TOKEN_EXPIRE_SECONDS
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

def create_refresh_token(
    user_id: str,
    workspace_id: str
) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "userId": user_id,
        "workspace_id": workspace_id,
        "type": "refresh",
        "iss": "shopmate-auth",
        "aud": "shopmate-api",
        "iat": now,
        "exp": now + REFRESH_TOKEN_EXPIRE_SECONDS
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

def decode_token(token: str, expected_type: str = "access") -> dict[str, Any]:
    if is_token_revoked(token):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    try:
        # Check against both JWT_SECRET and SERVICE_JWT_SECRET for backward compatibility
        secrets_to_try = [settings.JWT_SECRET, settings.SERVICE_JWT_SECRET]
        last_err = None

        for secret in secrets_to_try:
            try:
                payload = jwt.decode(
                    token,
                    secret,
                    algorithms=ALLOWED_ALGORITHMS,
                    options={
                        "verify_exp": True,
                        "verify_aud": False,
                        "verify_iss": False
                    }
                )

                # Check revocation by subject or JTI if present
                if payload.get("jti") and is_token_revoked(payload["jti"]):
                    raise HTTPException(status_code=401, detail="Token has been revoked")

                if payload.get("type") and payload.get("type") != expected_type:
                    raise HTTPException(status_code=401, detail=f"Invalid token type: expected {expected_type}")

                return payload
            except jwt.ExpiredSignatureError:
                raise HTTPException(status_code=401, detail="Token has expired")
            except Exception as e:
                last_err = e

        raise HTTPException(status_code=401, detail=f"Invalid token: {last_err!s}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e!s}")

def verify_jwt_auth(authorization: str | None = Header(None)) -> dict[str, Any]:
    """Verifies access token from Authorization: Bearer <token>."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Authorization header with Bearer token is required"
        )

    token = authorization.split(" ", 1)[1].strip()
    payload = decode_token(token, expected_type="access")

    workspace_id = payload.get("workspace_id") or payload.get("workspaceId") or "ws_acme_corp"
    role = payload.get("role", "OWNER")
    is_super_admin = bool(payload.get("is_super_admin") or role in ["SUPERADMIN", "SUPER_ADMIN"])

    return {
        "user_id": payload.get("userId") or payload.get("sub"),
        "email": payload.get("email"),
        "workspace_id": workspace_id,
        "role": role,
        "is_super_admin": is_super_admin,
        "token": token
    }

def verify_service_jwt(authorization: str | None = Header(None)) -> dict[str, Any]:
    """Compatibility wrapper for service calls."""
    return verify_jwt_auth(authorization)

def require_admin_auth(claims: dict[str, Any] = Depends(verify_jwt_auth)) -> dict[str, Any]:
    if not claims.get("is_super_admin") and claims.get("role") not in ["OWNER", "ADMIN", "SUPERADMIN"]:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Admin or Owner role required"
        )
    return claims
