"""
Unit Tests: Cryptographic Foundations
- Canonicalization (RFC 8785: sorted keys, no whitespace, identical bytes for identical input)
- SHA-256 digest computation
- ES256 JWS creation and verification (NIST P-256 / secp256r1)
- AES-256-GCM application-level envelope encryption
"""
import hashlib
import json
import pytest

from app.security.canonical import canonicalize_json, compute_sha256_digest
from app.security.signer import ES256Signer, base64url_encode, base64url_decode
from app.security.encryption import encrypt_field, decrypt_field


def test_canonicalization_key_sorting_and_whitespace():
    """Verifies that dictionary keys are sorted and all whitespace around delimiters is removed."""
    input_obj1 = {
        "zeta": 1,
        "alpha": "value",
        "nested": {
            "beta": True,
            "gamma": [3, 2, 1]
        }
    }
    input_obj2 = {
        "alpha": "value",
        "nested": {
            "gamma": [3, 2, 1],
            "beta": True
        },
        "zeta": 1
    }

    canon1 = canonicalize_json(input_obj1)
    canon2 = canonicalize_json(input_obj2)

    # Must produce strictly identical strings
    assert canon1 == canon2
    # Must have alpha before nested before zeta
    expected = '{"alpha":"value","nested":{"beta":true,"gamma":[3,2,1]},"zeta":1}'
    assert canon1 == expected
    # No extra spaces
    assert " " not in canon1
    assert "\n" not in canon1


def test_sha256_digest():
    """Verifies SHA-256 digest calculation matches standard hashlib."""
    canonical = '{"alpha":"test","doc_id":"123"}'
    digest = compute_sha256_digest(canonical)

    expected = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    assert digest == expected
    assert len(digest) == 64


def test_es256_jws_creation_and_verification():
    """Tests ES256 JWS compact serialization and cryptographic signature verification."""
    signer = ES256Signer(kid="test-key-2026")
    public_jwk = signer.get_public_jwk()

    assert public_jwk["kty"] == "EC"
    assert public_jwk["crv"] == "P-256"
    assert public_jwk["kid"] == "test-key-2026"

    payload = '{"doc_id":"3fa85f64-5717-4562-b3fc-2c963f66afa6","type":"land_certificate"}'
    header = {"alg": "ES256", "kid": "test-key-2026", "typ": "JWT"}

    jws = signer.sign_document(header, payload)
    parts = jws.split(".")
    assert len(parts) == 3

    # Signature must be raw 64 bytes (IEEE P1363: 32 bytes r || 32 bytes s)
    sig_raw = base64url_decode(parts[2])
    assert len(sig_raw) == 64

    # Verify signature against public JWK
    is_valid = signer.verify_jws(jws, public_jwk)
    assert is_valid is True


def test_es256_tampered_payload_fails():
    """Tests that modifying any character in the payload invalidates the JWS signature."""
    signer = ES256Signer(kid="test-key-2026")
    public_jwk = signer.get_public_jwk()

    payload = '{"amount":100}'
    jws = signer.sign_document({"alg": "ES256", "kid": "test-key-2026"}, payload)
    h_b64, _, s_b64 = jws.split(".")

    # Tamper with payload
    tampered_payload_b64 = base64url_encode(b'{"amount":999}')
    tampered_jws = f"{h_b64}.{tampered_payload_b64}.{s_b64}"

    assert signer.verify_jws(tampered_jws, public_jwk) is False


def test_aes_256_gcm_envelope_encryption():
    """Tests application-level field encryption for holder national ID."""
    national_id = "ETH-123456789-V1"
    encrypted = encrypt_field(national_id)

    assert encrypted.startswith("v1:")
    parts = encrypted.split(":")
    assert len(parts) == 4

    decrypted = decrypt_field(encrypted)
    assert decrypted == national_id


def test_aes_256_gcm_tampering_detection():
    """Tests that ciphertext modification causes authentication failure."""
    national_id = "ETH-SECRET-ID"
    encrypted = encrypt_field(national_id)
    parts = encrypted.split(":")

    # Modify the last character of the ciphertext
    tampered_ct = parts[3][:-2] + ("aa" if parts[3][-2:] != "aa" else "bb")
    tampered_blob = f"{parts[0]}:{parts[1]}:{parts[2]}:{tampered_ct}"

    with pytest.raises(ValueError, match="Field decryption authentication failed"):
        decrypt_field(tampered_blob)
