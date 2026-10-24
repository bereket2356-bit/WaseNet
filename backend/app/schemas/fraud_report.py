"""
Fraud Report Schemas (FR-R1)
"""
from typing import Optional, Literal, List
import uuid
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class FraudReportCreate(BaseModel):
    document_id: str = Field(..., min_length=1, max_length=64)
    reason_code: Literal[
        "signature_failed",
        "details_mismatch",
        "reported_lost",
        "looks_forged",
        "other"
    ]
    description: str = Field(..., min_length=5, max_length=500)
    contact_details: Optional[str] = Field(default=None, max_length=255)

    model_config = ConfigDict(extra="forbid")


class FraudReportStatusUpdate(BaseModel):
    status: Literal["new", "reviewing", "closed"]

    model_config = ConfigDict(extra="forbid")


class FraudReportCreateResponse(BaseModel):
    reference: str
    message: str = "Fraud report submitted successfully"
    created_at: datetime

    model_config = ConfigDict(extra="forbid")


class FraudReportResponse(BaseModel):
    id: uuid.UUID
    reference: str
    document_id: str
    reason_code: str
    description: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class PaginatedFraudReportsResponse(BaseModel):
    items: List[FraudReportResponse]
    total: int
    page: int
    page_size: int
    pages: int

    model_config = ConfigDict(extra="forbid")
