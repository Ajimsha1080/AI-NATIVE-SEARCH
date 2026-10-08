"""Production Redis Service

Handles:
1. Distributed Sliding-Window Rate Limiting
2. Token Denylist & Revocation with TTL
3. Multi-Tenant Usage Tracking & Metering
Includes graceful in-memory fallback for local environments without a running Redis daemon.
"""

import hashlib
import logging
import time
from collections import defaultdict
from typing import Any

from .config import settings

logger = logging.getLogger("shopmate_redis")

_redis_client = None
_redis_available: bool | None = None
_sync_redis_client = None
_sync_redis_available: bool | None = None

# In-memory fallback stores for test/offline environments
_inmemory_revoked_tokens: dict[str, float] = {}
_inmemory_rate_limits: dict[str, list[float]] = defaultdict(list)
_inmemory_usage_tracking: dict[str, int] = defaultdict(int)


async def get_redis_client():
    """Initializes or returns singleton async Redis client."""
    global _redis_client, _redis_available
    if _redis_available is False:
        return None

    if _redis_client is not None:
        return _redis_client

    redis_url = settings.REDIS_URL or "redis://localhost:6379/0"
    try:
        import redis.asyncio as aioredis
        client = aioredis.from_url(redis_url, decode_responses=True, socket_connect_timeout=1.0)
        await client.ping()
        _redis_client = client
        _redis_available = True
        logger.info("Connected to Redis at %s", redis_url)
        return _redis_client
    except Exception as e:
        logger.warning("Redis unavailable (%s). Falling back to local in-memory storage.", e)
        _redis_available = False
        return None


def get_sync_redis_client():
    """Initializes or returns singleton sync Redis client."""
    global _sync_redis_client, _sync_redis_available
    if _sync_redis_available is False:
        return None

    if _sync_redis_client is not None:
        return _sync_redis_client

    redis_url = settings.REDIS_URL or "redis://localhost:6379/0"
    try:
        import redis
        client = redis.Redis.from_url(redis_url, decode_responses=True, socket_connect_timeout=1.0)
        client.ping()
        _sync_redis_client = client
        _sync_redis_available = True
        return _sync_redis_client
    except Exception as e:
        _sync_redis_available = False
        return None


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ============================================================================
# TOKEN REVOCATION
# ============================================================================

async def revoke_token(token: str, ttl_seconds: int = 86400) -> None:
    """Revokes a JWT token by adding its hash to Redis denylist with an expiration TTL."""
    h = hash_token(token)
    _inmemory_revoked_tokens[h] = time.time() + ttl_seconds
    client = await get_redis_client()
    if client:
        try:
            await client.setex(f"revoked_token:{h}", ttl_seconds, "1")
        except Exception as e:
            logger.error("Redis setex failed: %s", e)


def revoke_token_sync(token: str, ttl_seconds: int = 86400) -> None:
    """Synchronous revocation of a JWT token."""
    h = hash_token(token)
    _inmemory_revoked_tokens[h] = time.time() + ttl_seconds
    client = get_sync_redis_client()
    if client:
        try:
            client.setex(f"revoked_token:{h}", ttl_seconds, "1")
        except Exception as e:
            logger.error("Sync Redis setex failed: %s", e)


async def is_token_revoked(token: str) -> bool:
    """Checks whether a token has been revoked in Redis or in-memory fallback."""
    h = hash_token(token)
    client = await get_redis_client()
    if client:
        try:
            val = await client.get(f"revoked_token:{h}")
            if val is not None:
                return True
        except Exception as e:
            logger.error("Redis get failed: %s", e)

    if h in _inmemory_revoked_tokens:
        if time.time() < _inmemory_revoked_tokens[h]:
            return True
        else:
            del _inmemory_revoked_tokens[h]
    return False


def is_token_revoked_sync(token: str) -> bool:
    """Synchronous check if a token has been revoked."""
    h = hash_token(token)
    client = get_sync_redis_client()
    if client:
        try:
            val = client.get(f"revoked_token:{h}")
            if val is not None:
                return True
        except Exception as e:
            logger.error("Sync Redis get failed: %s", e)

    if h in _inmemory_revoked_tokens:
        if time.time() < _inmemory_revoked_tokens[h]:
            return True
        else:
            del _inmemory_revoked_tokens[h]
    return False


# ============================================================================
# SLIDING-WINDOW RATE LIMITING
# ============================================================================

async def check_rate_limit(key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
    """Sliding-window rate limiter using Redis sorted sets.
    Returns (is_allowed, retry_after_seconds).
    """
    now = time.time()
    client = await get_redis_client()
    if client:
        try:
            redis_key = f"ratelimit:{key}"
            pipe = client.pipeline()
            pipe.zremrangebyscore(redis_key, 0, now - window_seconds)
            pipe.zadd(redis_key, {str(now): now})
            pipe.zcard(redis_key)
            pipe.expire(redis_key, window_seconds)
            _, _, count, _ = await pipe.execute()

            if count > max_requests:
                oldest = await client.zrange(redis_key, 0, 0, withscores=True)
                retry_after = int(window_seconds - (now - float(oldest[0][1]))) + 1 if oldest else 1
                return False, max(1, retry_after)
            return True, 0
        except Exception as e:
            logger.error("Redis rate limiting failed: %s", e)

    # In-memory fallback
    timestamps = [t for t in _inmemory_rate_limits[key] if now - t < window_seconds]
    if len(timestamps) >= max_requests:
        retry_after = int(window_seconds - (now - timestamps[0])) + 1
        return False, max(1, retry_after)

    timestamps.append(now)
    _inmemory_rate_limits[key] = timestamps
    return True, 0


# ============================================================================
# USAGE TRACKING & METERING
# ============================================================================

async def track_workspace_usage(workspace_id: str, metric: str = "api_requests", count: int = 1) -> int:
    """Tracks and increments tenant usage metrics in Redis."""
    date_str = time.strftime("%Y-%m-%d", time.gmtime())
    key = f"usage:{workspace_id}:{metric}:{date_str}"
    client = await get_redis_client()
    if client:
        try:
            val = await client.incrby(key, count)
            await client.expire(key, 86400 * 35)  # 35 days retention
            return val
        except Exception as e:
            logger.error("Redis usage tracking failed: %s", e)

    _inmemory_usage_tracking[key] += count
    return _inmemory_usage_tracking[key]


async def get_workspace_usage(workspace_id: str, metric: str = "api_requests") -> int:
    """Retrieves today's usage count for a tenant."""
    date_str = time.strftime("%Y-%m-%d", time.gmtime())
    key = f"usage:{workspace_id}:{metric}:{date_str}"
    client = await get_redis_client()
    if client:
        try:
            val = await client.get(key)
            return int(val) if val else 0
        except Exception as e:
            logger.error("Redis usage query failed: %s", e)

    return _inmemory_usage_tracking.get(key, 0)
