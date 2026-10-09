import datetime
import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import (
    BillingWebhookEventModel,
    InvoiceModel,
    PlanModel,
    SubscriptionModel,
    WorkspaceMemberModel,
    WorkspaceModel,
    utcnow,
)
from app.email_service import (
    send_payment_failed_email,
    send_plan_changed_email,
    send_trial_ending_email,
)
from .provider import get_billing_provider


DEFAULT_PLANS = [
    {
        "code": "free",
        "name": "Free Tier",
        "price": 0.0,
        "currency": "INR",
        "interval": "monthly",
        "description": "Essential AI Search & Chat for hobby stores and trial evaluations.",
        "limits": {
            "search_requests_per_month": 1000,
            "tokens_per_month": 100000,
            "products": 50,
            "knowledge_docs": 2,
            "crawl_runs": 2,
            "seats": 1,
            "llm_cost_cap_usd": 5.0
        }
    },
    {
        "code": "starter",
        "name": "Starter",
        "price": 1999.0,
        "currency": "INR",
        "interval": "monthly",
        "description": "Ideal for growing independent e-commerce stores.",
        "limits": {
            "search_requests_per_month": 10000,
            "tokens_per_month": 1000000,
            "products": 500,
            "knowledge_docs": 10,
            "crawl_runs": 10,
            "seats": 3,
            "llm_cost_cap_usd": 25.0
        }
    },
    {
        "code": "pro",
        "name": "Pro Growth",
        "price": 7999.0,
        "currency": "INR",
        "interval": "monthly",
        "description": "Full-power AI discovery, large catalogs and team collaboration.",
        "limits": {
            "search_requests_per_month": 50000,
            "tokens_per_month": 5000000,
            "products": 2500,
            "knowledge_docs": 50,
            "crawl_runs": 50,
            "seats": 10,
            "llm_cost_cap_usd": 100.0
        }
    },
    {
        "code": "enterprise",
        "name": "Enterprise Scale",
        "price": 24999.0,
        "currency": "INR",
        "interval": "monthly",
        "description": "Custom scale, unlimited crawl pipelines and highest token throughput.",
        "limits": {
            "search_requests_per_month": 500000,
            "tokens_per_month": 50000000,
            "products": 25000,
            "knowledge_docs": 500,
            "crawl_runs": 500,
            "seats": 50,
            "llm_cost_cap_usd": 500.0
        }
    }
]


def to_naive_utc(dt: datetime.datetime | None) -> datetime.datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(datetime.UTC).replace(tzinfo=None)
    return dt


async def ensure_plans_seeded(session: AsyncSession) -> None:
    """Ensures base subscription plans exist in database."""
    res = await session.execute(select(PlanModel.code))
    existing_codes = set(res.scalars().all())
    for p in DEFAULT_PLANS:
        if p["code"] not in existing_codes:
            model = PlanModel(
                code=p["code"],
                name=p["name"],
                price=p["price"],
                currency=p["currency"],
                interval=p["interval"],
                description=p["description"],
                limits_json=p["limits"],
                is_active=True,
            )
            session.add(model)
    await session.commit()


async def list_plans(session: AsyncSession) -> list[dict[str, Any]]:
    """Returns all active billing plans."""
    res = await session.execute(
        select(PlanModel).where(PlanModel.is_active == True).order_by(PlanModel.price.asc())
    )
    plans = res.scalars().all()
    if not plans:
        await ensure_plans_seeded(session)
        res = await session.execute(
            select(PlanModel).where(PlanModel.is_active == True).order_by(PlanModel.price.asc())
        )
        plans = res.scalars().all()

    return [
        {
            "code": p.code,
            "name": p.name,
            "price": p.price,
            "currency": p.currency,
            "interval": p.interval,
            "description": p.description,
            "limits": p.limits_json,
        }
        for p in plans
    ]


