"""
Public Key and Key Bundle Schemas (FR-4.1, FR-4.3)
"""
from typing import Optional, Literal, Dict, Any, List
import uuid
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator


class KeyRegisterRequest(BaseModel):
    kid: str = Field(..., min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_\-]+$")
    algorithm: Literal["ES256"] = "ES256"
    public_key_jwk: Dict[str, Any]
    status: Literal["active", "expired", "revoked"] = "active"

    @field_validator("public_key_jwk")
    @classmethod
    def validate_no_private_material(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        forbidden_keys = {"d", "p", "q", "dp", "dq", "qi", "k", "private_key", "priv"}
        for k in v.keys():
            if k.lower() in forbidden_keys:
                raise ValueError("Private key parameters are strictly forbidden in public key registrations")
        if v.get("kty") != "EC":
            raise ValueError("Key type must be EC (Elliptic Curve)")
        if v.get("crv") != "P-256":
            raise ValueError("Curve must be P-256")
        if not v.get("x") or not v.get("y"):
            raise ValueError("Public key JWK must contain coordinates 'x' and 'y'")
        return v

    model_config = ConfigDict(extra="forbid")


class KeyStatusUpdate(BaseModel):
    status: Literal["active", "expired", "revoked"]

    model_config = ConfigDict(extra="forbid")


class KeyResponse(BaseModel):
    id: uuid.UUID
    kid: str
    algorithm: str
    public_key_jwk: Dict[str, Any]
    status: str
    created_at: datetime
    status_changed_at: Optional[datetime] = None
    status_changed_by: Optional[uuid.UUID] = None

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class KeyBundleResponse(BaseModel):
    version: int
    keys: List[KeyResponse]
    server_time: str

    model_config = ConfigDict(extra="forbid")
