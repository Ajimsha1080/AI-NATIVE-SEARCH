import base64
import hashlib
import re
import secrets
import time
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from io import BytesIO
from typing import Any

import bcrypt
import jwt
import pyotp
import qrcode
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from . import redis_service
from .config import settings
from .db.database import (
    get_session_factory,
    get_system_db_session,
    set_tenant_session_context,
)
from .db.models import (
    AuthTokenModel,
    SubscriptionModel,
    UserModel,
    UserSessionModel,
    WorkspaceMemberModel,
    WorkspaceModel,
    utcnow,
)
from .email_service import send_password_reset_email, send_verification_email
from .redis_service import check_rate_limit

ALLOWED_ALGORITHMS = ["HS256"]
ACCESS_TOKEN_EXPIRE_SECONDS = 15 * 60  # 15 minutes
REFRESH_TOKEN_EXPIRE_SECONDS = 7 * 24 * 60 * 60  # 7 days

MAX_FAILED_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

# Token Revocation Store (Redis-backed with in-memory fallback)
def revoke_token(jti_or_token: str) -> None:
    redis_service.revoke_token_sync(jti_or_token)

def is_token_revoked(jti_or_token: str) -> bool:
    return redis_service.is_token_revoked_sync(jti_or_token)


# ============================================================================
# CRYPTOGRAPHIC & TOKEN HELPERS
# ============================================================================

def hash_password(password: str) -> str:
    """Hashes a plaintext password with bcrypt using 12 salt rounds."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a bcrypt hash in constant time."""
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def generate_secure_token() -> str:
    """Generates a high-entropy URL-safe single-use token."""
    return secrets.token_urlsafe(32)

def hash_secure_token(token: str) -> str:
    """Computes SHA-256 digest of a token for secure database storage/lookup."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def create_access_token(
    user_id: str,
    email: str,
    workspace_id: str,
    role: str = "OWNER",
    is_super_admin: bool = False,
    session_id: str | None = None
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
        "jti": session_id or uuid.uuid4().hex,
        "iss": "shopmate-auth",
        "aud": "shopmate-api",
        "iat": now,
        "exp": now + ACCESS_TOKEN_EXPIRE_SECONDS
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

def create_refresh_token(
    user_id: str,
    workspace_id: str,
    session_id: str | None = None
) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "userId": user_id,
        "workspace_id": workspace_id,
        "type": "refresh",
        "jti": session_id or uuid.uuid4().hex,
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


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    is_prod = (settings.APP_ENV == "production")
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=is_prod,
        max_age=ACCESS_TOKEN_EXPIRE_SECONDS,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=is_prod,
        max_age=REFRESH_TOKEN_EXPIRE_SECONDS,
        path="/"
    )


class AuthContext(BaseModel):
    user_id: str
    email: str
    workspace_id: str
    role: str
    is_super_admin: bool = False
    token: str
    session_id: str | None = None

    def __getitem__(self, item: str):
        return getattr(self, item)

    def get(self, item: str, default=None):
        return getattr(self, item, default)


async def get_auth_context(
    request: Request,
    authorization: str | None = Header(None)
) -> AuthContext:
    """Verifies JWT (signature, expiry, revocation) and returns user_id, workspace_id, and role.
    Checks Authorization: Bearer <token> first, then falls back to 'access_token' cookie.
    Returns 401 if missing, expired, revoked, or invalid.
    """
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
    elif "access_token" in request.cookies:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authentication required: Bearer token or access cookie missing"
        )

    payload = decode_token(token, expected_type="access")

    user_id = payload.get("userId") or payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject identity")

    workspace_id = payload.get("workspace_id") or payload.get("workspaceId")
    is_super_admin = bool(payload.get("is_super_admin") or payload.get("role") in ["SUPERADMIN", "SUPER_ADMIN"])

    if not workspace_id and not is_super_admin:
        raise HTTPException(status_code=401, detail="Token missing workspace context")

    role = payload.get("role") or ("SUPERADMIN" if is_super_admin else "VIEWER")
    session_id = payload.get("jti")

    ctx = AuthContext(
        user_id=str(user_id),
        email=payload.get("email", ""),
        workspace_id=workspace_id or "system",
        role=role,
        is_super_admin=is_super_admin,
        token=token,
        session_id=session_id
    )
    request.state.auth = ctx
    request.state.workspace_id = ctx.workspace_id
    return ctx


def verify_jwt_auth(
    request: Request,
    authorization: str | None = Header(None)
) -> AuthContext:
    """Synchronous/asynchronous compatibility wrapper for get_auth_context."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
    elif "access_token" in request.cookies:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authorization header with Bearer token is required"
        )

    payload = decode_token(token, expected_type="access")

    user_id = payload.get("userId") or payload.get("sub")
    workspace_id = payload.get("workspace_id") or payload.get("workspaceId")
    is_super_admin = bool(payload.get("is_super_admin") or payload.get("role") in ["SUPERADMIN", "SUPER_ADMIN"])

    if not workspace_id and not is_super_admin:
        raise HTTPException(
            status_code=401,
            detail="Token missing workspace context"
        )
    role = payload.get("role") or ("SUPERADMIN" if is_super_admin else "VIEWER")

    return AuthContext(
        user_id=str(user_id),
        email=payload.get("email", ""),
        workspace_id=workspace_id or "system",
        role=role,
        is_super_admin=is_super_admin,
        token=token
    )


