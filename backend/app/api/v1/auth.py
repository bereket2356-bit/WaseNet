"""
Authentication API Endpoints (FR-1.1, FR-1.3)
Registration, Login with Argon2id, Logout, and Session Introspection.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.issuer import Issuer
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserResponse,
    LogoutResponse
)
from app.schemas.common import ErrorResponse
from app.security.hashing import hash_password, verify_password, validate_password_policy, PasswordPolicyError
from app.security.jwt_auth import create_access_token
from app.security.rate_limiter import rate_limiter
from app.api.deps import get_current_user
from app.logging_config import logger

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorResponse}, 409: {"model": ErrorResponse}}
)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a new user account (FR-1.1).
    Administrator accounts are registered in 'pending' status until approved by an active administrator.
    """
    # Enforce password complexity
    try:
        validate_password_policy(req.password)
    except PasswordPolicyError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "WEAK_PASSWORD", "message": str(e)}}
        )

    # Check case-insensitive username uniqueness
    existing_user = db.query(User).filter(func.lower(User.username) == req.username.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "USERNAME_EXISTS", "message": "Username is already registered"}}
        )

    issuer_id = None
    if req.role == "issuer":
        if not req.issuer_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": {"code": "MISSING_ISSUER_CODE", "message": "issuer_code is required for issuer role"}}
            )
        issuer = db.query(Issuer).filter(Issuer.issuer_code == req.issuer_code).first()
        if not issuer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": {"code": "INVALID_ISSUER_CODE", "message": f"Issuer code '{req.issuer_code}' does not exist"}}
            )
        if issuer.status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": {"code": "ISSUER_DISABLED", "message": "The designated issuer organization is disabled"}}
            )
        issuer_id = issuer.id

    # Accounts are created pending approval (FR-1.1)
    new_user = User(
        username=req.username.lower(),
        password_hash=hash_password(req.password),
        full_name=req.full_name,
        organization=req.organization,
        role=req.role,
        status="pending",
        issuer_id=issuer_id
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info(f"User registration created: username={new_user.username}, role={new_user.role}, status={new_user.status}")
    return new_user


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={401: {"model": ErrorResponse}, 429: {"model": ErrorResponse}}
)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Signs in a user and returns an 8-hour signed session JWT (FR-1.1, FR-1.3).
    Rejects pending or disabled accounts with the exact same generic error as invalid credentials.
    Rate limited per client IP and per username.
    """
    client_ip = request.client.host if request.client else "unknown"

    # Rate limiting
    rate_limiter.check_rate_limit(
        f"login_ip_{client_ip}",
        max_requests=settings.RATE_LIMIT_LOGIN_PER_MINUTE,
        message="Too many login attempts from this IP. Please wait."
    )
    rate_limiter.check_rate_limit(
        f"login_user_{req.username.lower()}",
        max_requests=settings.RATE_LIMIT_LOGIN_PER_MINUTE,
        message="Too many login attempts for this username. Please wait."
    )

    generic_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"error": {"code": "INVALID_CREDENTIALS", "message": "Invalid username or password"}}
    )

    user = db.query(User).filter(func.lower(User.username) == req.username.lower()).first()
    if not user:
        # Dummy verification to prevent timing attacks
        verify_password("dummy_password", "$argon2id$v=19$m=65536,t=2,p=2$placeholder$placeholder")
        raise generic_error

    if not verify_password(req.password, user.password_hash):
        raise generic_error

    # Rejection of pending or disabled accounts must return the exact same generic message
    if user.status != "active":
        logger.warning(f"Login denied for user '{user.username}' due to status='{user.status}'")
        raise generic_error

    # Successful authentication
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    token_data = create_access_token(
        user_id=str(user.id),
        username=user.username,
        role=user.role,
        organization=user.organization,
        issuer_id=str(user.issuer_id) if user.issuer_id else None
    )

    logger.info(f"User signed in successfully: username={user.username}, role={user.role}")

    return {
        **token_data,
        "user": user
    }


@router.post("/logout", response_model=LogoutResponse)
def logout(current_user: User = Depends(get_current_user)):
    """
    Logs out the user session (FR-1.3).
    Stateless JWT logout acknowledgment.
    """
    logger.info(f"User signed out: username={current_user.username}")
    return LogoutResponse(message="Signed out successfully")


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns current authenticated user profile and roles (FR-1.3).
    """
    return current_user
