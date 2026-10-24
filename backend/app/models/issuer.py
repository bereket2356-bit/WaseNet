"""
Issuer Model (FR-1.1, Scope 7)
Authorized public offices issuing digital credentials.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Issuer(Base):
    __tablename__ = "issuers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(
        String(128),
        nullable=False
    )
    issuer_code: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True
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

    # Relationships
    users = relationship("User", back_populates="issuer")
    documents = relationship("Document", back_populates="issuer")

    __table_args__ = (
        CheckConstraint("status IN ('active', 'disabled')", name="ck_issuers_status"),
    )