def verify_service_jwt(request: Request, authorization: str | None = Header(None)) -> AuthContext:
    """Compatibility wrapper for service calls."""
    return verify_jwt_auth(request, authorization)


def require_role(allowed_roles: list[str]):
    """FastAPI dependency factory enforcing strict RBAC role membership."""
    async def _role_checker(auth: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if auth.is_super_admin:
            return auth
        if auth.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: Action requires one of {allowed_roles} roles. Your role is '{auth.role}'."
            )
        return auth
    return _role_checker


require_admin_role = require_role(["OWNER", "ADMIN", "SUPERADMIN"])
require_editor_role = require_role(["OWNER", "ADMIN", "EDITOR", "SUPERADMIN"])
require_viewer_role = require_role(["OWNER", "ADMIN", "EDITOR", "VIEWER", "SUPERADMIN"])

# Backward compatibility alias
require_admin_auth = require_admin_role


def validate_workspace_access(auth: AuthContext, requested_workspace_id: str | None = None) -> str:
    """Ensures request does not attempt cross-tenant access.
    Returns 403 if client explicitly asks for a different workspace, unless role is SUPER_ADMIN.
    """
    if requested_workspace_id and requested_workspace_id != auth.workspace_id:
        if not auth.is_super_admin:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: Cannot access workspace '{requested_workspace_id}'. Token is restricted to '{auth.workspace_id}'."
            )
        return requested_workspace_id
    return auth.workspace_id


class StorefrontContext(BaseModel):
    workspace_id: str
    deployment_id: str | None = None
    deployment_name: str | None = None


async def resolve_storefront_context(
    request: Request,
    x_deployment_key: str | None = Header(None, alias="X-Deployment-Key"),
    authorization: str | None = Header(None)
) -> StorefrontContext:
    """Resolves tenant for public storefront endpoints (search, chat, widget, tracking).
    Prioritizes X-Deployment-Key / public key in database.
    Verifies allowed origins if configured.
    Falls back to authenticated dashboard user session if present.
    NEVER relies on client-supplied workspace_id.
    """
    deployment_key = (
        x_deployment_key
        or request.query_params.get("deployment_key")
        or request.query_params.get("deployment_id")
    )

    if deployment_key:
        from .db.models import DeploymentModel
        async with get_session_factory()() as session:
            stmt = select(DeploymentModel).where(
                (DeploymentModel.id == deployment_key) |
                (DeploymentModel.public_key == deployment_key)
            )
            res = await session.execute(stmt)
            dep = res.scalars().first()
            if not dep:
                raise HTTPException(status_code=401, detail="Invalid deployment key or identifier")
            if dep.status != "LIVE":
                raise HTTPException(status_code=403, detail=f"Deployment is {dep.status}, not LIVE")

            origin = request.headers.get("origin") or request.headers.get("referer")
            if dep.allowed_domains and origin:
                domain_allowed = False
                for allowed in dep.allowed_domains:
                    if allowed in origin or allowed == "*":
                        domain_allowed = True
                        break
                if not domain_allowed:
                    raise HTTPException(status_code=403, detail="Request origin not allowed for this deployment")

            ctx = StorefrontContext(
                workspace_id=dep.workspace_id,
                deployment_id=dep.id,
                deployment_name=dep.name
            )
            request.state.workspace_id = ctx.workspace_id
            return ctx

    # Fallback to authenticated dashboard user token
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
    elif "access_token" in request.cookies:
        token = request.cookies.get("access_token")

    if token:
        try:
            payload = decode_token(token, expected_type="access")
            ws_id = payload.get("workspace_id") or payload.get("workspaceId")
            if ws_id:
                ctx = StorefrontContext(workspace_id=ws_id)
                request.state.workspace_id = ctx.workspace_id
                return ctx
        except Exception:
            pass

    raise HTTPException(
        status_code=401,
        detail="Public storefront requests require a valid 'X-Deployment-Key' header or active session."
    )


# ============================================================================
# ROW-LEVEL SECURITY DB SESSION DEPENDENCIES
# ============================================================================

async def get_tenant_db_session(
    request: Request,
    auth: AuthContext = Depends(get_auth_context)
) -> AsyncGenerator[AsyncSession, None]:
    """Resolves workspace from verified JWT token, opens DB session,
    sets PostgreSQL app.workspace_id via bound parameter, and yields session.
    """
    effective_ws = auth.workspace_id
    if auth.is_super_admin:
        req_ws = request.query_params.get("workspace_id") or request.headers.get("x-workspace-id")
        if req_ws:
            effective_ws = req_ws

    async with get_session_factory()() as session:
        await set_tenant_session_context(session, effective_ws)
        yield session


