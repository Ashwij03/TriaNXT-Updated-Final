# tria_engine/apps/accounts/audit.py
#
# Ported unchanged from the Django app (same payload shape, same logger
# name). The "audit" logger propagates to the root logger, which writes to
# logs/trianxt.log with PII redaction — exactly where it landed before.

import logging

audit_logger = logging.getLogger("audit")


def log_audit_event(event, user=None, patient=None, request=None, status="success", details=None):
    """request is an optional adapter exposing .META-like attributes; the
    FastAPI routers pass a small request-proxy object (see accounts/router.py
    helpers) so the payload shape stays identical to the Django version."""
    try:
        payload = {
            "event": event,
            "status": status,
            "user_id": getattr(user, "id", None),
            "user_email": getattr(user, "email", None),
            "patient_id": getattr(patient, "id", None),
            "patient_code": getattr(patient, "patient_id", None),
            "ip": getattr(request, "META", {}).get("REMOTE_ADDR") if request else None,
            "path": getattr(request, "path", None) if request else None,
            "method": getattr(request, "method", None) if request else None,
            "details": details or {},
        }
        audit_logger.info(payload)
    except Exception as e:
        audit_logger.error(f"Audit logging failed: {str(e)}")
