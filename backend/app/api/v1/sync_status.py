"""
Sync Status API Endpoint (Scope 9)
Returns the global revocation list version, key bundle version, and authoritative server time.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.revocation import DrlState
from app.models.public_key import KeyBundleState
from app.schemas.sync_status import SyncStatusResponse

router = APIRouter(tags=["Synchronization Status"])


@router.get("/sync/status", response_model=SyncStatusResponse)
def get_sync_status(db: Session = Depends(get_db)):
    """
    Returns current synchronization versions for DRL, Key Bundle, and UTC server time (Scope 9).
    Enables low-bandwidth verifier PWAs to probe if local caches are up to date.
    """
    drl = db.query(DrlState).filter(DrlState.id == 1).first()
    bundle = db.query(KeyBundleState).filter(KeyBundleState.id == 1).first()

    return SyncStatusResponse(
        revocation_version=drl.version if drl else 0,
        key_bundle_version=bundle.version if bundle else 1,
        server_time=datetime.now(timezone.utc).isoformat()
    )