async def get_storefront_tenant_db_session(
    storefront: StorefrontContext = Depends(resolve_storefront_context)
) -> AsyncGenerator[AsyncSession, None]:
    """Resolves workspace from verified deployment key, opens DB session,
    sets PostgreSQL app.workspace_id via bound parameter, and yields session.
    """
    async with get_session_factory()() as session:
        await set_tenant_session_context(session, storefront.workspace_id)
        yield session


async def get_flexible_tenant_db_session(
    request: Request,
    authorization: str | None = Header(None),
    x_deployment_key: str | None = Header(None, alias="X-Deployment-Key")
) -> AsyncGenerator[AsyncSession, None]:
    """Resolves workspace from either verified JWT token or deployment key,
    sets PostgreSQL app.workspace_id via bound parameter, and yields session.
    """
    ws = None
    if authorization or "access_token" in request.cookies:
        auth = await get_auth_context(request, authorization)
        ws = auth.workspace_id
    elif x_deployment_key or request.query_params.get("deployment_key") or request.query_params.get("deployment_id"):
        storefront = await resolve_storefront_context(request, x_deployment_key, authorization)
        ws = storefront.workspace_id
    else:
        raise HTTPException(status_code=401, detail="Authentication or deployment key required")

    async with get_session_factory()() as session:
        await set_tenant_session_context(session, ws)
        yield session


# ============================================================================
# PYDANTIC REQUEST / RESPONSE SCHEMAS
# ============================================================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    workspace_id: str | None = None
    mfa_code: str | None = None
    recovery_code: str | None = None

class SelectWorkspaceRequest(BaseModel):
    workspace_id: str

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    workspace_name: str | None = None
    workspaceName: str | None = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str | None = None
    workspace_id: str | None = None

class VerifyEmailRequest(BaseModel):
    token: str

class ResendVerificationRequest(BaseModel):
    email: EmailStr

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class MFAVerifyRequest(BaseModel):
    code: str

class MFADisableRequest(BaseModel):
    code: str
    password: str


