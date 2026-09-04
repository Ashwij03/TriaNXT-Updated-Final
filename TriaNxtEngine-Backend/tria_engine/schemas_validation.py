# tria_engine/schemas_validation.py
#
# Translates FastAPI's RequestValidationError (422 detail list) into the
# DRF "request schema validation failed" envelope the account endpoints
# used, so API-mode callers keep parsing errors the same way:
#
#   {"message": "Request schema validation failed",
#    "request_schema": {}, "errors": {"email": ["This field is required."]}}  -> 400

from __future__ import annotations

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

_DEFAULT_MSG = "Invalid input."


def _field_name(error: dict) -> str:
    loc = error.get("loc") or []
    # loc is ("body", "<field>", ...) or ("query", "<field>", ...)
    for part in reversed(loc):
        if isinstance(part, str) and part not in ("body", "query", "path", "header", "cookie"):
            return part
    return _DEFAULT_MSG


def _message_for(error: dict) -> str:
    error_type = error.get("type") or ""
    ctx = error.get("ctx") or {}
    msg = error.get("msg") or _DEFAULT_MSG

    if error_type == "missing":
        return "This field is required."
    if error_type == "string_too_short":
        return f"Ensure this field has at least {ctx.get('min_length', '')} characters."
    if error_type == "string_too_long":
        return f"Ensure this field has no more than {ctx.get('max_length', '')} characters."
    if error_type == "greater_than_equal":
        return f"Ensure this value is greater than or equal to {ctx.get('ge', '')}."
    if error_type == "less_than_equal":
        return f"Ensure this value is less than or equal to {ctx.get('le', '')}."
    if error_type in ("int_parsing", "int_type", "float_parsing"):
        return "A valid integer is required."
    if error_type == "bool_parsing":
        return "Must be a valid boolean."
    # fall back to pydantic's message, cleaned of "Value error, " prefixes
    if isinstance(msg, str) and msg.startswith("Value error, "):
        return msg[len("Value error, "):]
    return msg


def validation_error_response(exc: RequestValidationError) -> JSONResponse:
    errors: dict[str, list[str]] = {}
    for error in exc.errors():
        field = _field_name(error)
        message = _message_for(error)
        errors.setdefault(field, []).append(message)

    return JSONResponse(
        status_code=400,
        content={
            "message": "Request schema validation failed",
            "request_schema": {},
            "errors": errors,
        },
    )
