"""
Standard Error and Common Response Schemas
Implements API Requirement:
Consistent error bodies: { "error": { "code": "...", "message": "..." } }
Never return stack traces or SQL errors.
"""
from pydantic import BaseModel, ConfigDict


class ErrorDetail(BaseModel):
    code: str
    message: str

    model_config = ConfigDict(extra="forbid")


class ErrorResponse(BaseModel):
    error: ErrorDetail

    model_config = ConfigDict(extra="forbid")
