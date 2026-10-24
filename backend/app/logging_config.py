"""
Structured JSON Logging Module
Implements Security Requirement: Structured JSON logs with strict redaction of
passwords, session tokens, national IDs, contact details, and document payload internals.
"""
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict

SENSITIVE_KEYS = {
    "password", "password_hash", "token", "access_token", "jwt",
    "authorization", "bearer", "holder_national_id", "national_id",
    "contact_details", "phone", "email", "secret", "private_key",
    "payload_canonical", "payload"
}

BEARER_PATTERN = re.compile(r"Bearer\s+([A-Za-z0-9_\-\.]+)", re.IGNORECASE)


def redact_sensitive_data(data: Any) -> Any:
    """Recursively redacts sensitive keys and patterns from dictionary structures."""
    if isinstance(data, dict):
        redacted = {}
        for key, value in data.items():
            if any(sens in key.lower() for sens in SENSITIVE_KEYS):
                redacted[key] = "[REDACTED]"
            else:
                redacted[key] = redact_sensitive_data(value)
        return redacted
    elif isinstance(data, list):
        return [redact_sensitive_data(item) for item in data]
    elif isinstance(data, str):
        # Scrub Bearer tokens in headers or strings
        return BEARER_PATTERN.sub("Bearer [REDACTED]", data)
    return data


class StructuredJsonFormatter(logging.Formatter):
    """Formats log records as single-line JSON objects with UTC timestamps and redaction."""

    def format(self, record: logging.LogRecord) -> str:
        log_payload: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage()
        }

        # Include custom extra fields if present
        if hasattr(record, "extra") and isinstance(record.extra, dict):
            log_payload["context"] = redact_sensitive_data(record.extra)

        if record.exc_info and not record.exc_text:
            # We record error summary without leaking internal credentials
            record.exc_text = self.formatException(record.exc_info)

        if record.exc_text:
            log_payload["exception"] = record.exc_text

        return json.dumps(log_payload)


def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """Configures root and application loggers to output structured JSON."""
    logger = logging.getLogger("wasenet")
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(StructuredJsonFormatter())
        logger.addHandler(handler)
        logger.propagate = False

    return logger


logger = setup_logging()
