import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.auth import create_access_token
from app.db.database import async_session_factory
from app.db.models import (
    SubscriptionModel,
    UserModel,
    WorkspaceInvitationModel,
    WorkspaceMemberModel,
    WorkspaceModel,
)
from app.main import app

client = TestClient(app)


def auth_header(workspace_id: str, user_id: str, role: str = "OWNER") -> dict[str, str]:
    token = create_access_token(
        user_id=user_id,
        email=f"{user_id}@{workspace_id}.org",
        workspace_id=workspace_id,
        role=role,
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_invite_team_member_and_list():
    """Verify owner/admin can invite a teammate and list members."""
    ws_id = f"ws_team_{uuid.uuid4().hex[:8]}"
    owner_id = f"usr_owner_{uuid.uuid4().hex[:8]}"
    invite_email = f"collab_{uuid.uuid4().hex[:6]}@partner.org"

    # Setup workspace and owner
    async with async_session_factory() as session:
        ws = WorkspaceModel(id=ws_id, name="Team Test Store", slug=f"store-{uuid.uuid4().hex[:6]}")
        user = UserModel(id=owner_id, email=f"{owner_id}@test.org", name="Owner Alice", role="ADMIN")
        mem = WorkspaceMemberModel(id=f"wsm_{uuid.uuid4().hex[:8]}", workspace_id=ws_id, user_id=owner_id, role="OWNER")
        # Pro plan has 10 seats
        sub = SubscriptionModel(id=f"sub_{uuid.uuid4().hex[:8]}", workspace_id=ws_id, plan_code="pro", status="ACTIVE")
        session.add_all([ws, user, mem, sub])
        await session.commit()

    # 1. Send invite
    res = client.post(
        "/api/v1/team/invites",
        headers=auth_header(ws_id, owner_id, "OWNER"),
        json={"email": invite_email, "role": "EDITOR"}
    )
    assert res.status_code == 200
    assert res.json()["success"] is True

    # 2. List pending invites
    inv_res = client.get("/api/v1/team/invites", headers=auth_header(ws_id, owner_id, "OWNER"))
    assert inv_res.status_code == 200
    invites = inv_res.json()["invites"]
    assert any(i["email"] == invite_email for i in invites)

    # 3. List members
    mem_res = client.get("/api/v1/team/members", headers=auth_header(ws_id, owner_id, "OWNER"))
    assert mem_res.status_code == 200
    assert len(mem_res.json()["members"]) == 1


@pytest.mark.asyncio
async def test_invite_enforces_seat_quota():
    """Verify inviting teammates beyond plan seat limits returns HTTP 402."""
    ws_id = f"ws_seat_cap_{uuid.uuid4().hex[:8]}"
    owner_id = f"usr_seat_{uuid.uuid4().hex[:8]}"

    # Setup workspace on free plan (1 seat limit)
    async with async_session_factory() as session:
        ws = WorkspaceModel(id=ws_id, name="Free Store", slug=f"free-{uuid.uuid4().hex[:6]}")
        user = UserModel(id=owner_id, email=f"{owner_id}@test.org", name="Solo Owner", role="ADMIN")
        mem = WorkspaceMemberModel(id=f"wsm_{uuid.uuid4().hex[:8]}", workspace_id=ws_id, user_id=owner_id, role="OWNER")
        sub = SubscriptionModel(id=f"sub_{uuid.uuid4().hex[:8]}", workspace_id=ws_id, plan_code="free", status="ACTIVE")
        session.add_all([ws, user, mem, sub])
        await session.commit()

    # Attempt to invite 2nd person on 1-seat plan
    res = client.post(
        "/api/v1/team/invites",
        headers=auth_header(ws_id, owner_id, "OWNER"),
        json={"email": "second_user@test.org", "role": "VIEWER"}
    )
    assert res.status_code == 402
    assert res.json()["detail"]["error"] == "PLAN_QUOTA_EXCEEDED"
    assert res.json()["detail"]["metric"] == "seats"


@pytest.mark.asyncio
async def test_accept_invitation_flow():
    """Verify accepting a team invitation with a token enrolls user in workspace."""
    ws_id = f"ws_accept_{uuid.uuid4().hex[:8]}"
    owner_id = f"usr_o_{uuid.uuid4().hex[:8]}"
    teammate_email = f"new_hire_{uuid.uuid4().hex[:6]}@company.org"

    async with async_session_factory() as session:
        ws = WorkspaceModel(id=ws_id, name="Growth Store", slug=f"growth-{uuid.uuid4().hex[:6]}")
        owner = UserModel(id=owner_id, email=f"{owner_id}@company.org", name="Owner Bob")
        mem = WorkspaceMemberModel(id=f"wsm_{uuid.uuid4().hex[:8]}", workspace_id=ws_id, user_id=owner_id, role="OWNER")
        sub = SubscriptionModel(id=f"sub_{uuid.uuid4().hex[:8]}", workspace_id=ws_id, plan_code="pro", status="ACTIVE")
        session.add_all([ws, owner, mem, sub])
        await session.commit()

    # Send invite
    invite_res = client.post(
        "/api/v1/team/invites",
        headers=auth_header(ws_id, owner_id, "OWNER"),
        json={"email": teammate_email, "role": "EDITOR"}
    )
    assert invite_res.status_code == 200

    # Retrieve raw token from DB for test verification
    async with async_session_factory() as session:
        inv_model = (
            await session.execute(
                select(WorkspaceInvitationModel).where(
                    WorkspaceInvitationModel.workspace_id == ws_id,
                    WorkspaceInvitationModel.email == teammate_email,
                )
            )
        ).scalars().first()
        assert inv_model is not None
        assert inv_model.status == "PENDING"

    # Accept invite using a simulated token
    from app.auth import generate_secure_token, hash_secure_token

    test_token = generate_secure_token()
    async with async_session_factory() as session:
        inv_to_update = (
            await session.execute(
                select(WorkspaceInvitationModel).where(WorkspaceInvitationModel.id == inv_model.id)
            )
        ).scalars().first()
        inv_to_update.token_hash = hash_secure_token(test_token)
        await session.commit()

    accept_res = client.post(
        "/api/v1/team/invites/accept",
        json={"token": test_token, "name": "Charlie Teammate", "password": "SecurePassword123!"}
    )
    assert accept_res.status_code == 200
    data = accept_res.json()
    assert data["success"] is True
    assert data["workspace_id"] == ws_id
    assert data["role"] == "EDITOR"
    assert "access_token" in data

    # Verify membership exists
    async with async_session_factory() as session:
        mems = (
            await session.execute(
                select(WorkspaceMemberModel).where(WorkspaceMemberModel.workspace_id == ws_id)
            )
        ).scalars().all()
        assert len(mems) == 2


@pytest.mark.asyncio
async def test_last_owner_protection():
    """Verify that a workspace cannot demote or remove its only OWNER."""
    ws_id = f"ws_guard_{uuid.uuid4().hex[:8]}"
    owner_id = f"usr_sole_{uuid.uuid4().hex[:8]}"
    mem_id = f"wsm_sole_{uuid.uuid4().hex[:8]}"

    async with async_session_factory() as session:
        ws = WorkspaceModel(id=ws_id, name="Guard Store", slug=f"guard-{uuid.uuid4().hex[:6]}")
        owner = UserModel(id=owner_id, email="owner@guard.org", name="Sole Owner")
        mem = WorkspaceMemberModel(id=mem_id, workspace_id=ws_id, user_id=owner_id, role="OWNER")
        sub = SubscriptionModel(id=f"sub_{uuid.uuid4().hex[:8]}", workspace_id=ws_id, plan_code="starter", status="ACTIVE")
        session.add_all([ws, owner, mem, sub])
        await session.commit()

    # 1. Attempt to demote sole owner -> 400 Bad Request
    demote_res = client.patch(
        f"/api/v1/team/members/{mem_id}",
        headers=auth_header(ws_id, owner_id, "OWNER"),
        json={"role": "ADMIN"}
    )
    assert demote_res.status_code == 400
    assert "last owner" in demote_res.json()["detail"].lower()

    # 2. Attempt to remove sole owner -> 400 Bad Request
    remove_res = client.delete(
        f"/api/v1/team/members/{mem_id}",
        headers=auth_header(ws_id, owner_id, "OWNER")
    )
    assert remove_res.status_code == 400
    assert "cannot remove the only owner" in remove_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_transfer_ownership():
    """Verify transferring primary ownership promotes teammate and demotes previous owner."""
    ws_id = f"ws_trans_{uuid.uuid4().hex[:8]}"
    owner_id = f"usr_prev_{uuid.uuid4().hex[:8]}"
    teammate_id = f"usr_next_{uuid.uuid4().hex[:8]}"

    async with async_session_factory() as session:
        ws = WorkspaceModel(id=ws_id, name="Transfer Store", slug=f"trans-{uuid.uuid4().hex[:6]}")
        u1 = UserModel(id=owner_id, email="u1@test.org", name="Prev Owner")
        u2 = UserModel(id=teammate_id, email="u2@test.org", name="Next Owner")
        m1 = WorkspaceMemberModel(id=f"wsm_1_{uuid.uuid4().hex[:6]}", workspace_id=ws_id, user_id=owner_id, role="OWNER")
        m2 = WorkspaceMemberModel(id=f"wsm_2_{uuid.uuid4().hex[:6]}", workspace_id=ws_id, user_id=teammate_id, role="ADMIN")
        sub = SubscriptionModel(id=f"sub_{uuid.uuid4().hex[:8]}", workspace_id=ws_id, plan_code="pro", status="ACTIVE")
        session.add_all([ws, u1, u2, m1, m2, sub])
        await session.commit()

    trans_res = client.post(
        "/api/v1/team/transfer-ownership",
        headers=auth_header(ws_id, owner_id, "OWNER"),
        json={"target_user_id": teammate_id}
    )
    assert trans_res.status_code == 200
    assert trans_res.json()["success"] is True

    # Verify roles flipped
    async with async_session_factory() as session:
        m1_updated = (await session.execute(select(WorkspaceMemberModel).where(WorkspaceMemberModel.user_id == owner_id))).scalars().first()
        m2_updated = (await session.execute(select(WorkspaceMemberModel).where(WorkspaceMemberModel.user_id == teammate_id))).scalars().first()
        assert m1_updated.role == "ADMIN"
        assert m2_updated.role == "OWNER"


@pytest.mark.asyncio
async def test_multi_workspace_switcher():
    """Verify user can belong to multiple workspaces and switch between them."""
    user_id = f"usr_multi_{uuid.uuid4().hex[:8]}"
    ws1_id = f"ws_store_one_{uuid.uuid4().hex[:6]}"
    ws2_id = f"ws_store_two_{uuid.uuid4().hex[:6]}"

    async with async_session_factory() as session:
        user = UserModel(id=user_id, email="multi@brand.com", name="Multi Store Merchant")
        ws1 = WorkspaceModel(id=ws1_id, name="Store One", slug=f"s1-{uuid.uuid4().hex[:6]}")
        ws2 = WorkspaceModel(id=ws2_id, name="Store Two", slug=f"s2-{uuid.uuid4().hex[:6]}")
        m1 = WorkspaceMemberModel(id=f"m1_{uuid.uuid4().hex[:6]}", workspace_id=ws1_id, user_id=user_id, role="OWNER")
        m2 = WorkspaceMemberModel(id=f"m2_{uuid.uuid4().hex[:6]}", workspace_id=ws2_id, user_id=user_id, role="EDITOR")
        sub1 = SubscriptionModel(id=f"sub1_{uuid.uuid4().hex[:6]}", workspace_id=ws1_id, plan_code="starter", status="ACTIVE")
        sub2 = SubscriptionModel(id=f"sub2_{uuid.uuid4().hex[:6]}", workspace_id=ws2_id, plan_code="pro", status="ACTIVE")
        session.add_all([user, ws1, ws2, m1, m2, sub1, sub2])
        await session.commit()

    # 1. List user's workspaces
    list_res = client.get("/api/v1/workspaces/mine", headers=auth_header(ws1_id, user_id, "OWNER"))
    assert list_res.status_code == 200
    ws_list = list_res.json()["workspaces"]
    assert len(ws_list) == 2
    ids = [w["id"] for w in ws_list]
    assert ws1_id in ids
    assert ws2_id in ids

    # 2. Switch to Workspace Two
    switch_res = client.post(
        "/api/v1/workspaces/switch",
        headers=auth_header(ws1_id, user_id, "OWNER"),
        json={"workspace_id": ws2_id}
    )
    assert switch_res.status_code == 200
    switch_data = switch_res.json()
    assert switch_data["workspace_id"] == ws2_id
    assert switch_data["role"] == "EDITOR"  # Role in ws2 is EDITOR
    assert "access_token" in switch_data

    # 3. Switching to unauthorized workspace returns 403
    unauth_res = client.post(
        "/api/v1/workspaces/switch",
        headers=auth_header(ws1_id, user_id, "OWNER"),
        json={"workspace_id": "ws_unauthorized_999"}
    )
    assert unauth_res.status_code == 403
