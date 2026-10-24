"""
Data Retention Purge Runner (Deliverable 7)
Can be scheduled via cron (e.g. daily at midnight: 0 0 * * *) or executed as a background worker.
"""
import os
import sys

# Ensure backend root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.services.retention_service import purge_expired_records
from app.logging_config import logger


def main():
    logger.info("Executing scheduled data retention purge job...")
    db = SessionLocal()
    try:
        results = purge_expired_records(db)
        print(f"[SUCCESS] Purged: {results['audit_events_deleted']} audit events, {results['closed_fraud_reports_deleted']} closed fraud reports.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
