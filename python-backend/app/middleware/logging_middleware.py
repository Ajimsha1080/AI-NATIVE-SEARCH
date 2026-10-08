import json
import logging
import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("shopmate_request")

class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    """
    Enterprise Observability Middleware:
    1. Generates and propagates X-Request-ID across all requests.
    2. Logs structured JSON format with latency, tenant, status, and path.
    """
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        request_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:12]}"
        workspace_id = request.headers.get("X-Workspace-Id") or "global"

        # Attach request_id to request state
        request.state.request_id = request_id
        request.state.workspace_id = workspace_id

        try:
            response = await call_next(request)
            latency_ms = round((time.time() - start_time) * 1000, 2)
            response.headers["X-Request-ID"] = request_id

            log_entry = {
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "request_id": request_id,
                "workspace_id": workspace_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "latency_ms": latency_ms
            }

            if response.status_code >= 400:
                logger.warning(json.dumps(log_entry))
            else:
                logger.info(json.dumps(log_entry))

            return response
        except Exception as exc:
            latency_ms = round((time.time() - start_time) * 1000, 2)
            log_entry = {
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "request_id": request_id,
                "workspace_id": workspace_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": 500,
                "latency_ms": latency_ms,
                "error": str(exc)
            }
            logger.error(json.dumps(log_entry))
            raise exc
