"""
Administrator API Endpoints (FR-4.3, FR-4.4, Scope 4, 5, 7, 8)
Role-protected administration of keys, revocations, issuers, user approvals, and fraud investigations.
"""
from datetime import datetime, timezone
from typing import List, Optional
import uuid
import math
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.user import User
from app.models.issuer import Issuer
from app.models.public_key import PublicKey, KeyBundleState
from app.models.document import Document
from app.models.revocation import Revocation, DrlState
from app.models.fraud_report import FraudReport
from app.schemas.key import KeyRegisterRequest, KeyStatusUpdate, KeyResponse
from app.schemas.revocation import RevocationCreateRequest, RevocationCreateResponse
from app.schemas.issuer import IssuerCreate, IssuerUpdate, IssuerResponse
from app.schemas.auth import UserResponse
from app.schemas.fraud_report import (
    FraudReportResponse,
    FraudReportStatusUpdate,
    PaginatedFraudReportsResponse
)
from app.api.deps import require_role
from app.logging_config import logger

router = APIRouter(tags=["Administrator Operations"])

# Enforce administrator role on every route in this router
admin_required = Depends(require_role(["administrator"]))


# ---------------- Key Management (FR-4.3, Scope 4) ---------------- #

@router.get("/keys", response_model=List[KeyResponse], dependencies=[admin_required])
def list_keys(db: Session = Depends(get_db)):
    """Lists all registered public keys with status (Active, Expired, Revoked)."""
    return db.query(PublicKey).order_by(PublicKey.created_at.desc()).all()


@router.post(
    "/keys",
    response_model=KeyResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[admin_required]
)
def register_key(
    req: KeyRegisterRequest,
    current_user: User = Depends(require_role(["administrator"])),
    db: Session = Depends(get_db)
):
    """
    Registers a new public verification certificate (FR-4.3).
    Strictly forbids private key components.
    Increments key bundle version.
    """
    existing = db.query(PublicKey).filter(PublicKey.kid == req.kid).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "KEY_EXISTS", "message": f"Key with kid '{req.kid}' already registered"}}
        )

    now = datetime.now(timezone.utc)
    pub_key = PublicKey(
        kid=req.kid,
        algorithm=req.algorithm,
        public_key_jwk=req.public_key_jwk,
        status=req.status,
        created_at=now,
        status_changed_at=now,
        status_changed_by=current_user.id
    )

    # Increment key_bundle_state version atomically
    bundle_state = db.query(KeyBundleState).filter(KeyBundleState.id == 1).with_for_update().first()
    if bundle_state:
        bundle_state.version += 1
        bundle_state.last_updated_at = now
    else:
        db.add(KeyBundleState(id=1, version=1, last_updated_at=now))

    db.add(pub_key)
    db.commit()
    db.refresh(pub_key)

    logger.info(f"New public key registered: kid={pub_key.kid}, by={current_user.username}")
    return pub_key


@router.patch("/keys/{kid}", response_model=KeyResponse, dependencies=[admin_required])
def update_key_status(
    kid: str,
    req: KeyStatusUpdate,
    current_user: User = Depends(require_role(["administrator"])),
    db: Session = Depends(get_db)
):
    """
    Updates key status (Active, Expired, Revoked) (FR-4.3).
    Increments key bundle state counter atomically.
    """
    pub_key = db.query(PublicKey).filter(PublicKey.kid == kid).first()
    if not pub_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "KEY_NOT_FOUND", "message": f"Key '{kid}' not found"}}
        )

    now = datetime.now(timezone.utc)
    pub_key.status = req.status
    pub_key.status_changed_at = now
    pub_key.status_changed_by = current_user.id

    # Increment bundle version
    bundle_state = db.query(KeyBundleState).filter(KeyBundleState.id == 1).with_for_update().first()
    if bundle_state:
        bundle_state.version += 1
        bundle_state.last_updated_at = now

    db.commit()
    db.refresh(pub_key)

    logger.info(f"Key status updated: kid={kid}, status={req.status}, by={current_user.username}")
    return pub_key


# ---------------- Document Revocation (FR-4.4, Scope 5) ---------------- #

