"""
Audit Event Schemas (FR-5.1, FR-5.2)
"""
from typing import Literal, List
import uuid
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class AuditEventItem(BaseModel):
    client_event_id: str = Field(..., min_length=1, max_length=64)
    device_id: str = Field(..., min_length=1, max_length=64)
    document_id: str = Field(..., min_length=1, max_length=64)
    verified_at: datetime
    result: Literal["valid", "tampered", "revoked", "expired", "unreadable"]

    model_config = ConfigDict(extra="forbid")


class AuditBatchRequest(BaseModel):
    events: List[AuditEventItem] = Field(..., max_length=500)

    model_config = ConfigDict(extra="forbid")


class AuditBatchResponse(BaseModel):
    accepted: int
    duplicate: int
    rejected: int

    model_config = ConfigDict(extra="forbid")


class AuditEventResponse(BaseModel):
    id: uuid.UUID
    client_event_id: str
    device_id: str
    document_id: str
    verified_at: datetime
    received_at: datetime
    result: str
    uploaded_by: str

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class PaginatedAuditResponse(BaseModel):
    items: List[AuditEventResponse]
    total: int
    page: int
    page_size: int
    pages: int

    model_config = ConfigDict(extra="forbid")
