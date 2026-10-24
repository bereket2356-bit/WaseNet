"""
Verifier-Facing Public API Endpoints (FR-1.2, FR-4.1, FR-4.2, FR-5.1, FR-5.2)
Zero-authentication public endpoints for PWA verifiers:
Key bundles, DRL delta synchronizations, and idempotent audit batch uploads.
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models.public_key import PublicKey, KeyBundleState
from app.models.revocation import Revocation, DrlState
from app.models.audit import AuditEvent
from app.schemas.key import KeyBundleResponse, KeyResponse
from app.schemas.revocation import RevocationListResponse, RevocationItem
from app.schemas.audit import AuditBatchRequest, AuditBatchResponse
from app.security.rate_limiter import rate_limiter
from app.logging_config import logger

router = APIRouter(tags=["Verifier Public"])


@router.get("/keys/bundle", response_model=KeyBundleResponse)
def get_key_bundle(db: Session = Depends(get_db)):
    """
    Exposes the latest public key bundle for the offline verifier PWA (FR-4.1).
    Serves Active and Expired public keys only. Revoked keys and private material are strictly excluded.
    """
    state = db.query(KeyBundleState).filter(KeyBundleState.id == 1).first()
    bundle_version = state.version if state else 1

    keys = (
        db.query(PublicKey)
        .filter(PublicKey.status.in_(["active", "expired"]))
        .order_by(PublicKey.created_at.asc())
        .all()
    )

    return KeyBundleResponse(
        version=bundle_version,
        keys=[KeyResponse.model_validate(k) for k in keys],
        server_time=datetime.now(timezone.utc).isoformat()
    )


@router.get("/revocations", response_model=RevocationListResponse)
def get_revocations_delta(
    since: int = Query(0, ge=0, description="Last known DRL version by client"),
    db: Session = Depends(get_db)
):
    """
    Serves Document Revocation List (DRL) delta updates since a given version (FR-4.2).
    Allows offline verifiers to synchronize only newly revoked records.
    """
    state = db.query(DrlState).filter(DrlState.id == 1).first()
    current_version = state.version if state else 0

    revocations_query = (
        db.query(Revocation)
        .filter(Revocation.revocation_version > since)
        .order_by(Revocation.revocation_version.asc())
    )
    delta_items = revocations_query.all()
    total_count = db.query(Revocation).count()

    return RevocationListResponse(
        version=current_version,
        delta=[RevocationItem.model_validate(r) for r in delta_items],
        total_count=total_count,
        server_time=datetime.now(timezone.utc).isoformat()
    )


@router.post("/audit/batch", response_model=AuditBatchResponse)
def upload_audit_batch(
    req: AuditBatchRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Accepts batches of verification events from verifier apps (FR-5.1, FR-5.2).
    Enforces idempotency using (client_event_id, device_id) deduplication key.
    Retries will never create duplicate audit entries.
    Rate limited per device_id.
    """
    if not req.events:
        return AuditBatchResponse(accepted=0, duplicate=0, rejected=0)

    # Rate limiting on device basis (using the first device in batch or client IP)
    first_device = req.events[0].device_id
    rate_limiter.check_rate_limit(
        f"audit_batch_device_{first_device}",
        max_requests=settings.RATE_LIMIT_AUDIT_BATCH_PER_MINUTE,
        message="Too many audit uploads from this device. Please queue."
    )

    accepted_count = 0
    duplicate_count = 0
    rejected_count = 0
    now = datetime.now(timezone.utc)

    for item in req.events:
        try:
            # Check for existing event with same (client_event_id, device_id)
            existing = (
                db.query(AuditEvent)
                .filter(
                    AuditEvent.client_event_id == item.client_event_id,
                    AuditEvent.device_id == item.device_id
                )
                .first()
            )
            if existing:
                duplicate_count += 1
                continue

            event = AuditEvent(
                client_event_id=item.client_event_id,
                device_id=item.device_id,
                document_id=item.document_id,
                verified_at=item.verified_at,
                received_at=now,
                result=item.result,
                uploaded_by=item.device_id
            )
            db.add(event)
            accepted_count += 1
        except Exception as e:
            logger.warning(f"Rejected audit log entry: {e}")
            rejected_count += 1

    db.commit()

    logger.info(
        f"Audit batch processed: accepted={accepted_count}, duplicate={duplicate_count}, rejected={rejected_count}"
    )

    return AuditBatchResponse(
        accepted=accepted_count,
        duplicate=duplicate_count,
        rejected=rejected_count
    )
