"""
Public Keys and Key Bundle State Models (FR-4.1, FR-4.3)
Manages verification keys (ES256) and key bundle version increments.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict
from sqlalchemy import String, DateTime, ForeignKey, CheckConstraint, Integer, BigInteger, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class PublicKey(Base):
    __tablename__ = "public_keys"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    kid: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True
    )
    algorithm: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="ES256"
    )
    public_key_jwk: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="active"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    status_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    status_changed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    __table_args__ = (
        CheckConstraint("algorithm = 'ES256'", name="ck_public_keys_algorithm"),
        CheckConstraint("status IN ('active', 'expired', 'revoked')", name="ck_public_keys_status"),
    )


class KeyBundleState(Base):
    """Singleton table holding the current key bundle version counter."""
    __tablename__ = "key_bundle_state"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        default=1
    )
    version: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=1
    )
    last_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    __table_args__ = (
        CheckConstraint("id = 1", name="ck_key_bundle_state_singleton"),
    )
