"""
Issuer Schemas (Scope 7)
"""
from typing import Optional, Literal
import uuid
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class IssuerCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    issuer_code: str = Field(..., min_length=2, max_length=64, pattern=r"^[A-Z0-9_\-]+$")

    model_config = ConfigDict(extra="forbid")


class IssuerUpdate(BaseModel):
    status: Optional[Literal["active", "disabled"]] = None
    name: Optional[str] = Field(default=None, min_length=2, max_length=128)

    model_config = ConfigDict(extra="forbid")


class IssuerResponse(BaseModel):
    id: uuid.UUID
    name: str
    issuer_code: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, extra="forbid")
