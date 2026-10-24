"""
Public Fraud Reporting API Endpoint (FR-R1, Scope 8)
Anonymous or contact-provided fraud reporting from public website with reference generation,
AES-256-GCM contact encryption, IP rate limiting, and INSA notification hook.
"""
import secrets
import string
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models.fraud_report import FraudReport
from app.schemas.fraud_report import FraudReportCreate, FraudReportCreateResponse
from app.security.encryption import encrypt_field
from app.security.rate_limiter import rate_limiter
from app.services.insa_connector import get_insa_connector
from app.logging_config import logger

router = APIRouter(tags=["Fraud Reporting"])


def _generate_reference() -> str:
    """Generates unique reference formatted as FR-XXXXXXXX (8 uppercase alphanumeric)."""
    alphabet = string.ascii_uppercase + string.digits
    suffix = ''.join(secrets.choice(alphabet) for _ in range(8))
    return f"FR-{suffix}"


@router.post(
    "/fraud-reports",
    response_model=FraudReportCreateResponse,
    status_code=status.HTTP_201_CREATED
)
def submit_fraud_report(
    req: FraudReportCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Submits a document fraud report from the public website (FR-R1).
    - Rate limited per IP address.
    - Encrypts optional contact details at the application layer with AES-256-GCM.
    - Generates unique tracking reference (FR-XXXXXXXX).
    - Dispatches to INSA connector interface (stubbed in prototype).
    """
    client_ip = request.client.host if request.client else "unknown"

    # Rate limiting per IP
    rate_limiter.check_rate_limit(
        f"fraud_ip_{client_ip}",
        max_requests=settings.RATE_LIMIT_FRAUD_PER_MINUTE,
        message="Too many fraud reports submitted from this IP. Please wait before submitting again."
    )

    reference = _generate_reference()
    while db.query(FraudReport).filter(FraudReport.reference == reference).first():
        reference = _generate_reference()

    encrypted_contact = encrypt_field(req.contact_details) if req.contact_details else None
    now = datetime.now(timezone.utc)

    report = FraudReport(
        reference=reference,
        document_id=req.document_id,
        reason_code=req.reason_code,
        description=req.description,
        contact_details=encrypted_contact,
        status="new",
        created_at=now,
        updated_at=now
    )

    db.add(report)
    db.commit()

    # Dispatch to INSA integration point
    insa = get_insa_connector()
    insa.forward_fraud_report(
        reference=reference,
        document_id=req.document_id,
        reason_code=req.reason_code,
        description=req.description,
        created_at=now
    )

    logger.info(f"Fraud report registered: ref={reference}, doc_id={req.document_id}, reason={req.reason_code}")

    return FraudReportCreateResponse(
        reference=reference,
        message="Fraud report submitted successfully",
        created_at=now
    )