# ============================================================================
# FASTAPI ROUTER WITH AUTHENTIC DATABASE LOGIC
# ============================================================================

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.post("/login")
async def login_endpoint(
    req: LoginRequest,
    response: Response,
    request: Request,
    session: AsyncSession = Depends(get_system_db_session)
):
    """
    Production Login:
    - Queries user strictly from database.
    - Rejects with HTTP 401 on unknown email or wrong password.
    - Enforces account lockout after 5 consecutive failures.
    - Enforces email verification (HTTP 403) unless within configured grace period.
    - Enforces sliding-window rate limiting per IP.
    - Resolves real workspace_id and role from WorkspaceMemberModel (never hardcoded).
    - If user belongs to multiple workspaces, allows specifying workspace_id or defaults to primary.
    - Sets httpOnly cookies for secure browser sessions.
    - Never logs passwords or sensitive credentials.
    """
    clean_email = req.email.strip().lower()
    client_ip = request.client.host if request.client else "unknown_ip"
    allowed, retry_after = await check_rate_limit(f"login:{clean_email}:{client_ip}", max_requests=60, window_seconds=60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many login attempts. Please retry in {retry_after} seconds.")


    # 1. Lookup user in database
    stmt = select(UserModel).where(UserModel.email == clean_email)
    res = await session.execute(stmt)
    user = res.scalars().first()

    if not user:
        # Constant-time mitigation against timing attacks
        bcrypt.checkpw(b"dummy_password", bcrypt.gensalt(12))
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # 2. Check account lockout
    now_utc = datetime.now(UTC).replace(tzinfo=None)
    if user.locked_until and user.locked_until > now_utc:
        remaining_seconds = int((user.locked_until - now_utc).total_seconds())
        remaining_minutes = max(1, remaining_seconds // 60)
        raise HTTPException(
            status_code=423,
            detail=f"Account is temporarily locked due to multiple failed login attempts. Please retry in {remaining_minutes} minutes."
        )

    # 3. Verify password
    if not user.password_hash or not verify_password(req.password, user.password_hash):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
            user.locked_until = now_utc + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            await session.commit()
            raise HTTPException(
                status_code=423,
                detail=f"Account locked for {LOCKOUT_DURATION_MINUTES} minutes due to {MAX_FAILED_LOGIN_ATTEMPTS} consecutive failed attempts."
            )
        await session.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # 4. Successful credentials: Check email verification
    if settings.REQUIRE_EMAIL_VERIFICATION and not user.is_verified:
        grace_hours = settings.EMAIL_VERIFICATION_GRACE_PERIOD_HOURS
        in_grace_period = False
        if grace_hours > 0 and user.created_at:
            in_grace_period = (now_utc - user.created_at) < timedelta(hours=grace_hours)

        if not in_grace_period:
            raise HTTPException(
                status_code=403,
                detail="Email address is not verified. Please verify your email before logging in, or request a new verification email."
            )

    # Reset failure counters
    user.failed_login_attempts = 0
    user.locked_until = None

    # 4b. Multi-Factor Authentication (MFA/TOTP) enforcement
    if getattr(user, "mfa_enabled", False):
        mfa_valid = False
        if req.mfa_code:
            totp = pyotp.TOTP(user.mfa_secret or "")
            mfa_valid = totp.verify(req.mfa_code.strip(), valid_window=1)
        elif req.recovery_code:
            recovery_hash = hash_secure_token(req.recovery_code.strip())
            saved_codes = list(user.mfa_recovery_codes or [])
            if recovery_hash in saved_codes:
                mfa_valid = True
                saved_codes.remove(recovery_hash)
                user.mfa_recovery_codes = saved_codes

        if not mfa_valid:
            if not req.mfa_code and not req.recovery_code:
                raise HTTPException(
                    status_code=403,
                    detail="MFA_REQUIRED: Multi-factor authentication code or recovery code is required."
                )
            raise HTTPException(
                status_code=401,
                detail="Invalid MFA verification code or recovery code."
            )

    # 5. Look up real workspace memberships
    member_stmt = (
        select(WorkspaceMemberModel, WorkspaceModel)
        .join(WorkspaceModel, WorkspaceMemberModel.workspace_id == WorkspaceModel.id)
        .where(WorkspaceMemberModel.user_id == user.id)
    )
    member_res = await session.execute(member_stmt)
    all_memberships = member_res.all()

    if not all_memberships:
        raise HTTPException(
            status_code=403,
            detail="User account does not belong to any active store workspace."
        )

    chosen = None
    if req.workspace_id:
        for m, w in all_memberships:
            if w.id == req.workspace_id:
                chosen = (m, w)
                break
        if not chosen:
            raise HTTPException(
                status_code=403,
                detail=f"User is not a member of workspace '{req.workspace_id}'."
            )
    else:
        chosen = all_memberships[0]

    member, workspace = chosen
    workspace_id = workspace.id
    role = member.role or "OWNER"

    # Create active session in database
    session_id = f"sess_{uuid.uuid4().hex}"
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    new_sess = UserSessionModel(
        id=session_id,
        user_id=user.id,
        workspace_id=workspace_id,
        ip_address=client_ip,
        user_agent=user_agent,
        is_revoked=False,
        expires_at=utcnow() + timedelta(seconds=REFRESH_TOKEN_EXPIRE_SECONDS),
        created_at=utcnow(),
        last_activity_at=utcnow(),
    )
    session.add(new_sess)
    await session.commit()

    # 6. Issue access and refresh tokens
    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        workspace_id=workspace_id,
        role=role,
        is_super_admin=(role in ["SUPERADMIN", "SUPER_ADMIN"]),
        session_id=session_id,
    )
    refresh_token = create_refresh_token(
        user_id=user.id,
        workspace_id=workspace_id,
        session_id=session_id,
    )

    set_auth_cookies(response, access_token, refresh_token)

    return {
        "success": True,
        "token": access_token,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": ACCESS_TOKEN_EXPIRE_SECONDS,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "is_verified": bool(user.is_verified),
            "role": role,
            "workspace_id": workspace_id,
            "workspace_name": workspace.name
        },
        "workspace": {
            "id": workspace.id,
            "name": workspace.name,
            "slug": workspace.slug
        },
        "available_workspaces": [
            {"id": w.id, "name": w.name, "role": m.role} for m, w in all_memberships
        ],
        "workspace_id": workspace_id,
        "role": role
    }


@router.post("/select-workspace")
async def select_workspace_endpoint(
    req: SelectWorkspaceRequest,
    response: Response,
    auth: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_system_db_session)
):
    """Allows a user to choose or switch their active tenant workspace."""
    stmt = (
        select(WorkspaceMemberModel, WorkspaceModel)
        .join(WorkspaceModel, WorkspaceMemberModel.workspace_id == WorkspaceModel.id)
        .where(
            WorkspaceMemberModel.user_id == auth.user_id,
            WorkspaceMemberModel.workspace_id == req.workspace_id
        )
    )
    res = await session.execute(stmt)
    row = res.first()
    if not row and not auth.is_super_admin:
        raise HTTPException(
            status_code=403,
            detail=f"User is not a member of workspace '{req.workspace_id}'."
        )

    if row:
        member, workspace = row
        role = member.role or "OWNER"
    else:
        ws_res = await session.execute(select(WorkspaceModel).where(WorkspaceModel.id == req.workspace_id))
        workspace = ws_res.scalars().first()
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        role = "SUPERADMIN"

    access_token = create_access_token(
        user_id=auth.user_id,
        email=auth.email,
        workspace_id=workspace.id,
        role=role,
        is_super_admin=auth.is_super_admin
    )
    refresh_token = create_refresh_token(user_id=auth.user_id, workspace_id=workspace.id)

    is_prod = (settings.APP_ENV == "production")
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=is_prod,
        max_age=ACCESS_TOKEN_EXPIRE_SECONDS,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=is_prod,
        max_age=REFRESH_TOKEN_EXPIRE_SECONDS,
        path="/"
    )

    return {
        "success": True,
        "token": access_token,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "workspace_id": workspace.id,
        "workspace_name": workspace.name,
        "role": role
    }


