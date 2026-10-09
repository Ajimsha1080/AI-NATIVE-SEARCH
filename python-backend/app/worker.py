import asyncio
import json
import logging
import time
import uuid
from collections.abc import Callable
from typing import Any

from .redis_service import get_redis_client

logger = logging.getLogger("shopmate_worker")

REDIS_QUEUE_KEY = "shopmate:jobs:queue"
REDIS_DEAD_LETTER_KEY = "shopmate:jobs:dead_letter"

_TASK_REGISTRY: dict[str, Callable] = {}


def register_task(task_name: str):
    """Decorator to register a callable background task."""
    def decorator(fn: Callable):
        _TASK_REGISTRY[task_name] = fn
        return fn
    return decorator


class BackgroundTaskWorker:
    """Durable task queue worker backed by Redis with exponential retries and dead-letter list."""

    def __init__(self):
        self._is_running = False
        self._worker_task: asyncio.Task | None = None
        self._local_queue: asyncio.Queue = asyncio.Queue()

    async def start(self):
        if not self._is_running:
            self._is_running = True
            self._worker_task = asyncio.create_task(self._process_queue())
            logger.info("Durable background task worker started.")

    async def stop(self):
        self._is_running = False
        if self._worker_task:
            self._worker_task.cancel()

    async def enqueue(
        self,
        task_name: str,
        fn: Callable | None = None,
        *args,
        max_retries: int = 3,
        **kwargs
    ) -> str:
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        if fn:
            _TASK_REGISTRY[task_name] = fn

        payload = {
            "job_id": job_id,
            "task_name": task_name,
            "args": list(args),
            "kwargs": kwargs,
            "retry_count": 0,
            "max_retries": max_retries,
            "enqueued_at": time.time()
        }

        redis = await get_redis_client()
        if redis:
            await redis.rpush(REDIS_QUEUE_KEY, json.dumps(payload))
            logger.info("Enqueued durable job %s (%s) to Redis", job_id, task_name)
        else:
            await self._local_queue.put(payload)
            logger.info("Enqueued job %s (%s) to in-memory queue", job_id, task_name)

        return job_id

    async def _process_queue(self):
        while self._is_running:
            try:
                redis = await get_redis_client()
                job_payload = None

                if redis:
                    # Pop from Redis queue with short timeout
                    raw = await redis.blpop([REDIS_QUEUE_KEY], timeout=2)
                    if raw:
                        _, val = raw
                        job_payload = json.loads(val)
                else:
                    try:
                        job_payload = await asyncio.wait_for(self._local_queue.get(), timeout=2.0)
                    except TimeoutError:
                        pass

                if job_payload:
                    await self._execute_job(job_payload)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Worker processing loop error: %s", e)
                await asyncio.sleep(1)

    async def _execute_job(self, payload: dict[str, Any]):
        job_id = payload["job_id"]
        task_name = payload["task_name"]
        args = payload.get("args", [])
        kwargs = payload.get("kwargs", {})
        retry_count = payload.get("retry_count", 0)
        max_retries = payload.get("max_retries", 3)

        fn = _TASK_REGISTRY.get(task_name)
        if not fn:
            logger.error("No registered handler for task '%s'. Sending to dead letter.", task_name)
            await self._send_to_dead_letter(payload, f"Task '{task_name}' not registered in worker.")
            return

        logger.info("Executing job %s [%s] (attempt %d/%d)", job_id, task_name, retry_count + 1, max_retries + 1)
        try:
            if asyncio.iscoroutinefunction(fn):
                await fn(*args, **kwargs)
            else:
                fn(*args, **kwargs)
            logger.info("Job %s [%s] completed successfully.", job_id, task_name)
        except Exception as exc:
            logger.exception("Job %s [%s] failed: %s", job_id, task_name, exc)
            if retry_count < max_retries:
                payload["retry_count"] = retry_count + 1
                backoff_secs = 2 ** retry_count
                logger.warning("Re-enqueueing job %s with backoff of %ds", job_id, backoff_secs)
                await asyncio.sleep(backoff_secs)
                redis = await get_redis_client()
                if redis:
                    await redis.rpush(REDIS_QUEUE_KEY, json.dumps(payload))
                else:
                    await self._local_queue.put(payload)
            else:
                logger.error("Job %s exhausted %d retries. Moving to dead letter queue.", job_id, max_retries)
                await self._send_to_dead_letter(payload, str(exc))

    async def _send_to_dead_letter(self, payload: dict[str, Any], reason: str):
        payload["failed_at"] = time.time()
        payload["failure_reason"] = reason
        redis = await get_redis_client()
        if redis:
            await redis.rpush(REDIS_DEAD_LETTER_KEY, json.dumps(payload))
        logger.warning("Job %s recorded in dead letter list: %s", payload.get("job_id"), reason)


task_worker = BackgroundTaskWorker()

# Register built-in background tasks
from .connectors import execute_sync_job
from .email_service import send_email

register_task("sync_catalog")(execute_sync_job)
register_task("send_email")(send_email)

if __name__ == "__main__":
    async def _main():
        await task_worker.start()
        logger.info("Durable background worker daemon running. Listening for jobs...")
        try:
            while True:
                await asyncio.sleep(1)
        except (KeyboardInterrupt, asyncio.CancelledError):
            await task_worker.stop()
            logger.info("Worker daemon stopped.")

    try:
        asyncio.run(_main())
    except KeyboardInterrupt:
        pass

