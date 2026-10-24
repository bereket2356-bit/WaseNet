"""
Audit Events Model (FR-5.1, FR-5.2)
Stores verifier device event logs with composite unique constraint for idempotent uploads.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String, DateTime, CheckConstraint, UniqueConstraint, Index
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    client_event_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False
    )
    device_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False
    )
    document_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True
    )
    verified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    result: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        index=True
    )
    uploaded_by: Mapped[str] = mapped_column(
        String(64),
        nullable=False
    )

    __table_args__ = (
        UniqueConstraint("client_event_id", "device_id", name="uq_audit_client_device"),
        CheckConstraint(
            "result IN ('valid', 'tampered', 'revoked', 'expired', 'unreadable')",
            name="ck_audit_events_result"
        ),
        Index("ix_audit_events_result_verified", "result", "verified_at"),
    )