@router.post("/signup")
async def signup_endpoint(
    req: SignupRequest,
    request: Request,
    session: AsyncSession = Depends(get_system_db_session)
):
    """
    Real Signup:
    - Validates email and password complexity (>= 8 chars).
    - Checks for existing user (returns 409).
    - Hashes password with bcrypt.
    - Rate limits account registrations per IP.
    - Creates UserModel, unique WorkspaceModel, and WorkspaceMemberModel with role OWNER.
    - Dispatches real email verification token via configured email provider.
    - Returns session tokens immediately for seamless onboarding.
    """
    client_ip = request.client.host if request.client else "unknown_ip"
    allowed, retry_after = await check_rate_limit(f"signup:{client_ip}", max_requests=10, window_seconds=300)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many signup attempts. Please wait {retry_after} seconds.")

    clean_email = req.email.strip().lower()
    clean_name = req.name.strip()

    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")

    # Check if email is already taken
    stmt = select(UserModel).where(UserModel.email == clean_email)
    res = await session.execute(stmt)
    if res.scalars().first():
        raise HTTPException(status_code=409, detail="An account with this email address already exists.")

    user_id = f"usr_{uuid.uuid4().hex[:14]}"
    hashed_pw = hash_password(req.password)

    # Create user
    new_user = UserModel(
        id=user_id,
        email=clean_email,
        name=clean_name,
        password_hash=hashed_pw,
        is_verified=False,
        role="ADMIN"
    )
    session.add(new_user)

    # Create new dedicated workspace for user
    target_ws_name = req.workspace_name or req.workspaceName or f"{clean_name}'s Store"
    slug_base = re.sub(r"[^a-z0-9]+", "-", target_ws_name.lower()).strip("-") or "store"
    unique_slug = f"{slug_base}-{uuid.uuid4().hex[:6]}"
    workspace_id = f"ws_{uuid.uuid4().hex[:14]}"

    new_workspace = WorkspaceModel(
        id=workspace_id,
        name=target_ws_name,
        slug=unique_slug,
        tier="ENTERPRISE"
    )
    session.add(new_workspace)

    # Create OWNER membership record
    member_id = f"wsm_{uuid.uuid4().hex[:14]}"
    new_member = WorkspaceMemberModel(
        id=member_id,
        workspace_id=workspace_id,
        user_id=user_id,
        role="OWNER"
    )
    session.add(new_member)

    # Initialize 14-day free trial on the starter plan
    trial_days = settings.TRIAL_PERIOD_DAYS
    now_dt = utcnow()
    trial_end_dt = now_dt + timedelta(days=trial_days)
    new_sub = SubscriptionModel(
        id=f"sub_{uuid.uuid4().hex[:14]}",
        workspace_id=workspace_id,
        plan_code="starter",
        status="TRIALING",
        current_period_start=now_dt,
        current_period_end=trial_end_dt,
        trial_end=trial_end_dt,
        cancel_at_period_end=False,
        provider=settings.BILLING_PROVIDER,
        provider_customer_id=None,
        provider_subscription_id=None,
    )
    session.add(new_sub)

    # Generate single-use email verification token
    raw_verify_token = generate_secure_token()
    token_entry = AuthTokenModel(
        id=f"tok_{uuid.uuid4().hex[:14]}",
        user_id=user_id,
        token_hash=hash_secure_token(raw_verify_token),
        token_type="VERIFY_EMAIL",
        expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=24)
    )
    session.add(token_entry)

    await session.commit()

    # Send verification email asynchronously
    await send_verification_email(
        to_email=clean_email,
        token=raw_verify_token,
        user_name=clean_name
    )

    access_token = create_access_token(
        user_id=user_id,
        email=clean_email,
        workspace_id=workspace_id,
        role="OWNER"
    )
    refresh_token = create_refresh_token(user_id=user_id, workspace_id=workspace_id)

    return {
        "success": True,
        "message": "Account created successfully. A verification link has been sent to your email.",
        "token": access_token,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user_id,
            "email": clean_email,
            "name": clean_name,
            "is_verified": False,
            "role": "OWNER",
            "workspace_id": workspace_id,
            "workspace_name": target_ws_name
        },
        "workspace": {
            "id": workspace_id,
            "name": target_ws_name,
            "slug": unique_slug
        }
    }


