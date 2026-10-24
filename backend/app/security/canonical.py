"""
Deterministic JSON Canonicalization and SHA-256 Digesting
Implements RFC 8785 (JSON Canonicalization Scheme - JCS) principles for WaseNet credentials.
Guarantees identical byte output for identical structured input.
"""
import hashlib
import json
from typing import Any


def canonicalize_json(data: Any) -> str:
    """
    Produces deterministic, canonical JSON representation:
    - Recursively sorts dictionary keys in lexicographical ASCII order
    - Eliminates all whitespace around delimiters (',' and ':')
    - Enforces consistent UTF-8 serialization
    """
    if data is None or isinstance(data, (bool, int, float, str)):
        return json.dumps(data, separators=(',', ':'), ensure_ascii=False)

    if isinstance(data, list):
        items = [canonicalize_json(item) for item in data]
        return "[" + ",".join(items) + "]"

    if isinstance(data, dict):
        sorted_keys = sorted(data.keys())
        members = [
            f"{json.dumps(k, ensure_ascii=False)}:{canonicalize_json(data[k])}"
            for k in sorted_keys
        ]
        return "{" + ",".join(members) + "}"

    # Fallback to standard sorted serializer
    return json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def compute_sha256_digest(canonical_str: str) -> str:
    """
    Computes hex-encoded SHA-256 digest of the canonical JSON string.
    """
    hasher = hashlib.sha256()
    hasher.update(canonical_str.encode("utf-8"))
    return hasher.hexdigest()
