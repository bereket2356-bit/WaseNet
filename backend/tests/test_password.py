"""
Unit Tests: Password Policy and Argon2id Hashing (FR-1.1)
"""
import pytest
from app.security.hashing import (
    hash_password,
    verify_password,
    validate_password_policy,
    PasswordPolicyError
)


def test_password_policy_requirements():
    """Verifies each rule of the strong password policy."""
    # Too short (< 10 chars)
    with pytest.raises(PasswordPolicyError, match="at least 10 characters"):
        validate_password_policy("Ab1!short")

    # Missing uppercase
    with pytest.raises(PasswordPolicyError, match="uppercase letter"):
        validate_password_policy("lowercase123!@#")

    # Missing lowercase
    with pytest.raises(PasswordPolicyError, match="lowercase letter"):
        validate_password_policy("UPPERCASE123!@#")

    # Missing digit
    with pytest.raises(PasswordPolicyError, match="numeric digit"):
        validate_password_policy("NoDigitsHere!@#")

    # Missing special character
    with pytest.raises(PasswordPolicyError, match="special character"):
        validate_password_policy("NoSymbols123456")

    # Valid strong password
    validate_password_policy("Valid@Password2026!")


def test_argon2id_hashing_and_verification():
    """Verifies Argon2id password hashing and verification behavior."""
    plain = "SecureEthiopia2026!#"
    hashed = hash_password(plain)

    # Argon2id identifier
    assert hashed.startswith("$argon2id$")
    assert verify_password(plain, hashed) is True
    assert verify_password("WrongPassword123!", hashed) is False
    assert verify_password("", hashed) is False
    assert verify_password(plain, "corrupted_hash") is False
