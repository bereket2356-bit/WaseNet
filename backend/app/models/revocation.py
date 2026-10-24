"""
Revocation and DRL State Models (FR-4.2, FR-4.4)
Tracks document revocation events and monotonic global revocation version counter.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String, DateTime, ForeignKey, CheckConstraint, Integer, BigInteger
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Revocation(Base):
    __tablename__ = "revocations"

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
    reason_code: Mapped[str] = mapped_column(
        String(64),
        nullable=False
    )
    revoked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    revoked_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    revocation_version: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        index=True
    )

    # Relationship
    document = relationship("Document", back_populates="revocation")

    __table_args__ = (
        CheckConstraint(
            "reason_code IN ('issued_in_error', 'reported_lost', 'reported_forged', 'holder_request')",
            name="ck_revocations_reason_code"
        ),
    )


class DrlState(Base):
    """
    Singleton table holding the global Document Revocation List (DRL) version counter.
    Updated inside the exact same database transaction as revocation inserts.
    """
    __tablename__ = "drl_state"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        default=1
    )
    version: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0
    )
    last_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    __table_args__ = (
        CheckConstraint("id = 1", name="ck_drl_state_singleton"),
    )
