import datetime
import logging
import time
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    KnowledgeSourceModel,
    ProductModel,
    UsageRecordModel,
    UserModel,
    WorkspaceMemberModel,
    WorkspaceModel,
    utcnow,
)
from app.config import settings
from app.email_service import send_cost_cap_alert_email
from app.redis_service import get_redis_client, _inmemory_usage_tracking
from .service import get_subscription_details

logger = logging.getLogger("shopmate_metering")

# Standard blended cost per 1k tokens: $0.00015 input, $0.0006 output
COST_PER_1K_INPUT_TOKENS = 0.00015
COST_PER_1K_OUTPUT_TOKENS = 0.0006


def current_month_str() -> str:
    return time.strftime("%Y-%m", time.gmtime())


async def increment_monthly_usage(
    workspace_id: str,
    searches: int = 0,
    chats: int = 0,
    tokens_in: int = 0,
    tokens_out: int = 0,
    crawls: int = 0
) -> dict[str, float]:
    """Increments Redis monthly counters and computes cost delta."""
    month = current_month_str()
    client = await get_redis_client()

    cost_delta = (
        (tokens_in / 1000.0) * COST_PER_1K_INPUT_TOKENS +
        (tokens_out / 1000.0) * COST_PER_1K_OUTPUT_TOKENS
    )

    metrics = {
        "searches": searches,
        "chats": chats,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "crawls": crawls,
    }

    if client:
        try:
            pipe = client.pipeline()
            for m, count in metrics.items():
                if count > 0:
                    key = f"usage_monthly:{workspace_id}:{month}:{m}"
                    pipe.incrby(key, count)
                    pipe.expire(key, 86400 * 60)
            if cost_delta > 0:
                cost_key = f"usage_monthly:{workspace_id}:{month}:cost_usd"
                pipe.incrbyfloat(cost_key, cost_delta)
                pipe.expire(cost_key, 86400 * 60)
            await pipe.execute()
        except Exception as e:
            logger.error("Redis monthly usage increment failed: %s", e)

    # In-memory fallback
    for m, count in metrics.items():
        if count > 0:
            key = f"usage_monthly:{workspace_id}:{month}:{m}"
            _inmemory_usage_tracking[key] += count
    if cost_delta > 0:
        cost_key = f"usage_monthly:{workspace_id}:{month}:cost_usd"
        _inmemory_usage_tracking[cost_key] = _inmemory_usage_tracking.get(cost_key, 0.0) + cost_delta

    return {"cost_delta": cost_delta}


async def get_monthly_usage_totals(workspace_id: str, month: str | None = None) -> dict[str, Any]:
    """Fetches total counts for the specified month from Redis."""
    month = month or current_month_str()
    client = await get_redis_client()

    keys = {
        "searches": f"usage_monthly:{workspace_id}:{month}:searches",
        "chats": f"usage_monthly:{workspace_id}:{month}:chats",
        "tokens_in": f"usage_monthly:{workspace_id}:{month}:tokens_in",
        "tokens_out": f"usage_monthly:{workspace_id}:{month}:tokens_out",
        "crawls": f"usage_monthly:{workspace_id}:{month}:crawls",
        "cost_usd": f"usage_monthly:{workspace_id}:{month}:cost_usd",
    }

    totals: dict[str, Any] = {
        "searches": 0,
        "chats": 0,
        "tokens_in": 0,
        "tokens_out": 0,
        "crawls": 0,
        "cost_usd": 0.0,
    }

    if client:
        try:
            vals = await client.mget(list(keys.values()))
            for (metric, _), val in zip(keys.items(), vals):
                if val is not None:
                    totals[metric] = float(val) if metric == "cost_usd" else int(val)
            return totals
        except Exception as e:
            logger.error("Redis mget usage failed: %s", e)

    # Fallback to in-memory
    for metric, key in keys.items():
        val = _inmemory_usage_tracking.get(key, 0)
        totals[metric] = float(val) if metric == "cost_usd" else int(val)

    return totals


async def reconcile_usage_to_db(
    session: AsyncSession,
    workspace_id: str,
    month: str | None = None
) -> UsageRecordModel:
    """Reconciles Redis usage metrics into the persistent database table billing_usage_records."""
    month = month or current_month_str()
    totals = await get_monthly_usage_totals(workspace_id, month)

    res = await session.execute(
        select(UsageRecordModel).where(
            UsageRecordModel.workspace_id == workspace_id,
            UsageRecordModel.period_month == month
        )
    )
    rec = res.scalars().first()
    if not rec:
        rec = UsageRecordModel(
            id=f"usg_{uuid.uuid4().hex[:12]}",
            workspace_id=workspace_id,
            period_month=month,
            search_requests=totals["searches"],
            chat_requests=totals["chats"],
            tokens_in=totals["tokens_in"],
            tokens_out=totals["tokens_out"],
            estimated_cost_usd=totals["cost_usd"],
            crawl_runs=totals["crawls"],
            alert_80_sent=False,
            alert_100_sent=False,
            updated_at=utcnow(),
        )
        session.add(rec)
    else:
        rec.search_requests = max(rec.search_requests, totals["searches"])
        rec.chat_requests = max(rec.chat_requests, totals["chats"])
        rec.tokens_in = max(rec.tokens_in, totals["tokens_in"])
        rec.tokens_out = max(rec.tokens_out, totals["tokens_out"])
        rec.estimated_cost_usd = max(rec.estimated_cost_usd, totals["cost_usd"])
        rec.crawl_runs = max(rec.crawl_runs, totals["crawls"])
        rec.updated_at = utcnow()

    await session.commit()
    await session.refresh(rec)
    return rec