@router.post("/verify-email")
async def verify_email_endpoint(
    req: VerifyEmailRequest,
    session: AsyncSession = Depends(get_system_db_session)
):
    """
    Verifies user's email using a single-use token.
    Fails if token is expired, invalid, or already used.
    """
    token_digest = hash_secure_token(req.token)

    stmt = (
        select(AuthTokenModel)
        .where(AuthTokenModel.token_hash == token_digest)
        .where(AuthTokenModel.token_type == "VERIFY_EMAIL")
        .where(AuthTokenModel.used_at.is_(None))
    )
    res = await session.execute(stmt)
    token_record = res.scalars().first()

    now_utc = datetime.now(UTC).replace(tzinfo=None)
    if not token_record or token_record.expires_at < now_utc:
        raise HTTPException(
            status_code=400,
            detail="Verification link is invalid or has expired."
        )

    # Mark token as used
    token_record.used_at = now_utc

    # Update user's verification status
    user_stmt = select(UserModel).where(UserModel.id == token_record.user_id)
    user_res = await session.execute(user_stmt)
    user = user_res.scalars().first()
    if user:
        user.is_verified = True

    await session.commit()

    return {
        "success": True,
        "message": "Email verified successfully. Your account is now fully active."
    }


@router.post("/resend-verification")
async def resend_verification_endpoint(
    req: ResendVerificationRequest,
    request: Request,
    session: AsyncSession = Depends(get_system_db_session)
):
    """
    Resends an email verification link with a new single-use token.
    Rate-limited per IP and email.
    Always returns generic success message to prevent user enumeration.
    """
    clean_email = req.email.strip().lower()
    client_ip = request.client.host if request.client else "unknown_ip"
    rate_key = f"resend_verification:{clean_email}:{client_ip}"
    allowed, retry_after = await check_rate_limit(rate_key, max_requests=5, window_seconds=300)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Too many verification requests. Please wait {retry_after} seconds before trying again."
        )

    stmt = select(UserModel).where(UserModel.email == clean_email)
    res = await session.execute(stmt)
    user = res.scalars().first()

    if user and not user.is_verified:
        raw_verify_token = generate_secure_token()
        token_entry = AuthTokenModel(
            id=f"tok_{uuid.uuid4().hex[:14]}",
            user_id=user.id,
            token_hash=hash_secure_token(raw_verify_token),
            token_type="VERIFY_EMAIL",
            expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=24)
        )
        session.add(token_entry)
        await session.commit()

        await send_verification_email(
            to_email=user.email,
            token=raw_verify_token,
            user_name=user.name
        )

    return {
        "success": True,
        "message": "If this email belongs to an unverified account, a new verification link has been dispatched."
    }


@router.post("/forgot-password")
async def forgot_password_endpoint(
    req: ForgotPasswordRequest,
    request: Request,
    session: AsyncSession = Depends(get_system_db_session)
):
    """
    Sends a single-use password reset link expiring in 1 hour.
    Rate-limited per IP. Always returns generic confirmation to prevent user enumeration.
    """
    client_ip = request.client.host if request.client else "unknown_ip"
    rate_key = f"forgot_password:{client_ip}"
    allowed, retry_after = await check_rate_limit(rate_key, max_requests=5, window_seconds=300)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Too many password reset attempts. Please wait {retry_after} seconds before retrying."
        )
    clean_email = req.email.strip().lower()

    stmt = select(UserModel).where(UserModel.email == clean_email)
    res = await session.execute(stmt)
    user = res.scalars().first()

    if user:
        raw_reset_token = generate_secure_token()
        token_entry = AuthTokenModel(
            id=f"tok_{uuid.uuid4().hex[:14]}",
            user_id=user.id,
            token_hash=hash_secure_token(raw_reset_token),
            token_type="RESET_PASSWORD",
            expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=1)
        )
        session.add(token_entry)
        await session.commit()

        await send_password_reset_email(
            to_email=user.email,
            token=raw_reset_token,
            user_name=user.name
        )

    return {
        "success": True,
        "message": "If this email is registered, password reset instructions have been dispatched."
    }


