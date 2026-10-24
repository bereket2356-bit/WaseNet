"""
Sync Status Schemas (Scope 9)
"""
from pydantic import BaseModel, ConfigDict


class SyncStatusResponse(BaseModel):
    revocation_version: int
    key_bundle_version: int
    server_time: str

    model_config = ConfigDict(extra="forbid")