async def get_or_create_workspace_subscription(
    session: AsyncSession,
    workspace_id: str
) -> SubscriptionModel:
    """Retrieves current workspace subscription, or creates a 14-day free trial on the starter plan."""
    await ensure_plans_seeded(session)
    res = await session.execute(
        select(SubscriptionModel).where(SubscriptionModel.workspace_id == workspace_id)
    )
    sub = res.scalars().first()
    if sub:
        return sub

    now = utcnow()
    trial_days = settings.TRIAL_PERIOD_DAYS
    trial_end = now + datetime.timedelta(days=trial_days)

    new_sub = SubscriptionModel(
        id=f"sub_{uuid.uuid4().hex[:12]}",
        workspace_id=workspace_id,
        plan_code="starter",
        status="TRIALING",
        current_period_start=now,
        current_period_end=trial_end,
        trial_end=trial_end,
        cancel_at_period_end=False,
        provider=settings.BILLING_PROVIDER,
        provider_customer_id=None,
        provider_subscription_id=None,
    )
    session.add(new_sub)
    await session.commit()
    await session.refresh(new_sub)
    return new_sub


async def get_subscription_details(
    session: AsyncSession,
    workspace_id: str
) -> dict[str, Any]:
    """Returns full subscription status, active plan, limits, and trial countdown."""
    sub = await get_or_create_workspace_subscription(session, workspace_id)
    plan_res = await session.execute(
        select(PlanModel).where(PlanModel.code == sub.plan_code)
    )
    plan = plan_res.scalars().first()

    now = utcnow()
    days_left_in_trial = 0
    if sub.trial_end and sub.status == "TRIALING":
        t_end = to_naive_utc(sub.trial_end)
        t_now = to_naive_utc(now)
        if t_end and t_now:
            diff = (t_end - t_now).total_seconds()
            days_left_in_trial = max(0, int(diff // 86400))

    return {
        "subscription": {
            "id": sub.id,
            "workspace_id": sub.workspace_id,
            "plan_code": sub.plan_code,
            "status": sub.status,
            "current_period_start": sub.current_period_start.isoformat() if sub.current_period_start else None,
            "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
            "trial_end": sub.trial_end.isoformat() if sub.trial_end else None,
            "days_left_in_trial": days_left_in_trial,
            "cancel_at_period_end": sub.cancel_at_period_end,
            "grace_period_end": sub.grace_period_end.isoformat() if sub.grace_period_end else None,
            "provider": sub.provider,
            "provider_subscription_id": sub.provider_subscription_id,
        },
        "plan": {
            "code": plan.code if plan else sub.plan_code,
            "name": plan.name if plan else sub.plan_code.capitalize(),
            "price": plan.price if plan else 0.0,
            "currency": plan.currency if plan else "INR",
            "interval": plan.interval if plan else "monthly",
            "limits": plan.limits_json if plan else {},
        } if plan else None
    }


async def create_checkout_session(
    session: AsyncSession,
    workspace_id: str,
    plan_code: str,
    customer_email: str,
    customer_name: str
) -> dict[str, Any]:
    """Initiates a subscription checkout with the configured billing provider."""
    plan_res = await session.execute(
        select(PlanModel).where(PlanModel.code == plan_code, PlanModel.is_active == True)
    )
    plan = plan_res.scalars().first()
    if not plan:
        await ensure_plans_seeded(session)
        plan_res = await session.execute(
            select(PlanModel).where(PlanModel.code == plan_code, PlanModel.is_active == True)
        )
        plan = plan_res.scalars().first()

    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan '{plan_code}' not found or inactive")

    sub = await get_or_create_workspace_subscription(session, workspace_id)
    provider = get_billing_provider()

    # Create/fetch customer id
    cust_id = sub.provider_customer_id
    if not cust_id:
        cust_id = await provider.create_customer(name=customer_name, email=customer_email)
        sub.provider_customer_id = cust_id
        await session.commit()

    # Create subscription session
    checkout_data = await provider.create_subscription(
        customer_id=cust_id,
        plan_code=plan.code,
        plan_amount=plan.price,
        plan_currency=plan.currency,
        notes={"workspace_id": workspace_id, "plan_code": plan.code}
    )

    sub.provider_subscription_id = checkout_data.get("provider_subscription_id")
    await session.commit()

    return {
        "success": True,
        "subscription_id": sub.id,
        "provider_subscription_id": checkout_data.get("provider_subscription_id"),
        "checkout_url": checkout_data.get("short_url") or checkout_data.get("checkout_url"),
        "plan": {
            "code": plan.code,
            "name": plan.name,
            "price": plan.price,
            "currency": plan.currency
        }
    }


async def cancel_subscription(
    session: AsyncSession,
    workspace_id: str
) -> dict[str, Any]:
    """Marks the subscription to cancel at the end of the current billing cycle."""
    sub = await get_or_create_workspace_subscription(session, workspace_id)
    provider = get_billing_provider()

    if sub.provider_subscription_id:
        await provider.cancel_subscription(sub.provider_subscription_id, cancel_at_cycle_end=True)

    sub.cancel_at_period_end = True
    await session.commit()

    return {
        "success": True,
        "message": "Subscription scheduled to cancel at end of current period.",
        "subscription_id": sub.id,
        "cancel_at_period_end": True
    }


async def list_workspace_invoices(
    session: AsyncSession,
    workspace_id: str
) -> list[dict[str, Any]]:
    """Returns invoice history for the workspace."""
    res = await session.execute(
        select(InvoiceModel)
        .where(InvoiceModel.workspace_id == workspace_id)
        .order_by(desc(InvoiceModel.created_at))
    )
    invoices = res.scalars().all()
    return [
        {
            "id": inv.id,
            "amount": inv.amount,
            "currency": inv.currency,
            "status": inv.status,
            "invoice_pdf_url": inv.invoice_pdf_url,
            "provider_invoice_id": inv.provider_invoice_id,
            "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
            "billing_period_start": inv.billing_period_start.isoformat() if inv.billing_period_start else None,
            "billing_period_end": inv.billing_period_end.isoformat() if inv.billing_period_end else None,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
        }
        for inv in invoices
    ]


async def process_billing_webhook(
    session: AsyncSession,
    raw_body: bytes,
    signature: str,
    payload: dict[str, Any]
) -> dict[str, Any]:
    """Cryptographically verifies and idempotently processes provider webhook events."""
    provider = get_billing_provider()
    secret = settings.RAZORPAY_WEBHOOK_SECRET or settings.RAZORPAY_KEY_SECRET

    if not secret:
        if settings.APP_ENV.lower() == "production":
            raise HTTPException(status_code=500, detail="RAZORPAY_WEBHOOK_SECRET is not configured.")
    elif not provider.verify_webhook_signature(raw_body, signature, secret):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_id = payload.get("id") or payload.get("event_id") or f"evt_{uuid.uuid4().hex[:12]}"
    event_type = payload.get("event") or payload.get("event_type") or "unknown"

    # Idempotency check: don't process duplicate events
    existing = await session.execute(
        select(BillingWebhookEventModel).where(BillingWebhookEventModel.event_id == event_id)
    )
    if existing.scalars().first():
        return {"status": "ignored", "reason": "event_already_processed", "event_id": event_id}

    # Store event for audit and idempotency
    event_rec = BillingWebhookEventModel(
        id=f"whevt_{uuid.uuid4().hex[:12]}",
        provider="razorpay",
        event_id=event_id,
        event_type=event_type,
        payload_json=payload,
    )
    session.add(event_rec)

    # Extract entity
    event_payload = payload.get("payload", {})
    sub_entity = event_payload.get("subscription", {}).get("entity", {})
    payment_entity = event_payload.get("payment", {}).get("entity", {})

    provider_sub_id = sub_entity.get("id") or payment_entity.get("subscription_id")
    notes = sub_entity.get("notes") or payment_entity.get("notes") or {}
    workspace_id = notes.get("workspace_id")

    # Locate the target subscription
    sub = None
    if provider_sub_id:
        res = await session.execute(
            select(SubscriptionModel).where(SubscriptionModel.provider_subscription_id == provider_sub_id)
        )
        sub = res.scalars().first()

    if not sub and workspace_id:
        res = await session.execute(
            select(SubscriptionModel).where(SubscriptionModel.workspace_id == workspace_id)
        )
        sub = res.scalars().first()

    # Find workspace owner email for notification
    owner_email = None
    workspace_name = "Your Workspace"
    if sub:
        ws_res = await session.execute(
            select(WorkspaceModel).where(WorkspaceModel.id == sub.workspace_id)
        )
        ws = ws_res.scalars().first()
        if ws:
            workspace_name = ws.name

        member_res = await session.execute(
            select(WorkspaceMemberModel).where(
                WorkspaceMemberModel.workspace_id == sub.workspace_id,
                WorkspaceMemberModel.role == "OWNER"
            )
        )
        owner_member = member_res.scalars().first()
        if owner_member:
            from app.db.models import UserModel
            u_res = await session.execute(select(UserModel).where(UserModel.id == owner_member.user_id))
            u = u_res.scalars().first()
            if u:
                owner_email = u.email

    now = utcnow()

    # State Machine Transitions:
    # 1. subscription.activated
    if event_type in ("subscription.activated", "subscription.authenticated"):
        if sub:
            old_plan = sub.plan_code
            new_plan = notes.get("plan_code") or sub.plan_code
            sub.status = "ACTIVE"
            sub.plan_code = new_plan
            sub.trial_end = None
            if sub_entity.get("current_end"):
                sub.current_period_end = datetime.datetime.fromtimestamp(sub_entity["current_end"], datetime.UTC)
            if owner_email and old_plan != new_plan:
                await send_plan_changed_email(owner_email, workspace_name, old_plan, new_plan)

    # 2. subscription.charged / payment.captured (Renewal / Successful billing)
    elif event_type in ("subscription.charged", "payment.captured", "invoice.paid"):
        if sub:
            old_plan = sub.plan_code
            new_plan = notes.get("plan_code") or (sub_entity.get("plan_id", "").replace("plan_", "") if sub_entity.get("plan_id") else None) or sub.plan_code
            sub.status = "ACTIVE"
            sub.plan_code = new_plan
            sub.trial_end = None
            sub.grace_period_end = None
            amount = float(payment_entity.get("amount", 0)) / 100.0 if payment_entity.get("amount") else 0.0
            currency = payment_entity.get("currency", "INR")
            invoice_id = f"inv_{uuid.uuid4().hex[:12]}"

            if owner_email and old_plan != new_plan:
                await send_plan_changed_email(owner_email, workspace_name, old_plan, new_plan)

            if sub_entity.get("current_end"):
                sub.current_period_end = datetime.datetime.fromtimestamp(sub_entity["current_end"], datetime.UTC)

            inv = InvoiceModel(
                id=invoice_id,
                workspace_id=sub.workspace_id,
                subscription_id=sub.id,
                amount=amount,
                currency=currency,
                status="PAID",
                provider_invoice_id=payment_entity.get("invoice_id"),
                provider_payment_id=payment_entity.get("id"),
                paid_at=now,
                billing_period_start=sub.current_period_start,
                billing_period_end=sub.current_period_end,
            )
            session.add(inv)

    # 3. subscription.payment.failed (Failed charge -> Enter Grace Period)
    elif event_type in ("subscription.payment.failed", "payment.failed"):
        if sub:
            sub.status = "PAST_DUE"
            grace_days = settings.PAYMENT_GRACE_PERIOD_DAYS
            sub.grace_period_end = now + datetime.timedelta(days=grace_days)
            amount = float(payment_entity.get("amount", 0)) / 100.0 if payment_entity.get("amount") else 0.0
            if owner_email:
                await send_payment_failed_email(owner_email, workspace_name, amount, grace_days=grace_days)

    # 4. subscription.halted (Grace period exceeded -> Suspend)
    elif event_type == "subscription.halted":
        if sub:
            sub.status = "HALTED"

    # 5. subscription.cancelled (Explicit cancellation)
    elif event_type in ("subscription.cancelled", "subscription.completed"):
        if sub:
            sub.status = "CANCELLED"
            sub.cancel_at_period_end = True

    await session.commit()
    return {"status": "success", "event_id": event_id, "event_type": event_type}
