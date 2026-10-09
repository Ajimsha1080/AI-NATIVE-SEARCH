"""
API Key Management Router:
- Generates scoped, rotatable API keys for programmatic access per workspace.
- Stores key hash at rest (SHA-256).
- Shows secret token only once upon creation.
- Provides listing, rotation, and revocation endpoints.
- Verifies workspace isolation and RBAC.
"""
import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_auth_context, hash_secure_token, require_role
from app.compliance import record_audit_event
from app.db.database import get_tenant_db_session
from app.db.models import ApiKeyModel, utcnow

router = APIRouter(prefix="/api/v1/api-keys", tags=["API Keys"])

VALID_SCOPES = {
    "catalog:read",
    "catalog:write",
    "chat:read",
    "chat:write",
    "orders:read",
    "orders:write",
    "analytics:read",
}


class CreateApiKeyRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    scopes: list[str] = Field(default_factory=lambda: ["catalog:read", "chat:read", "chat:write"])
    expires_in_days: int | None = Field(None, ge=1, le=365)


class RotateApiKeyRequest(BaseModel):
    expires_in_days: int | None = Field(None, ge=1, le=365)


def generate_raw_api_key() -> tuple[str, str, str]:
    """
    Generates a cryptographically strong API key.
    Format: sm_live_<24 random bytes base64url>
    Returns (raw_key, key_prefix, key_hash)
    """
    secret = secrets.token_urlsafe(24)
    raw_key = f"sm_live_{secret}"
    prefix = raw_key[:12]  # "sm_live_xxxx"
    key_hash = hash_secure_token(raw_key)
    return raw_key, prefix, key_hash


@router.post("")
async def create_api_key(
    req: CreateApiKeyRequest,
    auth_ctx: dict[str, Any] = Depends(require_role(["OWNER", "ADMIN"])),
    session: AsyncSession = Depends(get_tenant_db_session),
) -> dict[str, Any]:
    """Generates a new API key for the workspace. Returns the raw secret once."""
    ws_id = auth_ctx["workspace_id"]
    user_id = auth_ctx["user_id"]

    # Validate scopes
    for s in req.scopes:
        if s not in VALID_SCOPES:
            raise HTTPException(status_code=400, detail=f"Invalid scope '{s}'. Allowed: {sorted(list(VALID_SCOPES))}")

    raw_key, prefix, key_hash = generate_raw_api_key()

    expires_at = None
    if req.expires_in_days:
        expires_at = utcnow() + timedelta(days=req.expires_in_days)

    key_record = ApiKeyModel(
        id=f"apk_{uuid.uuid4().hex[:14]}",
        workspace_id=ws_id,
        created_by_user_id=user_id,
        name=req.name.strip(),
        key_prefix=prefix,
        key_hash=key_hash,
        scopes=req.scopes,
        expires_at=expires_at,
        created_at=utcnow(),
    )
    session.add(key_record)
    await session.commit()

    await record_audit_event(
        workspace_id=ws_id,
        action="API_KEY_CREATED",
        actor_id=user_id,
        resource_type="api_key",
        resource_id=key_record.id,
        details={"name": key_record.name, "prefix": prefix, "scopes": req.scopes},
    )

    return {
        "success": True,
        "message": "API key generated successfully. Save this secret now; it will not be displayed again.",
        "api_key": {
            "id": key_record.id,
            "name": key_record.name,
            "key": raw_key,
            "prefix": prefix,
            "scopes": key_record.scopes,
            "expires_at": expires_at.isoformat() if expires_at else None,
            "created_at": key_record.created_at.isoformat(),
        },
    }


