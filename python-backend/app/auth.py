import os
import jwt
from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, Depends
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

DISALLOWED_DEFAULT_SECRETS = [
    "super_secret_jwt_key_enterprise_grade_aaas_platform_2026",
    "super_secret_jwt_key_change_in_production",
    "secret",
    "changeme",
    "password",
    "test",
    "admin",
    "12345678901234567890123456789012"
]

def get_service_secret() -> str:
    app_env = os.getenv("APP_ENV") or os.getenv("NODE_ENV") or os.getenv("ENVIRONMENT")
    secret = (
        os.getenv("INTERNAL_SERVICE_SECRET")
        or os.getenv("SERVICE_JWT_SECRET")
        or os.getenv("JWT_SECRET")
    )
    if not secret:
        if app_env == "development":
            return "development_only_service_secret_32bytes_long!"
        raise RuntimeError(
            "Security Error: SERVICE_JWT_SECRET / INTERNAL_SERVICE_SECRET is missing. "
            "Explicit APP_ENV=development is required to use local fallback secrets."
        )
    
    clean = secret.strip()
    if len(clean) < 32:
        raise RuntimeError("Security Error: Service JWT secret must be at least 32 characters long.")
    if clean in DISALLOWED_DEFAULT_SECRETS:
        raise RuntimeError("Security Error: Service JWT secret is using a known insecure default secret.")
    return clean

# Validate secret fail-closed at import time
SERVICE_SECRET = get_service_secret()

ALLOWED_ALGORITHMS = ["HS256"]

def decode_token(token: str) -> Dict[str, Any]:
    secret = get_service_secret()
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=ALLOWED_ALGORITHMS,
            audience="aaas-python",
            issuer="aaas-node",
            leeway=60,
            options={
                "require": ["exp", "iss", "aud"],
                "verify_exp": True,
                "verify_aud": True,
                "verify_iss": True
            }
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Service token has expired")
    except (jwt.InvalidTokenError, jwt.InvalidAudienceError, jwt.InvalidIssuerError) as e:
        raise HTTPException(status_code=401, detail=f"Invalid service token: {str(e)}")

def verify_service_jwt(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    Strict Service-to-Service JWT Verification.
    Derives workspace_id ONLY from verified token claims.
    Never accepts unverified client-supplied tenancy.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Authorization header with Bearer service token is required"
        )
    
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_token(token)
    
    workspace_id = payload.get("workspace_id") or payload.get("workspaceId")
    if not workspace_id:
        raise HTTPException(
            status_code=401,
            detail="Forbidden: JWT missing required 'workspace_id' claim"
        )
    
    role = payload.get("role", "MEMBER")
    is_super_admin = bool(payload.get("isSuperAdmin") is True or role == "SUPERADMIN")

    return {
        "workspace_id": workspace_id,
        "user_id": payload.get("userId") or payload.get("sub") or "service_system",
        "role": role,
        "is_super_admin": is_super_admin
    }

def require_admin_auth(claims: Dict[str, Any] = Depends(verify_service_jwt)) -> Dict[str, Any]:
    """Requires verified admin privileges or super-admin claims."""
    if not claims.get("is_super_admin") and claims.get("role") not in ["OWNER", "ADMIN", "SUPERADMIN"]:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Admin or Owner role required"
        )
    return claims

