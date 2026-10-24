"""
Fraud Report Model (FR-R1, SRS Scope 8)
Public fraud reporting with encrypted contact information and lifecycle management.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String, Text, DateTime, CheckConstraint
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class FraudReport(Base):
    __tablename__ = "fraud_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    # Reference in format FR-XXXXXXXX (8 uppercase alphanumeric characters)
    reference: Mapped[str] = mapped_column(
        String(32),
        unique=True,
        nullable=False,
        index=True
    )
    document_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True
    )
    reason_code: Mapped[str] = mapped_column(
        String(64),
        nullable=False
    )
    description: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )
    # Optional contact details encrypted with AES-256-GCM
    contact_details: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="new"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "reason_code IN ('signature_failed', 'details_mismatch', 'reported_lost', 'looks_forged', 'other')",
            name="ck_fraud_reports_reason_code"
        ),
        CheckConstraint(
            "status IN ('new', 'reviewing', 'closed')",
            name="ck_fraud_reports_status"
        ),
    )
