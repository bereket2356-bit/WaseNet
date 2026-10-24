"""
Document Signing and Verification Architecture (FR-2.1 to FR-2.4)
Encapsulates signing behind the DocumentSigner abstract interface.
Provides the ES256 (NIST P-256 / secp256r1) implementation with IEEE P1363 raw signature encoding.
Supports future migration to client-side signing or INSA HSM.
"""
from abc import ABC, abstractmethod
import base64
import json
import os
from typing import Dict, Any, Tuple

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import (
    decode_dss_signature,
    encode_dss_signature
)
from cryptography.hazmat.primitives import hashes, serialization

from app.config import settings
from app.logging_config import logger


def base64url_encode(data: bytes) -> str:
    """Encodes bytes to Base64URL string without trailing '=' padding."""
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def base64url_decode(data: str) -> bytes:
    """Decodes Base64URL string with optional omitted padding."""
    rem = len(data) % 4
    if rem > 0:
        data += "=" * (4 - rem)
    return base64.urlsafe_b64decode(data.encode("utf-8"))


class DocumentSigner(ABC):
    """
    Abstract interface for document signing.
    Enables drop-in replacement with Client-Side Signer or Hardware Security Module (HSM).
    """

    @abstractmethod
    def sign_document(self, header: Dict[str, Any], canonical_payload: str) -> str:
        """
        Signs the canonical payload with the specified header.
        Returns a JWS Compact Serialization string: [header_b64].[payload_b64].[sig_b64]
        """
        pass

    @abstractmethod
    def verify_jws(self, jws: str, jwk: Dict[str, Any]) -> bool:
        """Verifies a JWS compact serialization against a public JWK."""
        pass

    @abstractmethod
    def get_public_jwk(self) -> Dict[str, Any]:
        """Returns the public key as a JWK object."""
        pass

    @property
    @abstractmethod
    def kid(self) -> str:
        """Returns the Key ID of the active signing key."""
        pass


class ES256Signer(DocumentSigner):
    """
    Server-side ES256 (ECDSA P-256 with SHA-256) implementation.
    Adheres strictly to RFC 7515 (JWS) and IEEE P1363 raw signature format (64 bytes).
    """

    def __init__(self, private_key_pem: str = "", kid: str = ""):
        self._kid = kid or settings.ACTIVE_KID
        self._private_key, self._public_key = self._initialize_keys(private_key_pem)

    def _initialize_keys(self, pem_str: str) -> Tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey]:
        if pem_str and pem_str.strip():
            try:
                priv = serialization.load_pem_private_key(pem_str.encode("utf-8"), password=None)
                if not isinstance(priv, ec.EllipticCurvePrivateKey):
                    raise ValueError("Loaded key is not an EllipticCurvePrivateKey")
                return priv, priv.public_key()
            except Exception as e:
                logger.warning(f"Failed to load provided private key PEM, generating fresh keypair: {e}")

        # Generate a new P-256 keypair
        priv = ec.generate_private_key(ec.SECP256R1())
        return priv, priv.public_key()

    @property
    def kid(self) -> str:
        return self._kid

    def get_public_jwk(self) -> Dict[str, Any]:
        """Exports public key as standard JWK (kty, crv, x, y, kid)."""
        pub_numbers = self._public_key.public_numbers()
        x_bytes = pub_numbers.x.to_bytes(32, byteorder="big")
        y_bytes = pub_numbers.y.to_bytes(32, byteorder="big")

        return {
            "kty": "EC",
            "crv": "P-256",
            "x": base64url_encode(x_bytes),
            "y": base64url_encode(y_bytes),
            "kid": self._kid,
            "use": "sig",
            "alg": "ES256"
        }

    def sign_document(self, header: Dict[str, Any], canonical_payload: str) -> str:
        """
        Signs the canonical payload with ES256.
        Returns compact JWS: header_b64.payload_b64.signature_b64
        """
        # Ensure header contains mandatory metadata
        header_copy = dict(header)
        header_copy.setdefault("alg", "ES256")
        header_copy.setdefault("typ", "JWT")
        header_copy.setdefault("kid", self._kid)

        h_b64 = base64url_encode(json.dumps(header_copy, separators=(',', ':')).encode("utf-8"))
        p_b64 = base64url_encode(canonical_payload.encode("utf-8"))
        signing_input = f"{h_b64}.{p_b64}".encode("ascii")

        # Sign using ECDSA with SHA-256 (produces ASN.1 DER signature)
        der_signature = self._private_key.sign(signing_input, ec.ECDSA(hashes.SHA256()))

        # Convert DER signature (r, s) to raw 64-byte IEEE P1363 (32 bytes r || 32 bytes s)
        r, s = decode_dss_signature(der_signature)
        r_bytes = r.to_bytes(32, byteorder="big")
        s_bytes = s.to_bytes(32, byteorder="big")
        raw_signature = r_bytes + s_bytes

        sig_b64 = base64url_encode(raw_signature)
        return f"{h_b64}.{p_b64}.{sig_b64}"

    def verify_jws(self, jws: str, jwk: Dict[str, Any]) -> bool:
        """
        Verifies a JWS compact serialization against the provided JWK.
        """
        try:
            parts = jws.split(".")
            if len(parts) != 3:
                return False
            h_b64, p_b64, sig_b64 = parts

            # Reconstruct EC public key from JWK
            x_int = int.from_bytes(base64url_decode(jwk["x"]), byteorder="big")
            y_int = int.from_bytes(base64url_decode(jwk["y"]), byteorder="big")
            public_numbers = ec.EllipticCurvePublicNumbers(x_int, y_int, ec.SECP256R1())
            public_key = public_numbers.public_key()

            # Decode 64-byte raw signature to (r, s)
            raw_sig = base64url_decode(sig_b64)
            if len(raw_sig) != 64:
                return False
            r = int.from_bytes(raw_sig[:32], byteorder="big")
            s = int.from_bytes(raw_sig[32:], byteorder="big")
            der_signature = encode_dss_signature(r, s)

            signing_input = f"{h_b64}.{p_b64}".encode("ascii")
            public_key.verify(der_signature, signing_input, ec.ECDSA(hashes.SHA256()))
            return True
        except Exception as e:
            logger.debug(f"JWS verification failed: {e}")
            return False


# Singleton active signer instance
signer: DocumentSigner = ES256Signer(
    private_key_pem=settings.SERVER_ES256_PRIVATE_KEY_PEM,
    kid=settings.ACTIVE_KID
)
