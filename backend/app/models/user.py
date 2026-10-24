"""
User Model (FR-1.1, FR-1.3)
Accounts, roles (issuer, administrator), status (pending, active, disabled), and issuer linking.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, CheckConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True
    )
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    full_name: Mapped[str] = mapped_column(
        String(128),
        nullable=False
    )
    organization: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    role: Mapped[str] = mapped_column(
        String(32),
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="pending"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    issuer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("issuers.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Relationships
    issuer = relationship("Issuer", back_populates="users")

    __table_args__ = (
        CheckConstraint("role IN ('issuer', 'administrator')", name="ck_users_role"),
        CheckConstraint("status IN ('pending', 'active', 'disabled')", name="ck_users_status"),
        Index("ix_users_username_lower", func.lower(username), unique=True),
    )
