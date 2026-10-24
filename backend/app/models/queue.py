"""
Issuance Queue Model (FR-2.5)
Dedicated table for offline queue telemetry, retries, and errors.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String, Text, DateTime, Integer, ForeignKey, CheckConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class IssuanceQueueItem(Base):
    """
    Dedicated queue table rather than a dynamic view over documents:
    Isolates transient retry counters, backoff timestamps, and error diagnostics from the
    immutable document audit records, preventing table and index bloat during offline batch syncs.
    """
    __tablename__ = "issuance_queue"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="RESTRICT"),
        unique=True,
        nullable=False,
        index=True
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    attempts: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0
    )
    last_error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )
    state: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="pending"
    )

    # Relationship
    document = relationship("Document", back_populates="queue_item")

    __table_args__ = (
        CheckConstraint("state IN ('pending', 'sent', 'failed')", name="ck_issuance_queue_state"),
    )
