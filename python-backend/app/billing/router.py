from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_auth_context, require_role
from app.db.database import get_system_db_session, get_tenant_db_session

from . import service

router = APIRouter(prefix="/api/v1/billing", tags=["Billing & Subscriptions"])


class CheckoutRequest(BaseModel):
    plan_code: str = Field(..., description="Plan code to subscribe to (e.g., starter, pro, enterprise)")


class ChangePlanRequest(BaseModel):
    plan_code: str = Field(..., description="Target plan code")


@router.get("/plans")
async def list_available_plans(
    session: AsyncSession = Depends(get_system_db_session)
) -> dict[str, Any]:
    """Returns all active plans, prices, and quota limits."""
    plans = await service.list_plans(session)
    return {"plans": plans}


@router.get("/subscription")
async def get_current_subscription(
    auth_ctx: dict[str, Any] = Depends(get_auth_context),
    session: AsyncSession = Depends(get_tenant_db_session)
) -> dict[str, Any]:
    """Returns current workspace subscription details, active plan, and limits."""
    ws_id = auth_ctx["workspace_id"]
    return await service.get_subscription_details(session, ws_id)


@router.get("/usage")
async def get_current_usage_meters(
    auth_ctx: dict[str, Any] = Depends(get_auth_context),
    session: AsyncSession = Depends(get_tenant_db_session)
) -> dict[str, Any]:
    """Returns real-time usage meters against monthly plan quotas."""
    from .metering import get_full_workspace_usage_summary
    ws_id = auth_ctx["workspace_id"]
    return await get_full_workspace_usage_summary(session, ws_id)


@router.post("/checkout")
async def start_subscription_checkout(
    req: CheckoutRequest,
    auth_ctx: dict[str, Any] = Depends(require_role(["OWNER", "ADMIN"])),
    session: AsyncSession = Depends(get_tenant_db_session)
) -> dict[str, Any]:
    """Initiates recurring subscription checkout session with payment provider."""
    ws_id = auth_ctx["workspace_id"]
    user_email = auth_ctx.get("email", "merchant@shopmate.ai")
    user_name = auth_ctx.get("name", "Merchant")

    return await service.create_checkout_session(
        session=session,
        workspace_id=ws_id,
        plan_code=req.plan_code,
        customer_email=user_email,
        customer_name=user_name
    )


@router.post("/change-plan")
async def change_subscription_plan(
    req: ChangePlanRequest,
    auth_ctx: dict[str, Any] = Depends(require_role(["OWNER", "ADMIN"])),
    session: AsyncSession = Depends(get_tenant_db_session)
) -> dict[str, Any]:
    """Change current subscription plan."""
    ws_id = auth_ctx["workspace_id"]
    user_email = auth_ctx.get("email", "merchant@shopmate.ai")
    user_name = auth_ctx.get("name", "Merchant")

    return await service.create_checkout_session(
        session=session,
        workspace_id=ws_id,
        plan_code=req.plan_code,
        customer_email=user_email,
        customer_name=user_name
    )


@router.post("/cancel")
async def cancel_subscription(
    auth_ctx: dict[str, Any] = Depends(require_role(["OWNER", "ADMIN"])),
    session: AsyncSession = Depends(get_tenant_db_session)
) -> dict[str, Any]:
    """Cancels active subscription at the end of the billing period."""
    ws_id = auth_ctx["workspace_id"]
    return await service.cancel_subscription(session, ws_id)


@router.get("/invoices")
async def list_subscription_invoices(
    auth_ctx: dict[str, Any] = Depends(get_auth_context),
    session: AsyncSession = Depends(get_tenant_db_session)
) -> dict[str, Any]:
    """Lists billing invoice history for the workspace."""
    ws_id = auth_ctx["workspace_id"]
    invoices = await service.list_workspace_invoices(session, ws_id)
    return {"invoices": invoices}


@router.post("/webhook/razorpay")
async def razorpay_subscription_webhook(
    request: Request,
    x_razorpay_signature: str | None = Header(None, alias="X-Razorpay-Signature"),
    session: AsyncSession = Depends(get_system_db_session)
) -> dict[str, Any]:
    """Receives and verifies Razorpay recurring subscription webhook events.
    Subscription statuses are updated strictly from webhooks, never directly from client requests.
    """
    if not x_razorpay_signature:
        raise HTTPException(status_code=400, detail="Missing X-Razorpay-Signature header")

    body_bytes = await request.body()
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    return await service.process_billing_webhook(
        session=session,
        raw_body=body_bytes,
        signature=x_razorpay_signature,
        payload=payload
    )
