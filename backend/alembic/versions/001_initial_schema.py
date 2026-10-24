"""Initial schema and singleton seeds

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-10-24 12:00:00.000000

"""
from typing import Sequence, Union
from datetime import datetime, timezone
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. issuers table
    op.create_table(
        "issuers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("issuer_code", sa.String(64), nullable=False, unique=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('active', 'disabled')", name="ck_issuers_status")
    )
    op.create_index("ix_issuers_code", "issuers", ["issuer_code"])

    # 2. users table
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(128), nullable=False),
        sa.Column("organization", sa.String(255), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("issuer_id", sa.Uuid(), sa.ForeignKey("issuers.id", ondelete="SET NULL"), nullable=True),
        sa.CheckConstraint("role IN ('issuer', 'administrator')", name="ck_users_role"),
        sa.CheckConstraint("status IN ('pending', 'active', 'disabled')", name="ck_users_status")
    )
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_users_issuer_id", "users", ["issuer_id"])

    # 3. public_keys table
    op.create_table(
        "public_keys",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("kid", sa.String(64), nullable=False, unique=True),
        sa.Column("algorithm", sa.String(16), nullable=False, server_default="ES256"),
        sa.Column("public_key_jwk", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status_changed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status_changed_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.CheckConstraint("algorithm = 'ES256'", name="ck_public_keys_algorithm"),
        sa.CheckConstraint("status IN ('active', 'expired', 'revoked')", name="ck_public_keys_status")
    )
    op.create_index("ix_public_keys_kid", "public_keys", ["kid"])
    op.create_index("ix_public_keys_status_changed_by", "public_keys", ["status_changed_by"])

    # 4. key_bundle_state table (singleton)
    op.create_table(
        "key_bundle_state",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("version", sa.BigInteger(), nullable=False, server_default="1"),
        sa.Column("last_updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_key_bundle_state_singleton")
    )

    # 5. documents table
    op.create_table(
        "documents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("doc_type", sa.String(64), nullable=False),
        sa.Column("issuer_id", sa.Uuid(), sa.ForeignKey("issuers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("kid", sa.String(64), nullable=False),
        sa.Column("issue_date", sa.Date(), nullable=False),
        sa.Column("expiry_date", sa.Date(), nullable=False),
        sa.Column("payload_canonical", sa.Text(), nullable=False),
        sa.Column("jws", sa.Text(), nullable=False),
        sa.Column("payload_sha256", sa.String(64), nullable=False),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sync_state", sa.String(32), nullable=False, server_default="synced"),
        sa.CheckConstraint(
            "doc_type IN ('land_certificate', 'cooperative_credential', 'birth_record', 'local_permit')",
            name="ck_documents_doc_type"
        ),
        sa.CheckConstraint("expiry_date > issue_date", name="ck_documents_expiry_after_issue"),
        sa.CheckConstraint("sync_state IN ('synced', 'queued', 'failed')", name="ck_documents_sync_state")
    )
    op.create_index("ix_documents_doc_type", "documents", ["doc_type"])
    op.create_index("ix_documents_issuer_id", "documents", ["issuer_id"])
    op.create_index("ix_documents_created_by", "documents", ["created_by"])
    op.create_index("ix_documents_issuer_date", "documents", ["issuer_id", "issue_date"])

    # 6. holder_details table
    op.create_table(
        "holder_details",
        sa.Column("document_id", sa.Uuid(), sa.ForeignKey("documents.id", ondelete="RESTRICT"), primary_key=True),
        sa.Column("holder_name", sa.String(255), nullable=False),
        sa.Column("holder_national_id", sa.Text(), nullable=False)
    )

    # 7. issuance_queue table
    op.create_table(
        "issuance_queue",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("document_id", sa.Uuid(), sa.ForeignKey("documents.id", ondelete="RESTRICT"), unique=True, nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("state", sa.String(32), nullable=False, server_default="pending"),
        sa.CheckConstraint("state IN ('pending', 'sent', 'failed')", name="ck_issuance_queue_state")
    )
    op.create_index("ix_issuance_queue_document_id", "issuance_queue", ["document_id"])

    # 8. revocations table
    op.create_table(
        "revocations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("document_id", sa.Uuid(), sa.ForeignKey("documents.id", ondelete="RESTRICT"), unique=True, nullable=False),
        sa.Column("reason_code", sa.String(64), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("revocation_version", sa.BigInteger(), nullable=False),
        sa.CheckConstraint(
            "reason_code IN ('issued_in_error', 'reported_lost', 'reported_forged', 'holder_request')",
            name="ck_revocations_reason_code"
        )
    )
    op.create_index("ix_revocations_document_id", "revocations", ["document_id"])
    op.create_index("ix_revocations_revoked_by", "revocations", ["revoked_by"])
    op.create_index("ix_revocations_version", "revocations", ["revocation_version"])

    # 9. drl_state table (singleton)
    op.create_table(
        "drl_state",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("version", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("last_updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_drl_state_singleton")
    )

    # 10. audit_events table
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("client_event_id", sa.String(64), nullable=False),
        sa.Column("device_id", sa.String(64), nullable=False),
        sa.Column("document_id", sa.String(64), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("result", sa.String(32), nullable=False),
        sa.Column("uploaded_by", sa.String(64), nullable=False),
        sa.UniqueConstraint("client_event_id", "device_id", name="uq_audit_client_device"),
        sa.CheckConstraint(
            "result IN ('valid', 'tampered', 'revoked', 'expired', 'unreadable')",
            name="ck_audit_events_result"
        )
    )
    op.create_index("ix_audit_events_verified_at", "audit_events", ["verified_at"])
    op.create_index("ix_audit_events_result", "audit_events", ["result"])
    op.create_index("ix_audit_events_result_verified", "audit_events", ["result", "verified_at"])
    op.create_index("ix_audit_events_document_id", "audit_events", ["document_id"])

    # 11. fraud_reports table
    op.create_table(
        "fraud_reports",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("reference", sa.String(32), nullable=False, unique=True),
        sa.Column("document_id", sa.String(64), nullable=False),
        sa.Column("reason_code", sa.String(64), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("contact_details", sa.Text(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="new"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "reason_code IN ('signature_failed', 'details_mismatch', 'reported_lost', 'looks_forged', 'other')",
            name="ck_fraud_reports_reason_code"
        ),
        sa.CheckConstraint(
            "status IN ('new', 'reviewing', 'closed')",
            name="ck_fraud_reports_status"
        )
    )
    op.create_index("ix_fraud_reports_ref", "fraud_reports", ["reference"])
    op.create_index("ix_fraud_reports_doc", "fraud_reports", ["document_id"])

    # Mandatory seeds: exactly one drl_state row and one key_bundle_state row
    now = datetime.now(timezone.utc)
    op.execute(
        sa.text(
            f"INSERT INTO drl_state (id, version, last_updated_at) "
            f"VALUES (1, 0, '{now.isoformat()}')"
        )
    )
    op.execute(
        sa.text(
            f"INSERT INTO key_bundle_state (id, version, last_updated_at) "
            f"VALUES (1, 1, '{now.isoformat()}')"
        )
    )


def downgrade() -> None:
    op.drop_table("fraud_reports")
    op.drop_table("audit_events")
    op.drop_table("drl_state")
    op.drop_table("revocations")
    op.drop_table("issuance_queue")
    op.drop_table("holder_details")
    op.drop_table("documents")
    op.drop_table("key_bundle_state")
    op.drop_table("public_keys")
    op.drop_table("users")
    op.drop_table("issuers")
