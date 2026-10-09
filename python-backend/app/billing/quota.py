from collections.abc import Callable
from typing import Any

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_auth_context
from app.db.database import get_tenant_db_session

from .metering import get_full_workspace_usage_summary


class QuotaExceededException(HTTPException):
    def __init__(self, metric: str, plan_name: str, used: int | float, limit: int | float, upgrade_url: str):
        super().__init__(
            status_code=402,
            detail={
                "error": "PLAN_QUOTA_EXCEEDED",
                "metric": metric,
                "used": used,
                "limit": limit,
                "plan_name": plan_name,
                "message": f"Workspace has exceeded its monthly limit for {metric} ({used}/{limit}) on the {plan_name} plan. Please upgrade to continue.",
                "upgrade_url": upgrade_url
            }
        )


def require_quota(metric: str) -> Callable:
    """Reusable FastAPI dependency to enforce plan limits on merchant operations.
    Returns HTTP 402 with structured upgrade information when exceeded.
    """
    async def _quota_checker(
        auth_ctx: dict[str, Any] = Depends(get_auth_context),
        session: AsyncSession = Depends(get_tenant_db_session)
    ) -> dict[str, Any]:
        ws_id = auth_ctx["workspace_id"]
        summary = await get_full_workspace_usage_summary(session, ws_id)
        meters = summary.get("meters", {})

        target_meter = meters.get(metric)
        if target_meter and target_meter.get("exceeded"):
            raise QuotaExceededException(
                metric=metric,
                plan_name=summary.get("plan_name", "Current"),
                used=target_meter.get("used", 0),
                limit=target_meter.get("limit", 0),
                upgrade_url=summary.get("upgrade_url", "/ai-mode/billing")
            )

        # Check cost cap
        cost_cap_meter = meters.get("cost_cap", {})
        if cost_cap_meter and cost_cap_meter.get("exceeded"):
            raise QuotaExceededException(
                metric="llm_cost_cap",
                plan_name=summary.get("plan_name", "Current"),
                used=cost_cap_meter.get("used_usd", 0.0),
                limit=cost_cap_meter.get("limit_usd", 0.0),
                upgrade_url=summary.get("upgrade_url", "/ai-mode/billing")
            )

        return summary

    return _quota_checker


async def check_storefront_quota(session: AsyncSession, workspace_id: str) -> tuple[bool, str | None]:
    """Graceful storefront quota verification. Returns (allowed, friendly_message).
    Never breaks storefront widgets silently with raw crashes.
    """
    summary = await get_full_workspace_usage_summary(session, workspace_id)
    meters = summary.get("meters", {})
    searches_meter = meters.get("searches", {})
    cost_meter = meters.get("cost_cap", {})

    if searches_meter.get("exceeded") or cost_meter.get("exceeded"):
        return False, "This storefront has temporarily reached its monthly AI assistant inquiry allowance. Please browse our catalog directly or contact store support."

    return True, None
