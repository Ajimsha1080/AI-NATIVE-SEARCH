import time
from collections import defaultdict

from fastapi import Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


from ..redis_service import check_rate_limit, track_workspace_usage


class EnterpriseRateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Distributed sliding-window enterprise rate limiter backed by Redis.
    Keyed by path, Tenant (workspace_id), and Client IP.
    """
    def __init__(self, app):
        super().__init__(app)
        # Endpoint path prefix -> (requests_allowed, window_seconds)
        self.limits = {
            "/api/v1/auth/": (20, 60),          # 20 requests per minute for auth
            "/api/v1/ai-mode/search": (60, 60),  # 60 requests per minute for search
            "/api/v1/ai-mode/chat": (30, 60),    # 30 requests per minute for AI chat
        }

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Check if route matches rate-limited prefix
        matched_limit = None
        for prefix, limit_tuple in self.limits.items():
            if path.startswith(prefix) or path == prefix:
                matched_limit = limit_tuple
                break

        workspace_id = request.headers.get("X-Workspace-Id") or "global"

        if matched_limit:
            max_reqs, window_sec = matched_limit
            client_ip = request.client.host if request.client else "unknown_ip"
            rate_key = f"{path}:{workspace_id}:{client_ip}"

            is_allowed, retry_after = await check_rate_limit(rate_key, max_reqs, window_sec)
            if not is_allowed:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "error": {
                            "code": "RATE_LIMIT_EXCEEDED",
                            "message": f"Too many requests to '{path}'. Please retry after {retry_after} seconds.",
                            "retry_after": retry_after
                        }
                    },
                    headers={"Retry-After": str(retry_after)}
                )

        # Track usage in Redis
        if workspace_id and workspace_id != "global":
            try:
                await track_workspace_usage(workspace_id, metric="api_requests", count=1)
            except Exception:
                pass

        response = await call_next(request)
        return response
