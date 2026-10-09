import datetime
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    create_access_token,
    create_refresh_token,
    generate_secure_token,
    get_auth_context,
    hash_password,
    hash_secure_token,
    require_role,
    set_auth_cookies,
)
from app.billing.metering import get_full_workspace_usage_summary
from app.billing.quota import QuotaExceededException
from app.compliance import record_audit_event
from app.db.database import get_system_db_session, get_tenant_db_session
from app.db.models import (
    UserModel,
    WorkspaceInvitationModel,
    WorkspaceMemberModel,
    WorkspaceModel,
    utcnow,
)
from app.email_service import send_team_invite_email

router = APIRouter(prefix="/api/v1", tags=["Team, Members & Workspaces"])


class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: str = Field(default="VIEWER", pattern="^(ADMIN|EDITOR|VIEWER)$")


class AcceptInviteRequest(BaseModel):
    token: str
    name: str | None = None
    password: str | None = None


class UpdateMemberRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(OWNER|ADMIN|EDITOR|VIEWER)$")


class TransferOwnershipRequest(BaseModel):
    target_user_id: str


class SwitchWorkspaceRequest(BaseModel):
    workspace_id: str


# ============================================================================
# 1. TEAM MEMBERSHIP MANAGEMENT
# ============================================================================

@router.get("/team/members")
async def list_workspace_members(
    auth_ctx: dict[str, Any] = Depends(get_auth_context),
    session: AsyncSession = Depends(get_tenant_db_session),
) -> dict[str, Any]:
    """Lists all members of the current workspace."""
    ws_id = auth_ctx["workspace_id"]
    stmt = (
        select(WorkspaceMemberModel, UserModel)
        .join(UserModel, WorkspaceMemberModel.user_id == UserModel.id)
        .where(WorkspaceMemberModel.workspace_id == ws_id)
        .order_by(WorkspaceMemberModel.created_at.asc())
    )
    res = await session.execute(stmt)
    rows = res.all()

    members = [
        {
            "id": mem.id,
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "role": mem.role,
            "joined_at": mem.created_at.isoformat() if mem.created_at else None,
            "is_current_user": user.id == auth_ctx["user_id"],
        }
        for mem, user in rows
    ]
    return {"members": members, "count": len(members)}


@router.post("/team/invites")
async def invite_team_member(
    req: InviteMemberRequest,
    request: Request,
    auth_ctx: dict[str, Any] = Depends(require_role(["OWNER", "ADMIN"])),
    session: AsyncSession = Depends(get_tenant_db_session),
) -> dict[str, Any]:
    """Invites a new teammate by email with an assigned role. Enforces plan seat limits."""
    ws_id = auth_ctx["workspace_id"]
    clean_email = req.email.strip().lower()

    # 1. Enforce plan seat quota
    summary = await get_full_workspace_usage_summary(session, ws_id)
    seats_meter = summary["meters"]["seats"]
    if seats_meter["used"] >= seats_meter["limit"]:
        raise QuotaExceededException(
            metric="seats",
            plan_name=summary["plan_name"],
            used=seats_meter["used"],
            limit=seats_meter["limit"],
            upgrade_url=summary["upgrade_url"],
        )

    # 2. Check if already a member
    existing_mem = await session.execute(
        select(WorkspaceMemberModel)
        .join(UserModel, WorkspaceMemberModel.user_id == UserModel.id)
        .where(WorkspaceMemberModel.workspace_id == ws_id, UserModel.email == clean_email)
    )
    if existing_mem.scalars().first():
        raise HTTPException(status_code=409, detail="User is already a member of this workspace.")

    # 3. Check if active pending invite already exists
    pending_inv = await session.execute(
        select(WorkspaceInvitationModel).where(
            WorkspaceInvitationModel.workspace_id == ws_id,
            WorkspaceInvitationModel.email == clean_email,
            WorkspaceInvitationModel.status == "PENDING",
            WorkspaceInvitationModel.expires_at > utcnow(),
        )
    )
    if pending_inv.scalars().first():
        raise HTTPException(status_code=409, detail="A pending invitation has already been sent to this email.")

    # 4. Generate signed invite token (7-day validity)
    raw_token = generate_secure_token()
    token_hash = hash_secure_token(raw_token)
    expires_at = utcnow() + datetime.timedelta(days=7)

    inv = WorkspaceInvitationModel(
        id=f"inv_{uuid.uuid4().hex[:12]}",
        workspace_id=ws_id,
        email=clean_email,
        role=req.role,
        token_hash=token_hash,
        invited_by_user_id=auth_ctx["user_id"],
        status="PENDING",
        expires_at=expires_at,
        created_at=utcnow(),
    )
    session.add(inv)
    await session.commit()

    # 5. Send transactional email
    ws_res = await session.execute(select(WorkspaceModel).where(WorkspaceModel.id == ws_id))
    ws = ws_res.scalars().first()
    ws_name = ws.name if ws else "Workspace"

    await send_team_invite_email(
        to_email=clean_email,
        workspace_name=ws_name,
        inviter_name=auth_ctx.get("name", "An admin"),
        role=req.role,
        token=raw_token,
    )

    # 6. Audit log
    await record_audit_event(
        workspace_id=ws_id,
        action="TEAM_MEMBER_INVITED",
        actor_id=auth_ctx["user_id"],
        resource_type="invitation",
        resource_id=inv.id,
        details={"invited_email": clean_email, "role": req.role},
    )

    return {
        "success": True,
        "message": f"Invitation sent to {clean_email}.",
        "invite_id": inv.id,
        "role": req.role,
        "expires_at": expires_at.isoformat(),
    }


