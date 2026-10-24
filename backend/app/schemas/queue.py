"""
Offline Issuance Queue Schemas (FR-2.5)
"""
from typing import Optional, Literal, List
import uuid
from datetime import date, datetime
from pydantic import BaseModel, Field, ConfigDict


class QueueItemSyncPayload(BaseModel):
    id: uuid.UUID = Field(..., description="Canonical Document ID generated client-side")
    doc_type: Literal[
        "land_certificate",
        "cooperative_credential",
        "birth_record",
        "local_permit"
    ]
    kid: str
    issue_date: date
    expiry_date: date
    payload_canonical: str
    jws: str
    payload_sha256: str
    holder_name: str
    holder_national_id: str

    model_config = ConfigDict(extra="forbid")


class QueueSyncRequest(BaseModel):
    documents: List[QueueItemSyncPayload] = Field(..., max_length=500)

    model_config = ConfigDict(extra="forbid")


class QueueItemResult(BaseModel):
    document_id: uuid.UUID
    status: Literal["synced", "already_synced", "failed"]
    error: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class QueueSyncResponse(BaseModel):
    success: bool
    total_received: int
    synced_count: int
    duplicate_count: int
    failed_count: int
    results: List[QueueItemResult]

    model_config = ConfigDict(extra="forbid")


class QueueItemResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    received_at: datetime
    attempts: int
    last_error: Optional[str] = None
    state: str
    doc_type: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, extra="forbid")
