"""
Health Check API Endpoints (Scope 10)
Liveness and readiness probes for orchestrators and monitoring systems.
"""
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db
from app.logging_config import logger

router = APIRouter(prefix="/health", tags=["Health & Diagnostics"])


@router.get("/live")
def liveness():
    """
    Liveness probe.
    Returns 200 OK if the process is up and receiving traffic.
    """
    return {"status": "alive"}


@router.get("/ready")
def readiness(response: Response, db: Session = Depends(get_db)):
    """
    Readiness probe.
    Actively checks the PostgreSQL database connection (SELECT 1).
    Returns 503 Service Unavailable if database is unreachable.
    """
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "ready",
            "database": "connected"
        }
    except Exception as e:
        logger.error(f"Readiness probe failed database check: {e}")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "unready",
            "database": "disconnected",
            "error": "Database connection check failed"
        }