@router.get("")
async def list_api_keys(
    auth_ctx: dict[str, Any] = Depends(require_role(["OWNER", "ADMIN"])),
    session: AsyncSession = Depends(get_tenant_db_session),
) -> dict[str, Any]:
    """Lists all active and revoked API keys for the workspace."""
    ws_id = auth_ctx["workspace_id"]
    res = await session.execute(
        select(ApiKeyModel)
        .where(ApiKeyModel.workspace_id == ws_id)
        .order_by(ApiKeyModel.created_at.desc())
    )
    keys = res.scalars().all()

    now = utcnow()
    results = []
    for k in keys:
        is_active = (k.revoked_at is None) and (k.expires_at is None or k.expires_at > now)
        results.append({
            "id": k.id,
            "name": k.name,
            "prefix": k.key_prefix,
            "scopes": k.scopes,
            "is_active": is_active,
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
            "expires_at": k.expires_at.isoformat() if k.expires_at else None,
            "revoked_at": k.revoked_at.isoformat() if k.revoked_at else None,
            "created_at": k.created_at.isoformat(),
        })

    return {"api_keys": results}


@router.delete("/{key_id}")
async def revoke_api_key(
    key_id: str,
    auth_ctx: dict[str, Any] = Depends(require_role(["OWNER", "ADMIN"])),
    session: AsyncSession = Depends(get_tenant_db_session),
) -> dict[str, Any]:
    """Revokes an API key immediately."""
    ws_id = auth_ctx["workspace_id"]
    res = await session.execute(
        select(ApiKeyModel).where(
            ApiKeyModel.id == key_id,
            ApiKeyModel.workspace_id == ws_id,
        )
    )
    key_record = res.scalars().first()
    if not key_record:
        raise HTTPException(status_code=404, detail="API key not found.")

    if key_record.revoked_at is not None:
        return {"success": True, "message": "API key was already revoked."}

    key_record.revoked_at = utcnow()
    await session.commit()

    await record_audit_event(
        workspace_id=ws_id,
        action="API_KEY_REVOKED",
        actor_id=auth_ctx["user_id"],
        resource_type="api_key",
        resource_id=key_id,
        details={"name": key_record.name, "prefix": key_record.key_prefix},
    )

    return {"success": True, "message": "API key has been revoked."}


@router.post("/{key_id}/rotate")
async def rotate_api_key(
    key_id: str,
    req: RotateApiKeyRequest,
    auth_ctx: dict[str, Any] = Depends(require_role(["OWNER", "ADMIN"])),
    session: AsyncSession = Depends(get_tenant_db_session),
) -> dict[str, Any]:
    """
    Rotates an API key:
    - Revokes the old key.
    - Creates a new key with identical scopes and name.
    - Returns the new plaintext key secret once.
    """
    ws_id = auth_ctx["workspace_id"]
    res = await session.execute(
        select(ApiKeyModel).where(
            ApiKeyModel.id == key_id,
            ApiKeyModel.workspace_id == ws_id,
        )
    )
    old_key = res.scalars().first()
    if not old_key:
        raise HTTPException(status_code=404, detail="API key not found.")

    # Revoke old
    old_key.revoked_at = utcnow()

    # Generate new
    raw_key, prefix, key_hash = generate_raw_api_key()
    expires_at = None
    if req.expires_in_days:
        expires_at = utcnow() + timedelta(days=req.expires_in_days)
    elif old_key.expires_at:
        expires_at = old_key.expires_at

    new_key = ApiKeyModel(
        id=f"apk_{uuid.uuid4().hex[:14]}",
        workspace_id=ws_id,
        created_by_user_id=auth_ctx["user_id"],
        name=old_key.name,
        key_prefix=prefix,
        key_hash=key_hash,
        scopes=old_key.scopes,
        expires_at=expires_at,
        created_at=utcnow(),
    )
    session.add(new_key)
    await session.commit()

    await record_audit_event(
        workspace_id=ws_id,
        action="API_KEY_ROTATED",
        actor_id=auth_ctx["user_id"],
        resource_type="api_key",
        resource_id=new_key.id,
        details={"old_key_id": old_key.id, "new_prefix": prefix},
    )

    return {
        "success": True,
        "message": "API key rotated successfully. The old key is revoked. Save your new secret now.",
        "api_key": {
            "id": new_key.id,
            "name": new_key.name,
            "key": raw_key,
            "prefix": prefix,
            "scopes": new_key.scopes,
            "expires_at": expires_at.isoformat() if expires_at else None,
            "created_at": new_key.created_at.isoformat(),
        },
    }
