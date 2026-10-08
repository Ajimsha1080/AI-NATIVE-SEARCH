import multiprocessing
import os

# Gunicorn Enterprise Production Configuration
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
workers = min(multiprocessing.cpu_count() * 2 + 1, 8)
worker_class = "uvicorn.workers.UvicornWorker"
timeout = 60
keepalive = 5
max_requests = 2000
max_requests_jitter = 200

# Access and Error Logging
loglevel = "info"
accesslog = "-"
errorlog = "-"

# Graceful worker restart
graceful_timeout = 30
preload_app = False
