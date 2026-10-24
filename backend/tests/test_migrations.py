"""
Migration Tests: Alembic Schema Lifecycle
Verifies that database migrations apply cleanly on an empty database,
seed mandatory singleton rows (drl_state, key_bundle_state), and roll back cleanly to base.
"""
import os
import tempfile
from alembic.config import Config
from alembic import command
import sqlalchemy as sa


def test_alembic_upgrade_and_downgrade():
    """
    Applies initial migration on an empty isolated database,
    verifies tables and seeds, and then rolls back to base.
    """
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    alembic_ini_path = os.path.join(backend_dir, "alembic.ini")

    # Use a temporary SQLite database for clean migration testing
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_db:
        tmp_db_path = tmp_db.name

    engine = None
    try:
        tmp_db_url = f"sqlite:///{tmp_db_path}"

        alembic_cfg = Config(alembic_ini_path)
        alembic_cfg.set_main_option("sqlalchemy.url", tmp_db_url)
        alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))

        # 1. Upgrade to head
        command.upgrade(alembic_cfg, "head")

        engine = sa.create_engine(tmp_db_url)
        inspector = sa.inspect(engine)
        table_names = inspector.get_table_names()

        # Confirm all 11 core tables are created
        expected_tables = {
            "users", "issuers", "public_keys", "key_bundle_state",
            "documents", "holder_details", "issuance_queue",
            "revocations", "drl_state", "audit_events", "fraud_reports"
        }
        for tbl in expected_tables:
            assert tbl in table_names, f"Table '{tbl}' was not created by migration"

        # Confirm singleton rows are seeded
        with engine.connect() as conn:
            drl_row = conn.execute(sa.text("SELECT id, version FROM drl_state WHERE id = 1")).fetchone()
            assert drl_row is not None
            assert drl_row[1] == 0

            bundle_row = conn.execute(sa.text("SELECT id, version FROM key_bundle_state WHERE id = 1")).fetchone()
            assert bundle_row is not None
            assert bundle_row[1] == 1

        # 2. Downgrade to base
        command.downgrade(alembic_cfg, "base")

        inspector = sa.inspect(engine)
        remaining_tables = inspector.get_table_names()
        assert "documents" not in remaining_tables
        assert "users" not in remaining_tables
        assert "drl_state" not in remaining_tables

    finally:
        if engine is not None:
            engine.dispose()
        if os.path.exists(tmp_db_path):
            try:
                os.unlink(tmp_db_path)
            except OSError:
                pass
