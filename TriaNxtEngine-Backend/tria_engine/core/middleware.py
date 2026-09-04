# tria_engine/core/middleware.py
#
# ASGI middleware port of tria_engine/middleware.py
# (DatabaseRetryMiddleware). Original behaviour: before handling each
# request, ensure the default DB connection is alive, retrying up to 3
# times with backoff. Only the connection health-check is retried — never
# the request body — so a transient DB blip cannot double-apply a
# non-idempotent write. If the DB is still unreachable after the retries
# the request fails fast.

from __future__ import annotations

import logging
import time

from sqlalchemy import text
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from .database import engine

logger = logging.getLogger("tria_engine")


class DatabaseRetryMiddleware:
    def __init__(self, app, max_retries: int = 3):
        self.app = app
        self.max_retries = max_retries

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        try:
            self._ensure_connection()
        except SQLAlchemyError:
            response_started = False
            try:
                await send(
                    {
                        "type": "http.response.start",
                        "status": 503,
                        "headers": [
                            (b"content-type", b"application/json"),
                        ],
                    }
                )
                response_started = True
            except Exception:
                pass
            if not response_started:
                await self.app(scope, receive, send)
                return
            body = b'{"detail": "Service temporarily unavailable"}'
            await send(
                {
                    "type": "http.response.body",
                    "body": body,
                }
            )
            return

        await self.app(scope, receive, send)

    def _ensure_connection(self):
        for attempt in range(self.max_retries):
            try:
                with engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                return
            except OperationalError as exc:
                logger.warning("DB connection check failed (attempt %s): %s", attempt + 1, exc)
                if attempt == self.max_retries - 1:
                    logger.error("Database unreachable after retries")
                    raise
                time.sleep(0.5 * (attempt + 1))
