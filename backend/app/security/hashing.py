"""
Argon2id Password Hashing and Policy Validation (FR-1.1)
Implements memory-hard Argon2id hashing with parameters specified by security baseline.
"""
import re
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from app.config import settings

# Initialize Argon2id password hasher
_ph = PasswordHasher(
    time_cost=settings.ARGON2_TIME_COST,
    memory_cost=settings.ARGON2_MEMORY_COST,
    parallelism=settings.ARGON2_PARALLELISM,
    hash_len=settings.ARGON2_HASH_LEN,
    salt_len=settings.ARGON2_SALT_LEN
)


class PasswordPolicyError(Exception):
    pass


def validate_password_policy(password: str) -> None:
    """
    Enforces strong password policy for administrative and issuer accounts (FR-1.1):
    - Minimum length of 10 characters
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one decimal digit (0-9)
    - At least one special symbol (!@#$%^&*()_+-=[]{}|;:,.<>?)
    """
    if len(password) < 10:
        raise PasswordPolicyError("Password must be at least 10 characters long.")
    if not re.search(r"[A-Z]", password):
        raise PasswordPolicyError("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise PasswordPolicyError("Password must contain at least one lowercase letter.")
    if not re.search(r"[0-9]", password):
        raise PasswordPolicyError("Password must contain at least one numeric digit.")
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?~`]", password):
        raise PasswordPolicyError("Password must contain at least one special character.")


def hash_password(password: str) -> str:
    """Hashes a plaintext password using Argon2id."""
    return _ph.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """
    Verifies a plaintext password against an Argon2id hash.
    Safely handles invalid hashes without exposing exceptions.
    """
    try:
        return _ph.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
    except Exception:
        return False
