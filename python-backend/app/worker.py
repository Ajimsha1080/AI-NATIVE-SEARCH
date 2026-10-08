import asyncio
import logging
from collections.abc import Callable

logger = logging.getLogger("shopmate_worker")
logging.basicConfig(level=logging.INFO)

# Background Job Queue (Async in-process worker with Redis / Celery pluggability)
class BackgroundTaskWorker:
    def __init__(self):
        self._queue: asyncio.Queue = asyncio.Queue()
        self._is_running = False
        self._worker_task: asyncio.Task = None

    async def start(self):
        if not self._is_running:
            self._is_running = True
            self._worker_task = asyncio.create_task(self._process_queue())
            logger.info("Background task worker started.")

    async def stop(self):
        self._is_running = False
        if self._worker_task:
            self._worker_task.cancel()

    async def enqueue(self, task_name: str, fn: Callable, *args, **kwargs):
        await self._queue.put((task_name, fn, args, kwargs))
        logger.info(f"Enqueued background task: {task_name}")

    async def _process_queue(self):
        while self._is_running:
            try:
                task_name, fn, args, kwargs = await self._queue.get()
                logger.info(f"Executing task: {task_name}")
                try:
                    if asyncio.iscoroutinefunction(fn):
                        await fn(*args, **kwargs)
                    else:
                        fn(*args, **kwargs)
                    logger.info(f"Task completed successfully: {task_name}")
                except Exception as e:
                    logger.error(f"Task failed: {task_name} with error: {e}")
                finally:
                    self._queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Worker queue error: {e}")

# Singleton background worker instance
task_worker = BackgroundTaskWorker()
