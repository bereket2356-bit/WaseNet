"""
Data Retention and Privacy Purge Service (SRS Section 4.1)
Enforces configurable retention limits (default 365 days) by purging stale audit events
and permanently removing closed fraud report personal data.
"""
from datetime import datetime, timedelta, timezone
from typing import Dict
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.config import settings
from app.logging_config import logger
from app.models.audit import AuditEvent
from app.models.fraud_report import FraudReport


def purge_expired_records(db: Session) -> Dict[str, int]:
    """
    Executes retention purge:
    1. Removes audit verification events older than settings.RETENTION_DAYS_AUDIT.
    2. Removes closed fraud reports older than settings.RETENTION_DAYS_FRAUD.
    """
    now = datetime.now(timezone.utc)
    audit_cutoff = now - timedelta(days=settings.RETENTION_DAYS_AUDIT)
    fraud_cutoff = now - timedelta(days=settings.RETENTION_DAYS_FRAUD)

    logger.info(
        f"Starting data retention cleanup: audit_cutoff={audit_cutoff.isoformat()}, "
        f"fraud_cutoff={fraud_cutoff.isoformat()}"
    )

    # 1. Purge stale audit events
    audit_stmt = delete(AuditEvent).where(AuditEvent.verified_at < audit_cutoff)
    audit_result = db.execute(audit_stmt)
    audit_deleted = audit_result.rowcount

    # 2. Purge closed fraud reports past retention threshold
    fraud_stmt = delete(FraudReport).where(
        FraudReport.status == "closed",
        FraudReport.updated_at < fraud_cutoff
    )
    fraud_result = db.execute(fraud_stmt)
    fraud_deleted = fraud_result.rowcount

    db.commit()

    logger.info(
        f"Data retention purge completed: {audit_deleted} audit events removed, "
        f"{fraud_deleted} closed fraud reports removed."
    )

    return {
        "audit_events_deleted": audit_deleted,
        "closed_fraud_reports_deleted": fraud_deleted
    }
