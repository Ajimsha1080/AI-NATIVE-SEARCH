import time
from collections import defaultdict

from fastapi import Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class EnterpriseRateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Sliding-window enterprise rate limiter keyed by Tenant (workspace_id) and Client IP.
    Applies stricter protection to chat, search, and auth endpoints.
    """
    def __init__(self, app):
        super().__init__(app)
        self.request_records: dict[str, list[float]] = defaultdict(list)
        # Endpoint path prefix -> (requests_allowed, window_seconds)
        self.limits = {
            "/api/v1/auth/": (20, 60),         # 20 requests per minute for auth
            "/api/v1/ai-mode/search": (60, 60), # 60 requests per minute for search
            "/api/v1/ai-mode/chat": (30, 60),   # 30 requests per minute for AI chat
        }

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Check if route matches rate-limited prefix
        matched_limit = None
        for prefix, limit_tuple in self.limits.items():
            if path.startswith(prefix) or path == prefix:
                matched_limit = limit_tuple
                break

        if matched_limit:
            max_reqs, window_sec = matched_limit
            client_ip = request.client.host if request.client else "unknown_ip"
            workspace_id = request.headers.get("X-Workspace-Id") or "global"
            key = f"{path}:{workspace_id}:{client_ip}"

            now = time.time()
            # Prune older entries outside the window
            timestamps = [t for t in self.request_records[key] if now - t < window_sec]

            if len(timestamps) >= max_reqs:
                retry_after = int(window_sec - (now - timestamps[0])) + 1
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

            timestamps.append(now)
            self.request_records[key] = timestamps

        response = await call_next(request)
        return response