@router.get("/team/invites")
async def list_pending_invites(
    auth_ctx: dict[str, Any] = Depends(require_role(["OWNER", "ADMIN"])),
    session: AsyncSession = Depends(get_tenant_db_session),
) -> dict[str, Any]:
    """Lists pending invitations for the workspace."""
    ws_id = auth_ctx["workspace_id"]
    res = await session.execute(
        select(WorkspaceInvitationModel)
        .where(
            WorkspaceInvitationModel.workspace_id == ws_id,
            WorkspaceInvitationModel.status == "PENDING",
        )
        .order_by(WorkspaceInvitationModel.created_at.desc())
    )
    invites = res.scalars().all()
    return {
        "invites": [
            {
                "id": inv.id,
                "email": inv.email,
                "role": inv.role,
                "created_at": inv.created_at.isoformat(),
                "expires_at": inv.expires_at.isoformat(),
                "is_expired": inv.expires_at < utcnow(),
            }
            for inv in invites
        ]
    }


@router.delete("/team/invites/{invite_id}")
async def revoke_pending_invite(
    invite_id: str,
    auth_ctx: dict[str, Any] = Depends(require_role(["OWNER", "ADMIN"])),
    session: AsyncSession = Depends(get_tenant_db_session),
) -> dict[str, Any]:
    """Revokes an outstanding invitation."""
    ws_id = auth_ctx["workspace_id"]
    res = await session.execute(
        select(WorkspaceInvitationModel).where(
            WorkspaceInvitationModel.id == invite_id,
            WorkspaceInvitationModel.workspace_id == ws_id,
        )
    )
    inv = res.scalars().first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found.")

    inv.status = "REVOKED"
    await session.commit()

    await record_audit_event(
        workspace_id=ws_id,
        action="TEAM_INVITE_REVOKED",
        actor_id=auth_ctx["user_id"],
        resource_type="invitation",
        resource_id=invite_id,
        details={"email": inv.email},
    )

    return {"success": True, "message": "Invitation revoked."}


@router.post("/team/invites/accept")
async def accept_team_invitation(
    req: AcceptInviteRequest,
    response: Response,
    session: AsyncSession = Depends(get_system_db_session),
) -> dict[str, Any]:
    """Accepts a signed team invite token and enrolls the user into the target workspace."""
    token_hash = hash_secure_token(req.token.strip())

    res = await session.execute(
        select(WorkspaceInvitationModel).where(
            WorkspaceInvitationModel.token_hash == token_hash,
            WorkspaceInvitationModel.status == "PENDING",
        )
    )
    inv = res.scalars().first()
    if not inv:
        raise HTTPException(status_code=400, detail="Invalid or already used invitation token.")

    if inv.expires_at < utcnow():
        inv.status = "EXPIRED"
        await session.commit()
        raise HTTPException(status_code=400, detail="This invitation has expired. Request a new invite.")

    # Find or create user
    user_res = await session.execute(select(UserModel).where(UserModel.email == inv.email))
    user = user_res.scalars().first()

    if not user:
        if not req.password or len(req.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters to create your account.")
        user = UserModel(
            id=f"usr_{uuid.uuid4().hex[:14]}",
            email=inv.email,
            name=req.name.strip() if req.name else inv.email.split("@")[0],
            password_hash=hash_password(req.password),
            is_verified=True,  # Accepting a direct signed invite email confirms email ownership
            role=inv.role,
        )
        session.add(user)
        await session.flush()

    # Check if already a member
    mem_res = await session.execute(
        select(WorkspaceMemberModel).where(
            WorkspaceMemberModel.workspace_id == inv.workspace_id,
            WorkspaceMemberModel.user_id == user.id,
        )
    )
    member = mem_res.scalars().first()
    if not member:
        member = WorkspaceMemberModel(
            id=f"wsm_{uuid.uuid4().hex[:14]}",
            workspace_id=inv.workspace_id,
            user_id=user.id,
            role=inv.role,
            created_at=utcnow(),
        )
        session.add(member)

    inv.status = "ACCEPTED"
    await session.commit()

    # Audit log
    await record_audit_event(
        workspace_id=inv.workspace_id,
        action="TEAM_INVITE_ACCEPTED",
        actor_id=user.id,
        resource_type="invitation",
        resource_id=inv.id,
        details={"user_id": user.id, "email": user.email, "role": inv.role},
    )

    # Issue access and refresh tokens scoped to the newly joined workspace
    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        workspace_id=inv.workspace_id,
        role=inv.role,
    )
    refresh_token = create_refresh_token(
        user_id=user.id,
        workspace_id=inv.workspace_id,
    )
    set_auth_cookies(response, access_token, refresh_token)

    return {
        "success": True,
        "message": "Successfully joined workspace.",
        "workspace_id": inv.workspace_id,
        "role": inv.role,
        "access_token": access_token,
    }


