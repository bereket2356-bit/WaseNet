"""
Document Issuance and Retrieval Schemas (FR-2.1 to FR-2.4)
"""
from typing import Optional, Literal, Dict, Any, List
import uuid
from datetime import date, datetime
from pydantic import BaseModel, Field, ConfigDict, model_validator


class DocumentCreateRequest(BaseModel):
    doc_type: Literal[
        "land_certificate",
        "cooperative_credential",
        "birth_record",
        "local_permit"
    ]
    holder_name: str = Field(..., min_length=2, max_length=255)
    holder_national_id: str = Field(..., min_length=4, max_length=64)
    issue_date: date
    expiry_date: date
    attributes: Dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_expiry_after_issue(self) -> "DocumentCreateRequest":
        if self.expiry_date <= self.issue_date:
            raise ValueError("expiry_date must be strictly greater than issue_date")
        return self

    model_config = ConfigDict(extra="forbid")


class DocumentResponse(BaseModel):
    id: uuid.UUID
    doc_type: str
    issuer_id: uuid.UUID
    kid: str
    issue_date: date
    expiry_date: date
    payload_canonical: str
    jws: str
    payload_sha256: str
    created_by: uuid.UUID
    created_at: datetime
    sync_state: str
    holder_name: Optional[str] = None
    # QR payload represents the compact JWS rendered on the physical credential
    qr_payload: str

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class PaginatedDocumentsResponse(BaseModel):
    items: List[DocumentResponse]
    total: int
    page: int
    page_size: int
    pages: int

    model_config = ConfigDict(extra="forbid")
