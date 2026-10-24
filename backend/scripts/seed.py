"""
Database Seeding Script (Deliverable 5)
Seeds:
1. One administrator account (credentials loaded from environment variables).
2. One authorized public office issuer.
3. One active ES256 signing key.
4. One demonstration revoked document (for immediate verification testing).
"""
import os
import sys
import uuid
from datetime import datetime, date, timezone

# Ensure backend root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal, Base, engine
from app.config import settings
from app.models.user import User
from app.models.issuer import Issuer
from app.models.public_key import PublicKey, KeyBundleState
from app.models.document import Document, HolderDetails
from app.models.revocation import Revocation, DrlState
from app.security.hashing import hash_password
from app.security.signer import signer
from app.security.canonical import canonicalize_json, compute_sha256_digest
from app.security.encryption import encrypt_field
from app.logging_config import logger


def seed_database():
    logger.info("Initializing database schema if not present...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)

        # 1. Ensure singleton state tables exist
        drl = db.query(DrlState).filter(DrlState.id == 1).first()
        if not drl:
            drl = DrlState(id=1, version=0, last_updated_at=now)
            db.add(drl)
            db.commit()

        bundle_state = db.query(KeyBundleState).filter(KeyBundleState.id == 1).first()
        if not bundle_state:
            bundle_state = KeyBundleState(id=1, version=1, last_updated_at=now)
            db.add(bundle_state)
            db.commit()

        # 2. Seed Authorized Public Office Issuer
        issuer = db.query(Issuer).filter(Issuer.issuer_code == "ET-AA-DOC-01").first()
        if not issuer:
            issuer = Issuer(
                id=uuid.uuid4(),
                name="Addis Ababa Central Land & Vital Records Office",
                issuer_code="ET-AA-DOC-01",
                status="active",
                created_at=now
            )
            db.add(issuer)
            db.commit()
            db.refresh(issuer)
            logger.info(f"Seeded Issuer: {issuer.name} ({issuer.issuer_code})")
        else:
            logger.info(f"Issuer already exists: {issuer.name}")

        # 3. Seed Bootstrap Administrator Account (credentials from environment)
        admin_username = settings.BOOTSTRAP_ADMIN_USERNAME.lower()
        admin = db.query(User).filter(User.username == admin_username).first()
        if not admin:
            admin = User(
                id=uuid.uuid4(),
                username=admin_username,
                password_hash=hash_password(settings.BOOTSTRAP_ADMIN_PASSWORD),
                full_name=settings.BOOTSTRAP_ADMIN_FULL_NAME,
                organization=settings.BOOTSTRAP_ADMIN_ORG,
                role="administrator",
                status="active",
                created_at=now
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            logger.info(f"Seeded Administrator: {admin.username} ({admin.organization})")
        else:
            logger.info(f"Administrator already exists: {admin.username}")

        # Seed demo Issuer User
        issuer_user = db.query(User).filter(User.username == "issuer_aa").first()
        if not issuer_user:
            issuer_user = User(
                id=uuid.uuid4(),
                username="issuer_aa",
                password_hash=hash_password("IssuerPass2026!"),
                full_name="Almaz Bekele",
                organization="Addis Ababa Sub-city Office 04",
                role="issuer",
                status="active",
                issuer_id=issuer.id,
                created_at=now
            )
            db.add(issuer_user)
            db.commit()
            logger.info("Seeded Issuer User: issuer_aa")

        # 4. Seed Active Signing Key
        pub_key = db.query(PublicKey).filter(PublicKey.kid == signer.kid).first()
        if not pub_key:
            jwk = signer.get_public_jwk()
            pub_key = PublicKey(
                id=uuid.uuid4(),
                kid=signer.kid,
                algorithm="ES256",
                public_key_jwk=jwk,
                status="active",
                created_at=now,
                status_changed_at=now,
                status_changed_by=admin.id
            )
            db.add(pub_key)
            db.commit()
            logger.info(f"Seeded Public Key: {pub_key.kid} (ES256)")
        else:
            logger.info(f"Public key already exists: {pub_key.kid}")

        # 5. Seed Demonstration Revoked Document
        demo_doc_id = uuid.UUID("3fa85f64-5717-4562-b3fc-2c963f66afa6")
        demo_doc = db.query(Document).filter(Document.id == demo_doc_id).first()
        if not demo_doc:
            issue_d = date(2026, 1, 15)
            expiry_d = date(2031, 1, 15)
            payload_dict = {
                "doc_id": str(demo_doc_id),
                "doc_type": "land_certificate",
                "issuer_id": str(issuer.id),
                "kid": signer.kid,
                "issue_date": issue_d.isoformat(),
                "expiry_date": expiry_d.isoformat(),
                "holder_name": "Tadesse Mengistu",
                "attributes": {
                    "parcel_id": "AA-BKK-2026-9901",
                    "area_sq_meters": 350.5
                }
            }
            canonical_payload = canonicalize_json(payload_dict)
            sha256_digest = compute_sha256_digest(canonical_payload)
            header = {"alg": "ES256", "kid": signer.kid, "typ": "JWT"}
            jws = signer.sign_document(header, canonical_payload)

            demo_doc = Document(
                id=demo_doc_id,
                doc_type="land_certificate",
                issuer_id=issuer.id,
                kid=signer.kid,
                issue_date=issue_d,
                expiry_date=expiry_d,
                payload_canonical=canonical_payload,
                jws=jws,
                payload_sha256=sha256_digest,
                created_by=admin.id,
                sync_state="synced",
                created_at=now
            )
            holder = HolderDetails(
                document_id=demo_doc_id,
                holder_name="Tadesse Mengistu",
                holder_national_id=encrypt_field("ET-NATID-8849201")
            )
            db.add(demo_doc)
            db.add(holder)
            db.commit()

            # Revoke this demonstration document
            drl = db.query(DrlState).filter(DrlState.id == 1).with_for_update().first()
            drl.version += 1
            drl.last_updated_at = now

            revocation = Revocation(
                id=uuid.uuid4(),
                document_id=demo_doc_id,
                reason_code="reported_lost",
                revoked_at=now,
                revoked_by=admin.id,
                revocation_version=drl.version
            )
            db.add(revocation)
            db.commit()
            logger.info(f"Seeded Revoked Document: id={demo_doc_id}, DRL version={drl.version}")
        else:
            logger.info(f"Demo document already exists: {demo_doc_id}")

        print("\n========================================================")
        print(" [SUCCESS] WaseNet Database Seeding Complete!")
        print("========================================================")
        print(f" * Administrator: {settings.BOOTSTRAP_ADMIN_USERNAME} / (configured via env)")
        print(f" * Issuer User:   issuer_aa / IssuerPass2026!")
        print(f" * Active Issuer: {issuer.name} ({issuer.issuer_code})")
        print(f" * Active Key:    {signer.kid} (ES256 NIST P-256)")
        print(f" * Revoked Doc:   {demo_doc_id} (Reason: reported_lost)")
        print("========================================================\n")

    except Exception as e:
        db.rollback()
        logger.error(f"Seeding failed: {e}", exc_info=True)
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