@router.patch("/team/members/{member_id}")
async def change_member_role(
    member_id: str,
    req: UpdateMemberRoleRequest,
    auth_ctx: dict[str, Any] = Depends(require_role(["OWNER", "ADMIN"])),
    session: AsyncSession = Depends(get_tenant_db_session),
) -> dict[str, Any]:
    """Updates a team member's role. A workspace must retain at least one OWNER."""
    ws_id = auth_ctx["workspace_id"]
    res = await session.execute(
        select(WorkspaceMemberModel).where(
            WorkspaceMemberModel.id == member_id,
            WorkspaceMemberModel.workspace_id == ws_id,
        )
    )
    member = res.scalars().first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    # Guard: Cannot demote the last OWNER
    if member.role == "OWNER" and req.role != "OWNER":
        owner_count_res = await session.execute(
            select(func.count(WorkspaceMemberModel.id)).where(
                WorkspaceMemberModel.workspace_id == ws_id,
                WorkspaceMemberModel.role == "OWNER",
            )
        )
        if (owner_count_res.scalar() or 0) <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the last OWNER. Transfer ownership first.")

    old_role = member.role
    member.role = req.role
    await session.commit()

    await record_audit_event(
        workspace_id=ws_id,
        action="TEAM_MEMBER_ROLE_CHANGED",
        actor_id=auth_ctx["user_id"],
        resource_type="membership",
        resource_id=member_id,
        details={"user_id": member.user_id, "old_role": old_role, "new_role": req.role},
    )

    return {"success": True, "member_id": member_id, "new_role": req.role}


@router.delete("/team/members/{member_id}")
async def remove_team_member(
    member_id: str,
    auth_ctx: dict[str, Any] = Depends(require_role(["OWNER", "ADMIN"])),
    session: AsyncSession = Depends(get_tenant_db_session),
) -> dict[str, Any]:
    """Removes a team member from the workspace. Cannot remove the only OWNER."""
    ws_id = auth_ctx["workspace_id"]
    res = await session.execute(
        select(WorkspaceMemberModel).where(
            WorkspaceMemberModel.id == member_id,
            WorkspaceMemberModel.workspace_id == ws_id,
        )
    )
    member = res.scalars().first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    if member.role == "OWNER":
        owner_count_res = await session.execute(
            select(func.count(WorkspaceMemberModel.id)).where(
                WorkspaceMemberModel.workspace_id == ws_id,
                WorkspaceMemberModel.role == "OWNER",
            )
        )
        if (owner_count_res.scalar() or 0) <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the only OWNER of the workspace.")

    target_user_id = member.user_id
    await session.delete(member)
    await session.commit()

    await record_audit_event(
        workspace_id=ws_id,
        action="TEAM_MEMBER_REMOVED",
        actor_id=auth_ctx["user_id"],
        resource_type="membership",
        resource_id=member_id,
        details={"removed_user_id": target_user_id},
    )

    return {"success": True, "message": "Member removed from workspace."}


