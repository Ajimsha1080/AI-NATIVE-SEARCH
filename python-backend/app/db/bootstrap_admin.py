"""Admin Bootstrap CLI

A one-time setup utility that creates an initial administrator account and primary workspace
from environment variables without hardcoded credentials.

Usage:
    export ADMIN_EMAIL="admin@yourcompany.com"
    export ADMIN_PASSWORD="your-strong-password"
    python -m app.db.bootstrap_admin
"""

import asyncio
import os
import sys
import uuid

from sqlalchemy import select

from app.auth import hash_password
from app.db.database import async_session_factory, init_db
from app.db.models import UserModel, WorkspaceMemberModel, WorkspaceModel


async def bootstrap_admin() -> None:
    admin_email = os.getenv("ADMIN_EMAIL") or os.getenv("BOOTSTRAP_ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD") or os.getenv("BOOTSTRAP_ADMIN_PASSWORD")
    admin_name = os.getenv("ADMIN_NAME", "System Administrator")
    workspace_name = os.getenv("WORKSPACE_NAME", "Primary Workspace")

    if not admin_email or not admin_password:
        print(
            "ERROR: Both ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set.",
            file=sys.stderr
        )
        sys.exit(1)

    if len(admin_password) < 8:
        print(
            "ERROR: ADMIN_PASSWORD must be at least 8 characters.",
            file=sys.stderr
        )
        sys.exit(1)

    await init_db()

    async with async_session_factory() as session:
        stmt = select(UserModel).where(UserModel.email == admin_email.strip().lower())
        res = await session.execute(stmt)
        existing_user = res.scalars().first()

        if existing_user:
            print(f"INFO: Administrator with email {admin_email} already exists. Skipping bootstrap.")
            return

        # 1. Create primary workspace
        ws_id = f"ws_{uuid.uuid4().hex[:12]}"
        workspace = WorkspaceModel(
            id=ws_id,
            name=workspace_name.strip(),
            slug=workspace_name.strip().lower().replace(" ", "-"),
            tier="ENTERPRISE"
        )
        session.add(workspace)

        # 2. Create admin user
        user_id = f"usr_{uuid.uuid4().hex[:12]}"
        user = UserModel(
            id=user_id,
            email=admin_email.strip().lower(),
            name=admin_name.strip(),
            role="ADMIN",
            password_hash=hash_password(admin_password),
            is_verified=True,
            failed_login_attempts=0
        )
        session.add(user)

        # 3. Create owner membership
        membership = WorkspaceMemberModel(
            id=f"wsm_{uuid.uuid4().hex[:12]}",
            workspace_id=workspace.id,
            user_id=user.id,
            role="OWNER"
        )
        session.add(membership)

        await session.commit()
        print(f"SUCCESS: Root administrator '{admin_email}' and workspace '{workspace.name}' ({workspace.id}) provisioned successfully.")


if __name__ == "__main__":
    asyncio.run(bootstrap_admin())
