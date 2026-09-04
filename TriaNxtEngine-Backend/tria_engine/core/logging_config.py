# tria_engine/core/logging_config.py
#
# Replicates the LOGGING dict from the old tria_engine/settings.py (same
# log files, same formats, same PII redaction filter). Framework loggers
# ("django", "django.request", "django.security") are replaced by their
# uvicorn equivalents where a mapping makes sense; the app logger keeps the
# name "tria_engine" so existing logger.getLogger("tria_engine") call sites
# (e.g. health checks) keep working unchanged.

from __future__ import annotations

import logging
import logging.config

from ..logging_filters import PIIRedactionFilter
from .config import BASE_DIR, settings

LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "pii_redaction": {
            "()": PIIRedactionFilter,
        },
    },
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "level": settings.LOG_LEVEL,
            "class": "logging.StreamHandler",
            "formatter": "simple",
            "filters": ["pii_redaction"],
        },
        "file": {
            "level": settings.LOG_LEVEL,
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(LOG_DIR / "trianxt.log"),
            "maxBytes": 10 * 1024 * 1024,
            "backupCount": 5,
            "formatter": "verbose",
            "filters": ["pii_redaction"],
        },
        "error_file": {
            "level": "ERROR",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(LOG_DIR / "trianxt_errors.log"),
            "maxBytes": 10 * 1024 * 1024,
            "backupCount": 5,
            "formatter": "verbose",
            "filters": ["pii_redaction"],
        },
        "security_file": {
            "level": "WARNING",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(LOG_DIR / "trianxt_security.log"),
            "maxBytes": 10 * 1024 * 1024,
            "backupCount": 5,
            "formatter": "verbose",
            "filters": ["pii_redaction"],
        },
    },
    "loggers": {
        "tria_engine": {
            "handlers": ["console", "file", "error_file"],
            "level": settings.LOG_LEVEL,
            "propagate": False,
        },
        "uvicorn": {
            "handlers": ["console", "file"],
            "level": settings.LOG_LEVEL,
            "propagate": False,
        },
        "uvicorn.error": {
            "handlers": ["console", "error_file"],
            "level": "WARNING",
            "propagate": False,
        },
        "sqlalchemy.engine": {
            "handlers": ["console", "file"],
            "level": "WARNING",
            "propagate": False,
        },
    },
    "root": {
        "handlers": ["console", "file"],
        "level": settings.LOG_LEVEL,
    },
}


def configure_logging() -> None:
    logging.config.dictConfig(LOGGING)
