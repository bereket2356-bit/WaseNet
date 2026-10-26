"""
Issuer-Facing API Endpoints (FR-2.1 to FR-2.5, Scope 2, 3, 6)
Document creation with server-side ES256 signing, offline queue synchronization,
and institutional audit event inspection.
"""
from datetime import datetime, date, timezone
from typing import Optional, List
import uuid
import math
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.user import User
from app.models.issuer import Issuer
from app.models.document import Document, HolderDetails
from app.models.queue import IssuanceQueueItem
from app.models.audit import AuditEvent
from app.schemas.document import (
    DocumentCreateRequest,
    DocumentResponse,
    PaginatedDocumentsResponse
)
from app.schemas.queue import (
    QueueSyncRequest,
    QueueSyncResponse,
    QueueItemResult,
    QueueItemResponse
)
from app.schemas.audit import AuditEventResponse, PaginatedAuditResponse
from app.security.canonical import canonicalize_json, compute_sha256_digest
from app.security.signer import signer
from app.security.encryption import encrypt_field, decrypt_field
from app.api.deps import get_current_user, require_role, get_optional_current_user
from app.logging_config import logger

router = APIRouter(tags=["Issuer & Document Operations"])


@router.post(
    "/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED
)
def issue_document(
    req: DocumentCreateRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates and digitally signs a new document credential (FR-2.1 to FR-2.4).
    1. Canonicalizes structured payload (deterministic RFC 8785 JSON).
    2. Computes SHA-256 digest.
    3. Signs payload using ES256 (P-256 / SHA-256) with active key.
    4. Encrypts holder national ID with AES-256-GCM.
    5. Stores records atomically in a single database transaction.
    6. Returns complete record and compact JWS QR payload.
    """
    # Check for idempotency: if document with req.id already exists, return it
    doc_id = req.id if req.id else uuid.uuid4()
    existing_doc = db.query(Document).filter(Document.id == doc_id).first()
    if existing_doc:
        holder = db.query(HolderDetails).filter(HolderDetails.document_id == doc_id).first()
        decrypted_fan = None
        if holder and holder.holder_national_id:
            try:
                decrypted_fan = decrypt_field(holder.holder_national_id)
            except Exception:
                decrypted_fan = holder.holder_national_id
        return DocumentResponse(
            id=existing_doc.id,
            doc_type=existing_doc.doc_type,
            issuer_id=existing_doc.issuer_id,
            issuer_code=existing_doc.issuer.issuer_code if existing_doc.issuer else None,
            kid=existing_doc.kid,
            issue_date=existing_doc.issue_date,
            expiry_date=existing_doc.expiry_date,
            payload_canonical=existing_doc.payload_canonical,
            jws=existing_doc.jws,
            payload_sha256=existing_doc.payload_sha256,
            created_by=existing_doc.created_by,
            created_at=existing_doc.created_at,
            sync_state=existing_doc.sync_state,
            holder_name=holder.holder_name if holder else None,
            holder_national_id=decrypted_fan,
            qr_payload=existing_doc.jws
        )

    # Determine the issuer organization and user
    primary_issuer = db.query(Issuer).filter(Issuer.status == "active").first()
    if not primary_issuer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "NO_ACTIVE_ISSUER", "message": "No active issuer organization exists"}}
        )

    issuer_id = primary_issuer.id
    creator_id = primary_issuer.id
    if current_user:
        creator_id = current_user.id
        if current_user.issuer_id:
            issuer_id = current_user.issuer_id

    issuer_obj = db.query(Issuer).filter(Issuer.id == issuer_id).first()

    # Construct canonical payload for signature
    payload_dict = {
        "doc_id": str(doc_id),
        "doc_type": req.doc_type,
        "issuer_id": str(issuer_id),
        "kid": signer.kid,
        "issue_date": req.issue_date.isoformat(),
        "expiry_date": req.expiry_date.isoformat(),
        "holder_name": req.holder_name,
        "attributes": req.attributes
    }

    canonical_payload = canonicalize_json(payload_dict)
    sha256_digest = compute_sha256_digest(canonical_payload)

    # Sign using encapsulated DocumentSigner
    header = {"alg": "ES256", "kid": signer.kid, "typ": "JWT"}
    jws = signer.sign_document(header, canonical_payload)

    # Store document and encrypted holder details in transaction
    document = Document(
        id=doc_id,
        doc_type=req.doc_type,
        issuer_id=issuer_id,
        kid=signer.kid,
        issue_date=req.issue_date,
        expiry_date=req.expiry_date,
        payload_canonical=canonical_payload,
        jws=jws,
        payload_sha256=sha256_digest,
        created_by=creator_id,
        sync_state="synced"
    )

    encrypted_national_id = encrypt_field(req.holder_national_id)
    holder = HolderDetails(
        document_id=doc_id,
        holder_name=req.holder_name,
        holder_national_id=encrypted_national_id
    )

    db.add(document)
    db.add(holder)
    db.commit()
    db.refresh(document)

    logger.info(f"Document issued: id={document.id}, type={document.doc_type}, issuer={document.issuer_id}")

    return DocumentResponse(
        id=document.id,
        doc_type=document.doc_type,
        issuer_id=document.issuer_id,
        issuer_code=issuer_obj.issuer_code if issuer_obj else None,
        kid=document.kid,
        issue_date=document.issue_date,
        expiry_date=document.expiry_date,
        payload_canonical=document.payload_canonical,
        jws=document.jws,
        payload_sha256=document.payload_sha256,
        created_by=document.created_by,
        created_at=document.created_at,
        sync_state=document.sync_state,
        holder_name=req.holder_name,
        holder_national_id=req.holder_national_id,
        qr_payload=document.jws
    )


@router.get("/documents", response_model=PaginatedDocumentsResponse)
def list_documents(
    mine: bool = Query(True, description="Filter documents to the current user/issuer"),
    doc_type: Optional[str] = Query(None, description="Filter by document type"),
    from_date: Optional[date] = Query(None, description="Filter by issue date from"),
    to_date: Optional[date] = Query(None, description="Filter by issue date to"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role(["issuer", "administrator"])),
    db: Session = Depends(get_db)
):
    """
    Lists credentials with pagination and filtering by type and dates (Scope 2).
    """
    query = db.query(Document)

    if mine and current_user.role == "issuer" and current_user.issuer_id:
        query = query.filter(Document.issuer_id == current_user.issuer_id)

    if doc_type:
        query = query.filter(Document.doc_type == doc_type)

    if from_date:
        query = query.filter(Document.issue_date >= from_date)

    if to_date:
        query = query.filter(Document.issue_date <= to_date)

    total = query.count()
    items = (
        query.order_by(Document.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Collect holder names where present
    results = []
    for doc in items:
        holder = db.query(HolderDetails).filter(HolderDetails.document_id == doc.id).first()
        results.append(
            DocumentResponse(
                id=doc.id,
                doc_type=doc.doc_type,
                issuer_id=doc.issuer_id,
                kid=doc.kid,
                issue_date=doc.issue_date,
                expiry_date=doc.expiry_date,
                payload_canonical=doc.payload_canonical,
                jws=doc.jws,
                payload_sha256=doc.payload_sha256,
                created_by=doc.created_by,
                created_at=doc.created_at,
                sync_state=doc.sync_state,
                holder_name=holder.holder_name if holder else None,
                qr_payload=doc.jws
            )
        )

    return PaginatedDocumentsResponse(
        items=results,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 1
    )


@router.get("/documents/{doc_id}", response_model=DocumentResponse)
def get_document_by_id(
    doc_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """
    Fetches full metadata and QR payload for a single document credential by ID (Scope 2).
    Accessible publicly so verifiers can confirm document authenticity against database record.
    """
    document = db.query(Document).filter(Document.id == doc_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "DOCUMENT_NOT_FOUND", "message": f"Document with ID {doc_id} was not found"}}
        )

    holder = db.query(HolderDetails).filter(HolderDetails.document_id == doc_id).first()
    decrypted_fan = None
    if holder and holder.holder_national_id:
        try:
            decrypted_fan = decrypt_field(holder.holder_national_id)
        except Exception:
            decrypted_fan = holder.holder_national_id

    issuer = db.query(Issuer).filter(Issuer.id == document.issuer_id).first()

    return DocumentResponse(
        id=document.id,
        doc_type=document.doc_type,
        issuer_id=document.issuer_id,
        issuer_code=issuer.issuer_code if issuer else None,
        kid=document.kid,
        issue_date=document.issue_date,
        expiry_date=document.expiry_date,
        payload_canonical=document.payload_canonical,
        jws=document.jws,
        payload_sha256=document.payload_sha256,
        created_by=document.created_by,
        created_at=document.created_at,
        sync_state=document.sync_state,
        holder_name=holder.holder_name if holder else None,
        holder_national_id=decrypted_fan,
        qr_payload=document.jws
    )


@router.post("/queue/sync", response_model=QueueSyncResponse)
def sync_offline_queue(
    req: QueueSyncRequest,
    current_user: User = Depends(require_role(["issuer", "administrator"])),
    db: Session = Depends(get_db)
):
    """
    Synchronizes documents created while offline in batches (FR-2.5).
    Sync is strictly idempotent by Document ID.
    Repeated sync calls for existing document IDs change nothing and report 'already_synced'.
    """
    issuer_id = current_user.issuer_id
    if not issuer_id and current_user.role == "administrator":
        primary = db.query(Issuer).filter(Issuer.status == "active").first()
        if primary:
            issuer_id = primary.id

    synced_count = 0
    duplicate_count = 0
    failed_count = 0
    results: List[QueueItemResult] = []

    for item in req.documents:
        try:
            # Check for existing document
            existing = db.query(Document).filter(Document.id == item.id).first()
            if existing:
                duplicate_count += 1
                results.append(QueueItemResult(document_id=item.id, status="already_synced"))
                continue

            # Validate date constraints
            if item.expiry_date <= item.issue_date:
                failed_count += 1
                results.append(
                    QueueItemResult(
                        document_id=item.id,
                        status="failed",
                        error="expiry_date must be greater than issue_date"
                    )
                )
                continue

            # Insert document
            doc = Document(
                id=item.id,
                doc_type=item.doc_type,
                issuer_id=issuer_id or current_user.id,
                kid=item.kid,
                issue_date=item.issue_date,
                expiry_date=item.expiry_date,
                payload_canonical=item.payload_canonical,
                jws=item.jws,
                payload_sha256=item.payload_sha256,
                created_by=current_user.id,
                sync_state="synced"
            )

            encrypted_national_id = encrypt_field(item.holder_national_id)
            holder = HolderDetails(
                document_id=item.id,
                holder_name=item.holder_name,
                holder_national_id=encrypted_national_id
            )

            # Record in issuance_queue telemetry
            queue_item = IssuanceQueueItem(
                document_id=item.id,
                attempts=1,
                state="sent",
                last_error=None
            )

            db.add(doc)
            db.add(holder)
            db.add(queue_item)
            db.commit()

            synced_count += 1
            results.append(QueueItemResult(document_id=item.id, status="synced"))
        except Exception as e:
            db.rollback()
            failed_count += 1
            logger.warning(f"Failed to sync offline document {item.id}: {e}")
            results.append(QueueItemResult(document_id=item.id, status="failed", error=str(e)))

    return QueueSyncResponse(
        success=True,
        total_received=len(req.documents),
        synced_count=synced_count,
        duplicate_count=duplicate_count,
        failed_count=failed_count,
        results=results
    )


@router.get("/queue", response_model=List[QueueItemResponse])
def get_issuer_queue(
    current_user: User = Depends(require_role(["issuer", "administrator"])),
    db: Session = Depends(get_db)
):
    """
    Returns documents with sync_state 'queued' or 'failed' for this issuer (Scope 3).
    """
    query = (
        db.query(IssuanceQueueItem, Document.doc_type)
        .join(Document, IssuanceQueueItem.document_id == Document.id)
        .filter(IssuanceQueueItem.state.in_(["pending", "failed"]))
    )

    if current_user.role == "issuer" and current_user.issuer_id:
        query = query.filter(Document.issuer_id == current_user.issuer_id)

    items = query.all()
    results = []
    for queue_item, doc_type in items:
        results.append(
            QueueItemResponse(
                id=queue_item.id,
                document_id=queue_item.document_id,
                received_at=queue_item.received_at,
                attempts=queue_item.attempts,
                last_error=queue_item.last_error,
                state=queue_item.state,
                doc_type=doc_type
            )
        )
    return results


@router.get("/audit", response_model=PaginatedAuditResponse)
def get_audit_logs(
    result: Optional[str] = Query(None, description="Filter by verification result"),
    from_time: Optional[datetime] = Query(None, description="Filter by verified_at >= from_time"),
    to_time: Optional[datetime] = Query(None, description="Filter by verified_at <= to_time"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role(["issuer", "administrator"])),
    db: Session = Depends(get_db)
):
    """
    Audit log queries (FR-5.1, Scope 6).
    Choice resolution:
    - Administrators can query all verification events across Ethiopia.
    - Issuers can query verification events specifically referencing documents created by their organization.
    """
    query = db.query(AuditEvent)

    if current_user.role == "issuer":
        if not current_user.issuer_id:
            return PaginatedAuditResponse(items=[], total=0, page=page, page_size=page_size, pages=1)
        
        # Link audit events to documents issued by this user's organization
        issuer_doc_ids_subquery = (
            db.query(Document.id)
            .filter(Document.issuer_id == current_user.issuer_id)
            .subquery()
        )
        # AuditEvent.document_id is stored as text
        query = query.filter(AuditEvent.document_id.in_(
            db.query(func.cast(issuer_doc_ids_subquery.c.id, func.text))
        ))

    if result:
        query = query.filter(AuditEvent.result == result)
    if from_time:
        query = query.filter(AuditEvent.verified_at >= from_time)
    if to_time:
        query = query.filter(AuditEvent.verified_at <= to_time)

    total = query.count()
    events = (
        query.order_by(AuditEvent.verified_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedAuditResponse(
        items=[AuditEventResponse.model_validate(e) for e in events],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 1
    )