@router.post("/team/transfer-ownership")
async def transfer_workspace_ownership(
    req: TransferOwnershipRequest,
    auth_ctx: dict[str, Any] = Depends(require_role(["OWNER"])),
    session: AsyncSession = Depends(get_tenant_db_session),
) -> dict[str, Any]:
    """Transfers primary ownership to another teammate. Demotes caller to ADMIN."""
    ws_id = auth_ctx["workspace_id"]
    caller_id = auth_ctx["user_id"]

    if req.target_user_id == caller_id:
        raise HTTPException(status_code=400, detail="You are already the owner.")

    # Target must be a member
    target_mem_res = await session.execute(
        select(WorkspaceMemberModel).where(
            WorkspaceMemberModel.workspace_id == ws_id,
            WorkspaceMemberModel.user_id == req.target_user_id,
        )
    )
    target_mem = target_mem_res.scalars().first()
    if not target_mem:
        raise HTTPException(status_code=404, detail="Target user is not a member of this workspace.")

    # Caller member record
    caller_mem_res = await session.execute(
        select(WorkspaceMemberModel).where(
            WorkspaceMemberModel.workspace_id == ws_id,
            WorkspaceMemberModel.user_id == caller_id,
        )
    )
    caller_mem = caller_mem_res.scalars().first()
    if not caller_mem:
        raise HTTPException(status_code=404, detail="Caller membership record not found.")

    target_mem.role = "OWNER"
    caller_mem.role = "ADMIN"
    await session.commit()

    await record_audit_event(
        workspace_id=ws_id,
        action="WORKSPACE_OWNERSHIP_TRANSFERRED",
        actor_id=caller_id,
        resource_type="workspace",
        resource_id=ws_id,
        details={"new_owner_id": req.target_user_id, "previous_owner_id": caller_id},
    )

    return {
        "success": True,
        "message": f"Ownership transferred to user {req.target_user_id}.",
        "new_owner_id": req.target_user_id,
    }


# ============================================================================
# 2. WORKSPACE SWITCHER & MULTI-WORKSPACE SUPPORT
# ============================================================================

@router.get("/workspaces/mine")
async def list_my_workspaces(
    auth_ctx: dict[str, Any] = Depends(get_auth_context),
    session: AsyncSession = Depends(get_system_db_session),
) -> dict[str, Any]:
    """Returns all workspaces the current user has access to."""
    user_id = auth_ctx["user_id"]
    stmt = (
        select(WorkspaceMemberModel, WorkspaceModel)
        .join(WorkspaceModel, WorkspaceMemberModel.workspace_id == WorkspaceModel.id)
        .where(WorkspaceMemberModel.user_id == user_id)
        .order_by(WorkspaceModel.name.asc())
    )
    res = await session.execute(stmt)
    rows = res.all()

    workspaces = [
        {
            "id": ws.id,
            "name": ws.name,
            "slug": ws.slug,
            "role": mem.role,
            "is_current": ws.id == auth_ctx["workspace_id"],
        }
        for mem, ws in rows
    ]
    return {"workspaces": workspaces}


@router.post("/workspaces/switch")
async def switch_workspace(
    req: SwitchWorkspaceRequest,
    response: Response,
    auth_ctx: dict[str, Any] = Depends(get_auth_context),
    session: AsyncSession = Depends(get_system_db_session),
) -> dict[str, Any]:
    """Switches active workspace context and returns an updated token."""
    user_id = auth_ctx["user_id"]
    target_ws = req.workspace_id

    # Verify membership in target workspace
    res = await session.execute(
        select(WorkspaceMemberModel).where(
            WorkspaceMemberModel.user_id == user_id,
            WorkspaceMemberModel.workspace_id == target_ws,
        )
    )
    member = res.scalars().first()
    if not member:
        raise HTTPException(status_code=403, detail="You do not have access to this workspace.")

    # Fetch workspace metadata
    ws_res = await session.execute(select(WorkspaceModel).where(WorkspaceModel.id == target_ws))
    workspace = ws_res.scalars().first()

    # Issue fresh tokens scoped exclusively to target workspace
    new_access_token = create_access_token(
        user_id=user_id,
        email=auth_ctx["email"],
        workspace_id=target_ws,
        role=member.role,
    )
    new_refresh_token = create_refresh_token(
        user_id=user_id,
        workspace_id=target_ws,
    )
    set_auth_cookies(response, new_access_token, new_refresh_token)

    await record_audit_event(
        workspace_id=target_ws,
        action="WORKSPACE_SWITCHED",
        actor_id=user_id,
        resource_type="workspace",
        resource_id=target_ws,
        details={"previous_workspace_id": auth_ctx["workspace_id"]},
    )

    return {
        "success": True,
        "workspace_id": target_ws,
        "workspace_name": workspace.name if workspace else "Workspace",
        "role": member.role,
        "access_token": new_access_token,
    }
