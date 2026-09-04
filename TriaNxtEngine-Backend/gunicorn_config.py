# gunicorn_config.py — production Gunicorn config (Uvicorn workers)
#
# Same conventions as the Django-era config: worker count, timeout, bind
# address are environment-driven (GUNICORN_WORKERS / GUNICORN_TIMEOUT /
# GUNICORN_BIND). The app target changed from WSGI to ASGI via Uvicorn
# workers: `gunicorn tria_engine.main:app -k uvicorn.workers.UvicornWorker
# --config gunicorn_config.py`.

import multiprocessing
import os

bind = os.environ.get("GUNICORN_BIND", "0.0.0.0:8000")
workers = int(os.environ.get("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1))
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "120"))
worker_class = "uvicorn.workers.UvicornWorker"
graceful_timeout = int(os.environ.get("GUNICORN_GRACEFUL_TIMEOUT", "30"))
keepalive = int(os.environ.get("GUNICORN_KEEPALIVE", "5"))
accesslog = os.environ.get("GUNICORN_ACCESS_LOG", "-")
errorlog = os.environ.get("GUNICORN_ERROR_LOG", "-")
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "info")
