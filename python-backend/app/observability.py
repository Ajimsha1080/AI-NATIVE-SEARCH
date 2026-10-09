"""
Production Observability, Prometheus Metrics, and Sentry Integration:
- Request Rate, Latency, and Status Code Counters
- LLM Latency, Token Counts, and Estimated Cost Meters
- Redis Queue Depth & Task Processing Duration
- OpenTelemetry / Distributed Trace Header Propagation
- Sentry Error Tracking Initializer
"""
import os

from fastapi import APIRouter, Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

# 1. Prometheus Metric Instruments
REQUEST_COUNT = Counter(
    "shopmate_http_requests_total",
    "Total HTTP requests handled by service",
    ["method", "endpoint", "status_code", "workspace_id"]
)

REQUEST_LATENCY = Histogram(
    "shopmate_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

LLM_INFERENCE_LATENCY = Histogram(
    "shopmate_llm_inference_duration_seconds",
    "LLM latency in seconds",
    ["provider", "model"],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.0, 3.0, 5.0, 8.0, 15.0]
)

LLM_TOKENS_TOTAL = Counter(
    "shopmate_llm_tokens_total",
    "Total input and output tokens consumed across workspaces",
    ["workspace_id", "direction"]  # direction = "in" or "out"
)

LLM_COST_ESTIMATED_USD = Counter(
    "shopmate_llm_cost_estimated_usd_total",
    "Total estimated LLM spend in USD",
    ["workspace_id"]
)

QUEUE_DEPTH = Gauge(
    "shopmate_task_queue_depth",
    "Current depth of async background jobs"
)

ACTIVE_SESSIONS_COUNT = Gauge(
    "shopmate_active_user_sessions",
    "Number of active authenticated sessions"
)


def init_sentry():
    """Initializes Sentry for error tracking and APM tracing if DSN is configured."""
    dsn = os.getenv("SENTRY_DSN")
    if not dsn:
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        environment = os.getenv("APP_ENV", "development")
        sentry_sdk.init(
            dsn=dsn,
            environment=environment,
            traces_sample_rate=0.2 if environment == "production" else 1.0,
            profiles_sample_rate=0.1 if environment == "production" else 0.5,
            integrations=[
                FastApiIntegration(),
                SqlalchemyIntegration(),
            ],
            send_default_pii=False,
        )
    except Exception as e:
        print(f"[OBSERVABILITY] Sentry initialization skipped: {e}")


router = APIRouter(tags=["Observability & Metrics"])


@router.get("/metrics")
def prometheus_metrics():
    """Prometheus scrape endpoint."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
