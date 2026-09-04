"""
Logging filter that redacts known-sensitive field values from log records
before they're emitted (ported unchanged from the Django project's
tria_engine/logging_filters.py — no framework imports).

This is deliberately conservative: it redacts by field/key name pattern
(password=..., "ssn": "...", Authorization: Bearer ..., etc.), not by
trying to detect PII content heuristically, which is unreliable and easy
to bypass. Extend REDACTED_FIELD_NAMES as new sensitive fields are added
to the models/schemas.

Known limitation: quoted values and single unquoted tokens redact
correctly (password=abc123, "ssn": "123-45-6789"). An unquoted
multi-word value (diagnosis=Type 2 Diabetes) only has its first token
redacted, since the pattern stops at whitespace to avoid swallowing the
rest of the log line.
"""
import logging
import re

REDACTED_FIELD_NAMES = [
    "password",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "api_key",
    "authorization",
    "ssn",
    "social_security_number",
    "date_of_birth",
    "dob",
    "diagnosis",
    "phi",
    "credit_card",
    "card_number",
    "cvv",
]

REDACTED = "***REDACTED***"

# Matches key="value", key='value', key=value, "key": "value", key: value
# for any of the field names above, case-insensitive. The optional quote
# right after the field name handles JSON-style keys ("ssn": "...").
_FIELD_PATTERN = re.compile(
    r"(?i)\b(" + "|".join(re.escape(f) for f in REDACTED_FIELD_NAMES) + r")\b"
    r"[\"']?"
    r"(\s*[:=]\s*)"
    r"(\"[^\"]*\"|'[^']*'|[^\s,&}\]]+)"
)

# Matches an Authorization header value specifically, e.g.
# "Authorization: Bearer eyJhbGciOi...". Must run BEFORE _FIELD_PATTERN --
# otherwise _FIELD_PATTERN's generic "authorization: <token>" match
# consumes and redacts the "Bearer" keyword itself, leaving this pattern
# nothing to match against on a second pass.
_AUTH_HEADER_PATTERN = re.compile(r"(?i)(bearer\s+)([A-Za-z0-9\-_.]+)")


def _redact(text: str) -> str:
    text = _AUTH_HEADER_PATTERN.sub(lambda m: f"{m.group(1)}{REDACTED}", text)
    text = _FIELD_PATTERN.sub(lambda m: f"{m.group(1)}{m.group(2)}{REDACTED}", text)
    return text


class PIIRedactionFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            formatted = record.getMessage()
            record.msg = _redact(formatted)
            record.args = ()
        except Exception:
            # never let a redaction bug block logging entirely -- fail
            # open on the filter mechanics, not on the log call itself.
            pass
        return True