async def check_cost_cap_and_alert(
    session: AsyncSession,
    workspace_id: str,
    current_cost: float,
    cost_cap: float
) -> None:
    """Checks cost cap thresholds (80% and 100%) and sends alert emails."""
    if cost_cap <= 0:
        return

    month = current_month_str()
    rec = await reconcile_usage_to_db(session, workspace_id, month)

    pct = (current_cost / cost_cap) * 100.0

    # Retrieve workspace name and owner email
    ws_res = await session.execute(select(WorkspaceModel).where(WorkspaceModel.id == workspace_id))
    ws = ws_res.scalars().first()
    ws_name = ws.name if ws else "Workspace"

    owner_email = None
    mem_res = await session.execute(
        select(WorkspaceMemberModel).where(
            WorkspaceMemberModel.workspace_id == workspace_id,
            WorkspaceMemberModel.role == "OWNER"
        )
    )
    owner_member = mem_res.scalars().first()
    if owner_member:
        u_res = await session.execute(select(UserModel).where(UserModel.id == owner_member.user_id))
        u = u_res.scalars().first()
        if u:
            owner_email = u.email

    if not owner_email:
        return

    if pct >= 100.0 and not rec.alert_100_sent:
        rec.alert_100_sent = True
        rec.alert_80_sent = True
        await session.commit()
        await send_cost_cap_alert_email(owner_email, ws_name, 100, current_cost, cost_cap)
    elif pct >= 80.0 and not rec.alert_80_sent:
        rec.alert_80_sent = True
        await session.commit()
        await send_cost_cap_alert_email(owner_email, ws_name, 80, current_cost, cost_cap)


async def get_full_workspace_usage_summary(
    session: AsyncSession,
    workspace_id: str
) -> dict[str, Any]:
    """Generates a comprehensive usage summary comparing actual monthly consumption against plan quotas."""
    sub_details = await get_subscription_details(session, workspace_id)
    plan = sub_details.get("plan") or {}
    limits = plan.get("limits") or {}

    month = current_month_str()
    monthly_totals = await get_monthly_usage_totals(workspace_id, month)

    # Count database entities
    prod_count_res = await session.execute(
        select(func.count(ProductModel.id)).where(ProductModel.workspace_id == workspace_id)
    )
    total_products = prod_count_res.scalar() or 0

    docs_count_res = await session.execute(
        select(func.count(KnowledgeSourceModel.id)).where(KnowledgeSourceModel.workspace_id == workspace_id)
    )
    total_docs = docs_count_res.scalar() or 0

    seats_count_res = await session.execute(
        select(func.count(WorkspaceMemberModel.id)).where(WorkspaceMemberModel.workspace_id == workspace_id)
    )
    total_seats = seats_count_res.scalar() or 1

    total_searches_and_chats = monthly_totals["searches"] + monthly_totals["chats"]
    total_tokens = monthly_totals["tokens_in"] + monthly_totals["tokens_out"]
    estimated_cost = monthly_totals["cost_usd"]

    searches_limit = limits.get("search_requests_per_month", 10000)
    tokens_limit = limits.get("tokens_per_month", 1000000)
    products_limit = limits.get("products", 500)
    docs_limit = limits.get("knowledge_docs", 10)
    seats_limit = limits.get("seats", 3)
    cost_cap = limits.get("llm_cost_cap_usd", 25.0)

    # Cost cap alert evaluation
    await check_cost_cap_and_alert(session, workspace_id, estimated_cost, cost_cap)

    def calc_pct(used: float, lim: float) -> int:
        if lim <= 0:
            return 0
        return min(100, int((used / lim) * 100))

    meters = {
        "searches": {
            "used": total_searches_and_chats,
            "limit": searches_limit,
            "percentage": calc_pct(total_searches_and_chats, searches_limit),
            "exceeded": total_searches_and_chats >= searches_limit,
        },
        "tokens": {
            "used": total_tokens,
            "limit": tokens_limit,
            "percentage": calc_pct(total_tokens, tokens_limit),
            "exceeded": total_tokens >= tokens_limit,
        },
        "products": {
            "used": total_products,
            "limit": products_limit,
            "percentage": calc_pct(total_products, products_limit),
            "exceeded": total_products >= products_limit,
        },
        "knowledge_docs": {
            "used": total_docs,
            "limit": docs_limit,
            "percentage": calc_pct(total_docs, docs_limit),
            "exceeded": total_docs >= docs_limit,
        },
        "seats": {
            "used": total_seats,
            "limit": seats_limit,
            "percentage": calc_pct(total_seats, seats_limit),
            "exceeded": total_seats >= seats_limit,
        },
        "cost_cap": {
            "used_usd": round(estimated_cost, 4),
            "limit_usd": cost_cap,
            "percentage": calc_pct(estimated_cost, cost_cap),
            "exceeded": estimated_cost >= cost_cap,
            "warning_80": calc_pct(estimated_cost, cost_cap) >= 80,
        }
    }

    any_exceeded = any(m["exceeded"] for m in meters.values())

    return {
        "workspace_id": workspace_id,
        "period_month": month,
        "plan_name": plan.get("name", "Starter"),
        "plan_code": plan.get("code", "starter"),
        "meters": meters,
        "has_quota_exceeded": any_exceeded,
        "upgrade_url": f"{settings.FRONTEND_URL}/ai-mode/billing"
    }