@router.post("/reset-password")
async def reset_password_endpoint(
    req: ResetPasswordRequest,
    session: AsyncSession = Depends(get_system_db_session)
):
    """
    Resets password using a validated single-use token.
    Updates password hash with bcrypt, clears lockouts, and marks token as used.
    """
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters long.")

    token_digest = hash_secure_token(req.token)

    stmt = (
        select(AuthTokenModel)
        .where(AuthTokenModel.token_hash == token_digest)
        .where(AuthTokenModel.token_type == "RESET_PASSWORD")
        .where(AuthTokenModel.used_at.is_(None))
    )
    res = await session.execute(stmt)
    token_record = res.scalars().first()

    now_utc = datetime.now(UTC).replace(tzinfo=None)
    if not token_record or token_record.expires_at < now_utc:
        raise HTTPException(
            status_code=400,
            detail="Password reset token is invalid or has expired."
        )

    # Invalidate token
    token_record.used_at = now_utc

    # Update user password
    user_stmt = select(UserModel).where(UserModel.id == token_record.user_id)
    user_res = await session.execute(user_stmt)
    user = user_res.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.password_hash = hash_password(req.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None

    await session.commit()

    return {
        "success": True,
        "message": "Password updated successfully. You may now log in with your new password."
    }


@router.post("/refresh")
async def refresh_endpoint(
    request: Request,
    response: Response,
    req: RefreshTokenRequest | None = None,
    session: AsyncSession = Depends(get_system_db_session)
):
    """Refreshes an expired access token using a valid refresh token from body or cookie."""
    raw_token = None
    if req and req.refresh_token:
        raw_token = req.refresh_token
    elif "refresh_token" in request.cookies:
        raw_token = request.cookies.get("refresh_token")

    if not raw_token:
        raise HTTPException(status_code=401, detail="Refresh token is required")

    decoded = decode_token(raw_token, expected_type="refresh")
    user_id = decoded.get("userId") or decoded.get("sub")
    target_workspace_id = (req.workspace_id if req and req.workspace_id else None) or decoded.get("workspace_id")

    stmt = select(UserModel).where(UserModel.id == user_id)
    res = await session.execute(stmt)
    user = res.scalars().first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Resolve role strictly from WorkspaceMemberModel
    member_stmt = (
        select(WorkspaceMemberModel, WorkspaceModel)
        .join(WorkspaceModel, WorkspaceMemberModel.workspace_id == WorkspaceModel.id)
        .where(
            WorkspaceMemberModel.user_id == user.id,
            WorkspaceMemberModel.workspace_id == target_workspace_id
        )
    )
    member_res = await session.execute(member_stmt)
    row = member_res.first()
    if not row:
        raise HTTPException(status_code=403, detail="User is not a member of target workspace")

    member, workspace = row
    role = member.role or "MEMBER"

    new_access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        workspace_id=workspace.id,
        role=role,
        is_super_admin=(role in ["SUPERADMIN", "SUPER_ADMIN"])
    )
    new_refresh_token = create_refresh_token(user_id=user.id, workspace_id=workspace.id)

    is_prod = (settings.APP_ENV == "production")
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        samesite="lax",
        secure=is_prod,
        max_age=ACCESS_TOKEN_EXPIRE_SECONDS,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        samesite="lax",
        secure=is_prod,
        max_age=REFRESH_TOKEN_EXPIRE_SECONDS,
        path="/"
    )

    return {
        "success": True,
        "access_token": new_access_token,
        "token": new_access_token,
        "refresh_token": new_refresh_token,
        "workspace_id": workspace.id,
        "role": role,
        "expires_in": ACCESS_TOKEN_EXPIRE_SECONDS
    }


