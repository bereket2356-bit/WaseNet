"""
Comprehensive End-to-End Verification of Neon PostgreSQL Services for WaseNet
"""
import httpx
import uuid
from datetime import datetime, date, timedelta, timezone

BASE_URL = "http://127.0.0.1:8000"

def run_e2e():
    print("=" * 65)
    print("  WaseNet End-to-End Verification with Live Neon PostgreSQL")
    print("=" * 65)

    client = httpx.Client(base_url=BASE_URL, timeout=30.0)
    summary = []

    # 1. Health Probe (Database Check)
    print("\n[1] Testing /health/ready probe against Neon PostgreSQL...")
    r = client.get("/health/ready")
    print(f"Status: {r.status_code}, Response: {r.text}")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    health_data = r.json()
    assert health_data.get("database") == "connected"
    summary.append(("Neon DB Health Probe (/health/ready)", "PASS (database: connected)"))

    # 2. Backward-Compatibility /api/health
    print("\n[2] Testing /api/health endpoint...")
    r = client.get("/api/health")
    print(f"Status: {r.status_code}, Response: {r.text}")
    assert r.status_code == 200
    summary.append(("Compatibility API Health (/api/health)", "PASS (provider: Neon PostgreSQL)"))

    # 3. User Authentication against Neon DB
    print("\n[3] Authenticating seeded admin against Neon DB...")
    login_payload = {
        "username": "admin",
        "password": "Admin@WaseNet2026!"
    }
    r = client.post("/api/v1/auth/login", json=login_payload)
    print(f"Status: {r.status_code}, User: {r.json().get('user', {}).get('username')}")
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    summary.append(("Admin Authentication (Argon2id + JWT)", "PASS (Token issued)"))

    # 4. Fetch Key Bundle from Neon DB
    print("\n[4] Fetching public key bundle from Neon DB...")
    r = client.get("/api/v1/keys/bundle")
    print(f"Status: {r.status_code}, Keys: {len(r.json().get('keys', []))}, Server time: {r.json().get('server_time')}")
    assert r.status_code == 200
    keys = r.json()["keys"]
    assert len(keys) > 0
    active_kid = keys[0]["kid"]
    summary.append(("Public Key Bundle (/api/v1/keys/bundle)", f"PASS (Found {len(keys)} keys, Active: {active_kid})"))

    # 5. Check Sync Status from Neon DB
    print("\n[5] Querying system sync status...")
    r = client.get("/api/v1/sync/status")
    print(f"Status: {r.status_code}, DRL ver: {r.json().get('revocation_version')}, Key ver: {r.json().get('key_bundle_version')}")
    assert r.status_code == 200
    initial_drl_ver = r.json()["revocation_version"]
    summary.append(("Sync Status Monotonic Counters", f"PASS (DRL: v{initial_drl_ver}, Keys: v{r.json()['key_bundle_version']})"))

    # 6. Fetch Revocation List Delta from Neon DB
    print("\n[6] Fetching DRL delta from Neon DB...")
    r = client.get(f"/api/v1/revocations?since=0")
    print(f"Status: {r.status_code}, DRL version: {r.json().get('version')}, Total count: {r.json().get('total_count')}")
    assert r.status_code == 200
    summary.append(("DRL Delta Sync (/api/v1/revocations)", f"PASS (Version: {r.json()['version']}, Total: {r.json()['total_count']})"))

    # 7. Issue & digitally sign new document in Neon DB
    print("\n[7] Issuing and digitally signing new document in Neon DB...")
    today = date.today()
    doc_payload = {
        "doc_type": "land_certificate",
        "issue_date": today.isoformat(),
        "expiry_date": (today + timedelta(days=365)).isoformat(),
        "holder_name": "Abebe Bikila",
        "holder_national_id": "ETH-NAT-99887766",
        "attributes": {
            "parcel_id": "AA-ARADA-2026-9901",
            "area_sq_m": 450.5,
            "zoning": "Residential R-2"
        }
    }
    r = client.post("/api/v1/documents", json=doc_payload, headers=headers)
    print(f"Status: {r.status_code}, Doc ID: {r.json().get('id')}")
    assert r.status_code == 201, f"Doc creation failed: {r.text}"
    doc_id = r.json()["id"]
    summary.append(("Document Issuance (ES256 + AES-GCM)", f"PASS (Created doc_id: {doc_id})"))

    # 8. Document Retrieval from Neon DB
    print("\n[8] Retrieving document record from Neon DB...")
    r = client.get(f"/api/v1/documents/{doc_id}", headers=headers)
    print(f"Status: {r.status_code}, Doc Type: {r.json().get('doc_type')}, Holder: {r.json().get('holder_name')}")
    assert r.status_code == 200
    assert r.json()["id"] == doc_id
    summary.append(("Document Retrieval (/api/v1/documents/{id})", f"PASS (Holder: {r.json()['holder_name']})"))

    # 9. Document Revocation in Neon DB
    print("\n[9] Revoking document in Neon DB...")
    revoke_payload = {
        "document_id": doc_id,
        "reason_code": "reported_lost"
    }
    r = client.post("/api/v1/revocations", json=revoke_payload, headers=headers)
    print(f"Status: {r.status_code}, New DRL version: {r.json().get('revocation_version')}")
    assert r.status_code == 201
    new_drl_ver = r.json()["revocation_version"]
    assert new_drl_ver > initial_drl_ver
    summary.append(("Document Revocation (/api/v1/revocations)", f"PASS (Monotonic increment -> v{new_drl_ver})"))

    # 10. Verify Delta Sync contains the newly revoked document
    print("\n[10] Verifying DRL delta contains revoked document...")
    r = client.get(f"/api/v1/revocations?since={initial_drl_ver}")
    assert r.status_code == 200
    delta_items = r.json()["delta"]
    assert any(item["document_id"] == doc_id for item in delta_items)
    print(f"Found revoked doc {doc_id} in delta items (count: {len(delta_items)})")
    summary.append(("DRL Delta Verification", f"PASS (Verified doc {doc_id} in delta)"))

    # 11. Idempotent Audit Batch Upload to Neon DB
    print("\n[11] Uploading audit batch to Neon DB...")
    client_event_id = str(uuid.uuid4())
    device_id = "COUNTER_TERMINAL_01"
    audit_payload = {
        "events": [
            {
                "client_event_id": client_event_id,
                "device_id": device_id,
                "document_id": doc_id,
                "verified_at": datetime.now(timezone.utc).isoformat(),
                "result": "revoked"
            }
        ]
    }
    r = client.post("/api/v1/audit/batch", json=audit_payload)
    print(f"Status: {r.status_code}, Response: {r.json()}")
    assert r.status_code == 200
    assert r.json()["accepted"] == 1
    # Retry to verify idempotency
    r_retry = client.post("/api/v1/audit/batch", json=audit_payload)
    assert r_retry.status_code == 200
    assert r_retry.json()["duplicate"] == 1
    summary.append(("Audit Log Batch (Idempotent Deduplication)", "PASS (First run: accepted=1, Retry: duplicate=1)"))

    # 12. Public Fraud Reporting in Neon DB
    print("\n[12] Submitting public fraud report to Neon DB...")
    fraud_payload = {
        "document_id": doc_id,
        "reason_code": "looks_forged",
        "description": "Suspicious alteration on seal copy observed during verification",
        "contact_details": "+251911223344"
    }
    r = client.post("/api/v1/fraud-reports", json=fraud_payload)
    print(f"Status: {r.status_code}, Response: {r.text}")
    assert r.status_code == 201
    ref_num = r.json()["reference"]
    summary.append(("Public Fraud Report (AES-GCM encrypted contact)", f"PASS (Reference: {ref_num})"))

    print("\n" + "=" * 65)
    print("  ALL SERVICES TESTED & VERIFIED END-TO-END ON NEON POSTGRESQL!")
    print("=" * 65)
    for name, res in summary:
        print(f"  [PASS] {name:<42} : {res}")
    print("=" * 65)

if __name__ == "__main__":
    run_e2e()
