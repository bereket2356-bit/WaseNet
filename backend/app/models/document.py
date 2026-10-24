"""
Document and Holder Details Models (FR-2.1 to FR-2.4, SRS Section 4.1)
Signed document credentials and separate encrypted holder personal data.
"""
import uuid
from datetime import datetime, date, timezone
from sqlalchemy import (
    String, Text, DateTime, Date, ForeignKey, CheckConstraint, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Document(Base):
    __tablename__ = "documents"

    # UUID primary key represents the canonical Document ID (FR-2.1)
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    doc_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True
    )
    issuer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("issuers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    kid: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True
    )
    issue_date: Mapped[date] = mapped_column(
        Date,
        nullable=False
    )
    expiry_date: Mapped[date] = mapped_column(
        Date,
        nullable=False
    )
    payload_canonical: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    jws: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    payload_sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    sync_state: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="synced"
    )

    # Relationships
    issuer = relationship("Issuer", back_populates="documents")
    holder = relationship("HolderDetails", uselist=False, back_populates="document", cascade="all, delete-orphan")
    revocation = relationship("Revocation", uselist=False, back_populates="document")
    queue_item = relationship("IssuanceQueueItem", uselist=False, back_populates="document")

    __table_args__ = (
        CheckConstraint(
            "doc_type IN ('land_certificate', 'cooperative_credential', 'birth_record', 'local_permit')",
            name="ck_documents_doc_type"
        ),
        CheckConstraint("expiry_date > issue_date", name="ck_documents_expiry_after_issue"),
        CheckConstraint("sync_state IN ('synced', 'queued', 'failed')", name="ck_documents_sync_state"),
        Index("ix_documents_issuer_date", "issuer_id", "issue_date"),
    )


class HolderDetails(Base):
    """
    Data minimization table (SRS Section 4.1).
    Stores personal identifiers separately with application-level AES-256-GCM encryption.
    """
    __tablename__ = "holder_details"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="RESTRICT"),
        primary_key=True
    )
    holder_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    # Encrypted with AES-256-GCM (v1:nonce:tag:ciphertext)
    holder_national_id: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    # Relationship
    document = relationship("Document", back_populates="holder")