@router.post(
    "/revocations",
    response_model=RevocationCreateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[admin_required]
)
def revoke_document(
    req: RevocationCreateRequest,
    current_user: User = Depends(require_role(["administrator"])),
    db: Session = Depends(get_db)
):
    """
    Revokes a document credential with a standardized reason code (FR-4.4).
    Acquires an exclusive row lock (FOR UPDATE) on drl_state to guarantee monotonic,
    collision-free version counter increments within a single atomic transaction.
    """
    # Verify document exists
    doc = db.query(Document).filter(Document.id == req.document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "DOCUMENT_NOT_FOUND", "message": f"Document {req.document_id} not found"}}
        )

    # Check if document already revoked
    existing_rev = db.query(Revocation).filter(Revocation.document_id == req.document_id).first()
    if existing_rev:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "ALREADY_REVOKED", "message": f"Document {req.document_id} has already been revoked"}}
        )

    now = datetime.now(timezone.utc)

    # Acquire exclusive row lock on drl_state singleton
    drl = db.query(DrlState).filter(DrlState.id == 1).with_for_update().first()
    if not drl:
        drl = DrlState(id=1, version=0, last_updated_at=now)
        db.add(drl)

    new_version = drl.version + 1
    drl.version = new_version
    drl.last_updated_at = now

    revocation = Revocation(
        document_id=req.document_id,
        reason_code=req.reason_code,
        revoked_at=now,
        revoked_by=current_user.id,
        revocation_version=new_version
    )

    db.add(revocation)
    db.commit()
    db.refresh(revocation)

    logger.warning(
        f"Document revoked: doc_id={req.document_id}, reason={req.reason_code}, "
        f"version={new_version}, by={current_user.username}"
    )

    return RevocationCreateResponse(
        success=True,
        document_id=revocation.document_id,
        revocation_version=revocation.revocation_version,
        revoked_at=revocation.revoked_at,
        reason_code=revocation.reason_code
    )


# ---------------- Issuer Management (Scope 7) ---------------- #

@router.get("/issuers", response_model=List[IssuerResponse], dependencies=[admin_required])
def list_issuers(db: Session = Depends(get_db)):
    """Lists all registered public office issuers."""
    return db.query(Issuer).order_by(Issuer.created_at.asc()).all()


@router.post(
    "/issuers",
    response_model=IssuerResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[admin_required]
)
def create_issuer(
    req: IssuerCreate,
    current_user: User = Depends(require_role(["administrator"])),
    db: Session = Depends(get_db)
):
    """Adds a new authorized issuer office."""
    existing = db.query(Issuer).filter(Issuer.issuer_code == req.issuer_code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "ISSUER_EXISTS", "message": f"Issuer code '{req.issuer_code}' already exists"}}
        )

    issuer = Issuer(
        name=req.name,
        issuer_code=req.issuer_code,
        status="active"
    )
    db.add(issuer)
    db.commit()
    db.refresh(issuer)

    logger.info(f"Issuer office created: code={issuer.issuer_code}, name={issuer.name}")
    return issuer


@router.patch("/issuers/{issuer_id}", response_model=IssuerResponse, dependencies=[admin_required])
def update_issuer(
    issuer_id: uuid.UUID,
    req: IssuerUpdate,
    current_user: User = Depends(require_role(["administrator"])),
    db: Session = Depends(get_db)
):
    """Enables or disables an issuer office."""
    issuer = db.query(Issuer).filter(Issuer.id == issuer_id).first()
    if not issuer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "ISSUER_NOT_FOUND", "message": "Issuer not found"}}
        )

    if req.status is not None:
        issuer.status = req.status
    if req.name is not None:
        issuer.name = req.name

    db.commit()
    db.refresh(issuer)

    logger.info(f"Issuer status updated: id={issuer.id}, status={issuer.status}")
    return issuer


# ---------------- User Approval Workflow (FR-1.1, Scope 1) ---------------- #

@router.get("/users/pending", response_model=List[UserResponse], dependencies=[admin_required])
def get_pending_users(db: Session = Depends(get_db)):
    """Lists accounts awaiting administrator approval."""
    return db.query(User).filter(User.status == "pending").order_by(User.created_at.asc()).all()


@router.post("/users/{user_id}/approve", response_model=UserResponse, dependencies=[admin_required])
def approve_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_role(["administrator"])),
    db: Session = Depends(get_db)
):
    """Approves and activates a pending user account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "USER_NOT_FOUND", "message": "User not found"}}
        )

    if user.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "NOT_PENDING", "message": f"User is not in pending status (currently: {user.status})"}}
        )

    user.status = "active"
    db.commit()
    db.refresh(user)

    logger.info(f"User account approved: username={user.username}, approved_by={current_user.username}")
    return user


# ---------------- Fraud Report Management (FR-R1, Scope 8) ---------------- #

@router.get("/fraud-reports", response_model=PaginatedFraudReportsResponse, dependencies=[admin_required])
def list_fraud_reports(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Lists fraud reports for administrative review and investigation."""
    query = db.query(FraudReport)
    if status_filter:
        query = query.filter(FraudReport.status == status_filter)

    total = query.count()
    reports = (
        query.order_by(FraudReport.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedFraudReportsResponse(
        items=[FraudReportResponse.model_validate(r) for r in reports],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 1
    )


@router.patch("/fraud-reports/{report_id}", response_model=FraudReportResponse, dependencies=[admin_required])
def update_fraud_report_status(
    report_id: uuid.UUID,
    req: FraudReportStatusUpdate,
    current_user: User = Depends(require_role(["administrator"])),
    db: Session = Depends(get_db)
):
    """Updates investigation status of a fraud report (new, reviewing, closed)."""
    report = db.query(FraudReport).filter(FraudReport.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "REPORT_NOT_FOUND", "message": "Fraud report not found"}}
        )

    report.status = req.status
    report.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(report)

    logger.info(f"Fraud report status updated: ref={report.reference}, status={req.status}, by={current_user.username}")
    return report
