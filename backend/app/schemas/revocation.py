"""
Document Revocation List Schemas (FR-4.2, FR-4.4)
"""
from typing import Literal, List
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class RevocationCreateRequest(BaseModel):
    document_id: uuid.UUID
    reason_code: Literal[
        "issued_in_error",
        "reported_lost",
        "reported_forged",
        "holder_request"
    ]

    model_config = ConfigDict(extra="forbid")


class RevocationItem(BaseModel):
    document_id: uuid.UUID
    reason_code: str
    revoked_at: datetime
    revocation_version: int

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class RevocationListResponse(BaseModel):
    version: int
    delta: List[RevocationItem]
    total_count: int
    server_time: str

    model_config = ConfigDict(extra="forbid")


class RevocationCreateResponse(BaseModel):
    success: bool
    document_id: uuid.UUID
    revocation_version: int
    revoked_at: datetime
    reason_code: str

    model_config = ConfigDict(extra="forbid")
