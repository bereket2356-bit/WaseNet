"""
Application-Level Envelope Encryption (AES-256-GCM)
Implements SRS Section 4.1: Data minimization and field-level encryption for
holder_national_id and fraud report contact_details.
"""
import base64
import binascii
import os
from typing import Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings


def _get_encryption_key() -> bytes:
    """Parses 256-bit (32 bytes) master key from hex or base64 config."""
    raw_key = settings.AES_GCM_SECRET_KEY.strip()
    try:
        if len(raw_key) == 64:
            return bytes.fromhex(raw_key)
        decoded = base64.b64decode(raw_key)
        if len(decoded) == 32:
            return decoded
    except Exception:
        pass
    # Fallback to SHA-256 derivation of the key string to guarantee exactly 32 bytes
    import hashlib
    return hashlib.sha256(raw_key.encode("utf-8")).digest()


def encrypt_field(plaintext: Optional[str]) -> Optional[str]:
    """
    Encrypts a string using AES-256-GCM with a freshly generated 96-bit (12-byte) nonce.
    Returns: 'v1:<nonce_b64>:<tag_b64>:<ciphertext_b64>'
    """
    if plaintext is None:
        return None
    if not isinstance(plaintext, str):
        plaintext = str(plaintext)

    key = _get_encryption_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # 96-bit IV recommended by NIST SP 800-38D
    
    # AESGCM in cryptography returns ciphertext + 16-byte tag appended
    ct_and_tag = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    ciphertext = ct_and_tag[:-16]
    tag = ct_and_tag[-16:]

    nonce_b64 = base64.urlsafe_b64encode(nonce).decode("utf-8")
    tag_b64 = base64.urlsafe_b64encode(tag).decode("utf-8")
    ct_b64 = base64.urlsafe_b64encode(ciphertext).decode("utf-8")

    return f"v1:{nonce_b64}:{tag_b64}:{ct_b64}"


def decrypt_field(encrypted_str: Optional[str]) -> Optional[str]:
    """
    Decrypts an AES-256-GCM envelope string.
    Supports versioned key handling ('v1:...').
    """
    if not encrypted_str:
        return None

    parts = encrypted_str.split(":")
    if len(parts) != 4 or parts[0] != "v1":
        raise ValueError("Unsupported or malformed encrypted field payload format")

    _, nonce_b64, tag_b64, ct_b64 = parts
    try:
        nonce = base64.urlsafe_b64decode(nonce_b64.encode("utf-8"))
        tag = base64.urlsafe_b64decode(tag_b64.encode("utf-8"))
        ciphertext = base64.urlsafe_b64decode(ct_b64.encode("utf-8"))
    except (binascii.Error, ValueError) as e:
        raise ValueError("Base64 decoding failed for encrypted field") from e

    key = _get_encryption_key()
    aesgcm = AESGCM(key)
    
    try:
        decrypted_bytes = aesgcm.decrypt(nonce, ciphertext + tag, None)
        return decrypted_bytes.decode("utf-8")
    except Exception as e:
        raise ValueError("Field decryption authentication failed (tampered data or wrong key)") from e
