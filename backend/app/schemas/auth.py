"""
Authentication Schemas (FR-1.1, FR-1.3)
"""
from typing import Optional, Literal
import uuid
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_\-\.]+$")
    password: str = Field(..., min_length=10, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=128)
    organization: str = Field(..., min_length=2, max_length=255)
    role: Literal["issuer", "administrator"]
    issuer_code: Optional[str] = Field(default=None, max_length=64)

    model_config = ConfigDict(extra="forbid")


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)

    model_config = ConfigDict(extra="forbid")


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    full_name: str
    organization: str
    role: str
    status: str
    created_at: datetime
    last_login_at: Optional[datetime] = None
    issuer_id: Optional[uuid.UUID] = None

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    expires_at: str
    user: UserResponse

    model_config = ConfigDict(extra="forbid")


class LogoutResponse(BaseModel):
    message: str = "Signed out successfully"

    model_config = ConfigDict(extra="forbid")
