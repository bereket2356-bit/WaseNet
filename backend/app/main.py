"""
WaseNet Public Document Authentication API Server
Main Application Entrypoint
Compliant with SRS-TC-2026-V1.1
"""
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.api.v1.router import api_v1_router
from app.api.v1.health import router as health_router
from app.logging_config import logger

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="WaseNet Document Authentication Prototype Backend for Public Offices in Ethiopia (SRS-TC-2026-V1.1)",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# ---------------- CORS Middleware ---------------- #
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------- Standard Error Handlers ---------------- #
# Format: { "error": { "code": "...", "message": "..." } }
# Never leak stack traces or raw SQL errors (Security Requirement)

@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "error" in detail:
        return JSONResponse(status_code=exc.status_code, content=detail)
    
    code = "HTTP_ERROR"
    if exc.status_code == status.HTTP_401_UNAUTHORIZED:
        code = "UNAUTHORIZED"
    elif exc.status_code == status.HTTP_403_FORBIDDEN:
        code = "FORBIDDEN"
    elif exc.status_code == status.HTTP_404_NOT_FOUND:
        code = "NOT_FOUND"
    elif exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
        code = "RATE_LIMIT_EXCEEDED"

    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": code, "message": str(detail)}}
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    error_msg = "; ".join(f"{err.get('loc', ['field'])[-1]}: {err.get('msg')}" for err in errors)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": {"code": "VALIDATION_ERROR", "message": f"Input validation failed: {error_msg}"}}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An internal server error occurred. Please try again later."}}
    )


# ---------------- Mount Routers ---------------- #
# Base API v1 router
app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

# Root-level health probes for orchestrators
app.include_router(health_router)


# ---------------- Backward-Compatibility Aliases for Frontend ---------------- #
# Routes frontend /api/* endpoints to /api/v1/* counterparts
from app.api.v1.auth import login as auth_login
from app.api.v1.verifier import (
    get_key_bundle as v_key_bundle,
    get_revocations_delta as v_revocations,
    upload_audit_batch as v_audit_batch
)
from app.api.v1.issuer import (
    sync_offline_queue as v_queue_sync,
    issue_document as v_issue_doc
)
from app.api.v1.admin import revoke_document as v_admin_revoke

app.add_api_route("/api/auth/login", auth_login, methods=["POST"], include_in_schema=False)
app.add_api_route("/api/keys/bundle", v_key_bundle, methods=["GET"], include_in_schema=False)
app.add_api_route("/api/revocation-list", v_revocations, methods=["GET"], include_in_schema=False)
app.add_api_route("/api/admin/revoke", v_admin_revoke, methods=["POST"], include_in_schema=False)
app.add_api_route("/api/issue/sync", v_queue_sync, methods=["POST"], include_in_schema=False)
app.add_api_route("/api/audit/batch", v_audit_batch, methods=["POST"], include_in_schema=False)