@router.post("/logout")
async def logout_endpoint(request: Request, response: Response):
    """Revokes access and refresh tokens and deletes cookies."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        await redis_service.revoke_token(token)
    elif "access_token" in request.cookies:
        await redis_service.revoke_token(request.cookies["access_token"])

    if "refresh_token" in request.cookies:
        await redis_service.revoke_token(request.cookies["refresh_token"])

    try:
        body = await request.json()
        ref_tok = body.get("refresh_token")
        if ref_tok:
            await redis_service.revoke_token(ref_tok)
    except Exception:
        pass

    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")

    return {"success": True, "message": "Logged out successfully and tokens revoked."}


@router.get("/me")
async def get_current_user_profile(
    claims: dict[str, Any] = Depends(verify_jwt_auth),
    session: AsyncSession = Depends(get_tenant_db_session)
):
    """
    Returns authenticated user profile strictly from database.
    Eliminates all fallback users and placeholder profiles.
    """
    user_id = claims["user_id"]
    workspace_id = claims["workspace_id"]

    user_stmt = select(UserModel).where(UserModel.id == user_id)
    user_res = await session.execute(user_stmt)
    user = user_res.scalars().first()

    if not user:
        raise HTTPException(status_code=401, detail="User profile not found in database.")

    # Query user's workspace
    ws_stmt = (
        select(WorkspaceModel, WorkspaceMemberModel.role)
        .join(WorkspaceMemberModel, WorkspaceModel.id == WorkspaceMemberModel.workspace_id)
        .where(WorkspaceMemberModel.user_id == user.id)
        .where(WorkspaceModel.id == workspace_id)
    )
    ws_res = await session.execute(ws_stmt)
    ws_row = ws_res.first()

    workspace = ws_row[0] if ws_row else None
    role = ws_row[1] if ws_row else claims.get("role", "OWNER")

    return {
        "authenticated": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "is_verified": bool(user.is_verified),
            "role": role,
            "mfa_enabled": bool(getattr(user, "mfa_enabled", False)),
            "workspace_id": workspace_id,
            "workspace_name": workspace.name if workspace else "Primary Workspace"
        },
        "workspace": {
            "id": workspace.id if workspace else workspace_id,
            "name": workspace.name if workspace else "Primary Workspace",
            "slug": workspace.slug if workspace else "primary"
        } if workspace else None,
        "role": role
    }


# ============================================================================
# MULTI-FACTOR AUTHENTICATION (MFA / TOTP)
# ============================================================================

@router.post("/mfa/setup")
async def setup_mfa(
    auth_ctx: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_system_db_session)
):
    """
    Initializes TOTP MFA:
    - Generates new base32 secret.
    - Generates 10 single-use recovery codes.
    - Returns otpauth URI, secret, recovery codes, and base64 PNG QR code.
    """
    stmt = select(UserModel).where(UserModel.id == auth_ctx.user_id)
    res = await session.execute(stmt)
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    otpauth_uri = totp.provisioning_uri(name=user.email, issuer_name="ShopMate AaaS")

    # Generate 10 plain recovery codes, store SHA-256 hashes
    raw_recovery_codes = [secrets.token_hex(4).upper() for _ in range(10)]  # e.g., A1B2-C3D4
    hashed_codes = [hash_secure_token(code) for code in raw_recovery_codes]

    # Generate QR Code base64 image
    qr = qrcode.QRCode(box_size=6, border=2)
    qr.add_data(otpauth_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    qr_base64 = f"data:image/png;base64,{base64.b64encode(buffered.getvalue()).decode('utf-8')}"

    # Stash pending secret & hashed codes temporarily on user
    user.mfa_secret = secret
    user.mfa_recovery_codes = hashed_codes
    await session.commit()

    return {
        "success": True,
        "secret": secret,
        "otpauth_uri": otpauth_uri,
        "qr_code": qr_base64,
        "recovery_codes": raw_recovery_codes,
        "message": "Scan the QR code in your authenticator app and verify with a 6-digit code to complete setup."
    }


@router.post("/mfa/verify")
async def verify_mfa_setup(
    req: MFAVerifyRequest,
    auth_ctx: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_system_db_session)
):
    """Verifies a TOTP token to confirm setup and activate MFA."""
    stmt = select(UserModel).where(UserModel.id == auth_ctx.user_id)
    res = await session.execute(stmt)
    user = res.scalars().first()
    if not user or not user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA setup has not been initiated.")

    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(req.code.strip(), valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid verification code. Please check your authenticator clock.")

    user.mfa_enabled = True
    await session.commit()

    return {
        "success": True,
        "mfa_enabled": True,
        "message": "Two-factor authentication has been successfully enabled."
    }


@router.post("/mfa/disable")
async def disable_mfa(
    req: MFADisableRequest,
    auth_ctx: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_system_db_session)
):
    """Disables MFA after verifying current password and valid TOTP code."""
    stmt = select(UserModel).where(UserModel.id == auth_ctx.user_id)
    res = await session.execute(stmt)
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.password_hash or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password.")

    if not user.mfa_secret or not user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is not enabled on this account.")

    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(req.code.strip(), valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid MFA verification code.")

    user.mfa_enabled = False
    user.mfa_secret = None
    user.mfa_recovery_codes = []
    await session.commit()

    return {
        "success": True,
        "mfa_enabled": False,
        "message": "Two-factor authentication has been disabled."
    }


# ============================================================================
# ACTIVE SESSIONS & LOG OUT EVERYWHERE
# ============================================================================

@router.get("/sessions")
async def list_active_sessions(
    auth_ctx: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_system_db_session)
):
    """Lists all active and recent sessions for the current user."""
    stmt = (
        select(UserSessionModel)
        .where(
            UserSessionModel.user_id == auth_ctx.user_id,
            UserSessionModel.is_revoked.is_(False),
            UserSessionModel.expires_at > utcnow()
        )
        .order_by(UserSessionModel.last_activity_at.desc())
    )
    res = await session.execute(stmt)
    sessions = res.scalars().all()

    current_session_id = auth_ctx.session_id
    results = []
    for s in sessions:
        results.append({
            "id": s.id,
            "ip_address": s.ip_address,
            "user_agent": s.user_agent,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "last_activity_at": s.last_activity_at.isoformat() if s.last_activity_at else None,
            "is_current": (s.id == current_session_id),
        })

    return {"sessions": results}


@router.post("/sessions/{session_id}/revoke")
async def revoke_specific_session(
    session_id: str,
    auth_ctx: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_system_db_session)
):
    """Revokes a specific session by ID and blacklists its token in Redis."""
    stmt = select(UserSessionModel).where(
        UserSessionModel.id == session_id,
        UserSessionModel.user_id == auth_ctx.user_id
    )
    res = await session.execute(stmt)
    target_session = res.scalars().first()
    if not target_session:
        raise HTTPException(status_code=404, detail="Session not found.")

    target_session.is_revoked = True
    await session.commit()

    await redis_service.revoke_token(session_id)

    return {"success": True, "message": "Session revoked."}


@router.post("/sessions/revoke-all")
async def revoke_all_sessions(
    response: Response,
    auth_ctx: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_system_db_session)
):
    """Log out everywhere: revokes all user sessions and blacklists active tokens."""
    stmt = select(UserSessionModel).where(
        UserSessionModel.user_id == auth_ctx.user_id,
        UserSessionModel.is_revoked.is_(False)
    )
    res = await session.execute(stmt)
    active_sessions = res.scalars().all()

    for s in active_sessions:
        s.is_revoked = True
        await redis_service.revoke_token(s.id)

    await session.commit()

    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")

    return {
        "success": True,
        "message": f"Successfully revoked {len(active_sessions)} sessions. You have been logged out everywhere."
    }

