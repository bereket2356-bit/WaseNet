"""
Pytest Test Fixtures and Test Environment Setup
Supports both real PostgreSQL container (when configured via TEST_DATABASE_URL or DATABASE_URL)
and SQLite in-memory testing for fast local execution.
"""
import os
import sys
import uuid
from datetime import datetime, date, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure backend root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Set test environment flags
os.environ["ENVIRONMENT"] = "test"
os.environ["JWT_SECRET"] = "test-jwt-secret-key-32-bytes-minimum-length-2026"
os.environ["AES_GCM_SECRET_KEY"] = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models.user import User
from app.models.issuer import Issuer
from app.models.public_key import PublicKey, KeyBundleState
from app.models.revocation import DrlState
from app.security.hashing import hash_password
from app.security.signer import signer
from app.security.jwt_auth import create_access_token

# Determine test database: real PostgreSQL if TEST_DATABASE_URL is set, else SQLite in-memory
TEST_DB_URL = os.getenv("TEST_DATABASE_URL", "sqlite+pysqlite:///:memory:")

if TEST_DB_URL.startswith("sqlite"):
    test_engine = create_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
else:
    test_engine = create_engine(TEST_DB_URL, pool_pre_ping=True)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Creates all tables and seeds singleton tables before tests run."""
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)
    
    # Ensure singletons exist
    if not db.query(DrlState).filter(DrlState.id == 1).first():
        db.add(DrlState(id=1, version=0, last_updated_at=now))
    if not db.query(KeyBundleState).filter(KeyBundleState.id == 1).first():
        db.add(KeyBundleState(id=1, version=1, last_updated_at=now))
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    """Yields a database session with automatic rollback after each test."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    """Provides a TestClient with overridden get_db dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_issuer(db_session):
    """Creates a pre-seeded authorized issuer office."""
    existing = db_session.query(Issuer).filter(Issuer.issuer_code == "TEST-OFFICE-01").first()
    if existing:
        return existing

    issuer = Issuer(
        id=uuid.uuid4(),
        name="Test Sub-City Registry Office",
        issuer_code="TEST-OFFICE-01",
        status="active"
    )
    db_session.add(issuer)
    db_session.commit()
    db_session.refresh(issuer)
    return issuer


@pytest.fixture
def admin_user(db_session):
    """Creates an active administrator account."""
    existing = db_session.query(User).filter(User.username == "test_admin").first()
    if existing:
        return existing

    user = User(
        id=uuid.uuid4(),
        username="test_admin",
        password_hash=hash_password("AdminSecure2026!"),
        full_name="System Administrator",
        organization="Central Authentication Directorate",
        role="administrator",
        status="active"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def admin_token(admin_user):
    """Generates an 8-hour JWT token for the admin user."""
    return create_access_token(
        user_id=str(admin_user.id),
        username=admin_user.username,
        role=admin_user.role,
        organization=admin_user.organization
    )["access_token"]


@pytest.fixture
def issuer_user(db_session, test_issuer):
    """Creates an active issuer user."""
    existing = db_session.query(User).filter(User.username == "test_issuer").first()
    if existing:
        return existing

    user = User(
        id=uuid.uuid4(),
        username="test_issuer",
        password_hash=hash_password("IssuerSecure2026!"),
        full_name="Credential Officer",
        organization=test_issuer.name,
        role="issuer",
        status="active",
        issuer_id=test_issuer.id
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def issuer_token(issuer_user):
    """Generates an 8-hour JWT token for the issuer user."""
    return create_access_token(
        user_id=str(issuer_user.id),
        username=issuer_user.username,
        role=issuer_user.role,
        organization=issuer_user.organization,
        issuer_id=str(issuer_user.issuer_id)
    )["access_token"]
