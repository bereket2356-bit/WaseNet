"""
JWT Session Management (FR-1.3)
Generates and strictly verifies signed JSON Web Tokens with absolute 8-hour expiry.
Enforces algorithms, issuer, audience, and rejects unsigned tokens (alg=none).
"""
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
import jwt
from jwt.exceptions import PyJWTError, ExpiredSignatureError, InvalidTokenError

from app.config import settings


class AuthenticationError(Exception):
    def __init__(self, message: str = "Invalid or expired session token", code: str = "UNAUTHORIZED"):
        self.message = message
        self.code = code
        super().__init__(self.message)


def create_access_token(
    user_id: str,
    username: str,
    role: str,
    organization: Optional[str] = None,
    issuer_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Creates an absolute 8-hour signed session JWT.
    Claims: sub, username, role, org, issuer_id, iss, aud, iat, exp.
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=settings.JWT_EXPIRY_HOURS)

    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "org": organization or "",
        "issuer_id": issuer_id,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp())
    }

    token = jwt.encode(
        payload,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )

    return {
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": settings.JWT_EXPIRY_HOURS * 3600,
        "expires_at": expires_at.isoformat()
    }


def verify_access_token(token: str) -> Dict[str, Any]:
    """
    Strictly verifies token signature, expiry, issuer, audience, and algorithm.
    Explicitly rejects alg='none' or mismatched algorithms.
    """
    if not token or not isinstance(token, str):
        raise AuthenticationError("Session token missing or malformed")

    try:
        # Inspect header to reject alg='none' explicitly before decode
        unverified_headers = jwt.get_unverified_header(token)
        if unverified_headers.get("alg") != settings.JWT_ALGORITHM:
            raise AuthenticationError("Invalid token algorithm", code="INVALID_ALGORITHM")

        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_iss": True,
                "verify_aud": True,
                "require": ["exp", "iss", "aud", "sub", "role"]
            }
        )
        return payload
    except ExpiredSignatureError:
        raise AuthenticationError("Session has expired. Please sign in again.", code="SESSION_EXPIRED")
    except (InvalidTokenError, PyJWTError) as e:
        raise AuthenticationError("Invalid authentication credentials", code="INVALID_TOKEN")
