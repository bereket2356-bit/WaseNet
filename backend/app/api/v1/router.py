"""
Aggregated API v1 Router
"""
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.verifier import router as verifier_router
from app.api.v1.issuer import router as issuer_router
from app.api.v1.admin import router as admin_router
from app.api.v1.fraud import router as fraud_router
from app.api.v1.sync_status import router as sync_router
from app.api.v1.health import router as health_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(verifier_router)
api_v1_router.include_router(issuer_router)
api_v1_router.include_router(admin_router)
api_v1_router.include_router(fraud_router)
api_v1_router.include_router(sync_router)
api_v1_router.include_router(health_router)
