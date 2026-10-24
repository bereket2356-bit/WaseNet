"""
Integration Tests (Deliverable 8 & Test Plan)
Comprehensive API and Database Integration Suite:
- User signup and administrator approval workflow
- Login with Argon2id and 8-hour JWT issuance
- Server-side role enforcement (non-admin refused on admin routes)
- Document issuance with ES256 signing and AES-256-GCM holder encryption
- Idempotent offline queue synchronization (second run changes nothing)
- Document revocation with monotonic version counter increments & delta queries
- Idempotent audit batch upload (second run reports duplicate events)
- Public fraud report submission with generated reference (FR-XXXXXXXX)
- Sync status and Health probes (liveness & readiness)
"""
import uuid
from datetime import date
import pytest


def test_user_signup_and_approval_workflow(client, admin_token):
    """
    Tests registration of an administrator account (pending approval),
    enforces rejection of pending logins, and tests admin approval workflow.
    """
    # 1. Register new admin account
    reg_payload = {
        "username": "candidate_admin",
        "password": "SecurePassword2026!#",
        "full_name": "New Candidate Admin",
        "organization": "Regional Records Board",
        "role": "administrator"
    }
    reg_res = client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    user_data = reg_res.json()
    assert user_data["username"] == "candidate_admin"
    assert user_data["status"] == "pending"
    candidate_id = user_data["id"]

    # 2. Login attempt with pending account MUST fail with generic error
    login_res = client.post(
        "/api/v1/auth/login",
        json={"username": "candidate_admin", "password": "SecurePassword2026!#"}
    )
    assert login_res.status_code == 401
    assert login_res.json()["error"]["message"] == "Invalid username or password"

    # 3. Existing administrator lists pending users
    pending_res = client.get(
        "/api/v1/users/pending",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert pending_res.status_code == 200
    pending_ids = [u["id"] for u in pending_res.json()]
    assert candidate_id in pending_ids

    # 4. Administrator approves user
    approve_res = client.post(
        f"/api/v1/users/{candidate_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "active"

    # 5. Now approved user can log in successfully
    active_login_res = client.post(
        "/api/v1/auth/login",
        json={"username": "candidate_admin", "password": "SecurePassword2026!#"}
    )
    assert active_login_res.status_code == 200
    token_json = active_login_res.json()
    assert "access_token" in token_json
    assert token_json["expires_in"] == 8 * 3600


def test_non_administrator_refused_on_admin_routes(client, issuer_token):
    """
    Verifies that non-administrator accounts (issuers) are strictly refused
    with HTTP 403 Forbidden on all administrative routes.
    """
    admin_routes = [
        ("GET", "/api/v1/keys", None),
        ("POST", "/api/v1/keys", {
            "kid": "test-kid",
            "algorithm": "ES256",
            "public_key_jwk": {"kty": "EC", "crv": "P-256", "x": "123", "y": "456"},
            "status": "active"
        }),
        ("POST", "/api/v1/revocations", {
            "document_id": str(uuid.uuid4()),
            "reason_code": "issued_in_error"
        }),
        ("GET", "/api/v1/users/pending", None),
        ("GET", "/api/v1/issuers", None),
        ("POST", "/api/v1/issuers", {"name": "Office", "issuer_code": "ET-OFF-99"}),
        ("GET", "/api/v1/fraud-reports", None)
    ]

    for method, path, body in admin_routes:
        headers = {"Authorization": f"Bearer {issuer_token}"}
        if method == "GET":
            res = client.get(path, headers=headers)
        elif method == "POST":
            res = client.post(path, json=body, headers=headers)
        
        assert res.status_code == 403, f"Expected 403 on {method} {path}, got {res.status_code}"
        assert res.json()["error"]["code"] == "FORBIDDEN"


def test_document_issuance_and_retrieval(client, issuer_token, test_issuer):
    """
    Tests document issuance (FR-2.1 to FR-2.4):
    Validates payload, creates ES256 signature, stores encrypted holder data,
    and checks document retrieval.
    """
    payload = {
        "doc_type": "land_certificate",
        "holder_name": "Kassahun Haile",
        "holder_national_id": "ETH-NAT-99081234",
        "issue_date": "2026-03-01",
        "expiry_date": "2031-03-01",
        "attributes": {
            "subcity": "Bole",
            "woreda": "03",
            "plot_number": "BOL-990-2026"
        }
    }

    headers = {"Authorization": f"Bearer {issuer_token}"}
    res = client.post("/api/v1/documents", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()

    doc_id = data["id"]
    assert data["doc_type"] == "land_certificate"
    assert data["holder_name"] == "Kassahun Haile"
    assert "qr_payload" in data
    assert len(data["qr_payload"].split(".")) == 3  # JWS format

    # Fetch document by ID
    get_res = client.get(f"/api/v1/documents/{doc_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == doc_id

    # List documents for this issuer
    list_res = client.get("/api/v1/documents?mine=true", headers=headers)
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert any(d["id"] == doc_id for d in items)


def test_offline_queue_sync_idempotency(client, issuer_token, test_issuer):
    """
    Tests offline issuance queue batch synchronization (FR-2.5):
    Sync must be strictly idempotent. A second sync of the same batch reports
    'already_synced' and duplicates without creating errors or duplicate entries.
    """
    offline_doc_id = uuid.uuid4()
    batch_payload = {
        "documents": [
            {
                "id": str(offline_doc_id),
                "doc_type": "cooperative_credential",
                "kid": "wase-aa-2026-01",
                "issue_date": "2026-02-01",
                "expiry_date": "2028-02-01",
                "payload_canonical": '{"coop_id":"COOP-1","doc_id":"' + str(offline_doc_id) + '"}',
                "jws": "header.payload.signature",
                "payload_sha256": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                "holder_name": "Tigist Alemu",
                "holder_national_id": "ETH-NAT-55667788"
            }
        ]
    }

    headers = {"Authorization": f"Bearer {issuer_token}"}

    # 1. First sync run
    res1 = client.post("/api/v1/queue/sync", json=batch_payload, headers=headers)
    assert res1.status_code == 200
    json1 = res1.json()
    assert json1["synced_count"] == 1
    assert json1["duplicate_count"] == 0
    assert json1["results"][0]["status"] == "synced"

    # 2. Second sync run with identical payload
    res2 = client.post("/api/v1/queue/sync", json=batch_payload, headers=headers)
    assert res2.status_code == 200
    json2 = res2.json()
    assert json2["synced_count"] == 0
    assert json2["duplicate_count"] == 1
    assert json2["results"][0]["status"] == "already_synced"


def test_revocation_and_delta_sync(client, admin_token, issuer_token):
    """
    Tests document revocation (FR-4.4) and delta updates (FR-4.2):
    1. Issue a document.
    2. Revoke it with reason 'reported_lost'.
    3. Verify monotonic version increment in DRL.
    4. Query GET /revocations?since=<version> and confirm delta update.
    5. Query with latest version and confirm empty delta.
    """
    # 1. Issue document
    headers_issuer = {"Authorization": f"Bearer {issuer_token}"}
    doc_res = client.post(
        "/api/v1/documents",
        json={
            "doc_type": "birth_record",
            "holder_name": "Yonas Solomon",
            "holder_national_id": "ETH-NAT-77889900",
            "issue_date": "2026-01-01",
            "expiry_date": "2036-01-01",
            "attributes": {"registration_office": "Addis Ababa Woreda 07"}
        },
        headers=headers_issuer
    )
    assert doc_res.status_code == 201
    doc_id = doc_res.json()["id"]

    # Read current DRL version
    sync_res = client.get("/api/v1/sync/status")
    initial_drl_ver = sync_res.json()["revocation_version"]

    # 2. Revoke document as administrator
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    revoke_res = client.post(
        "/api/v1/revocations",
        json={
            "document_id": doc_id,
            "reason_code": "reported_lost"
        },
        headers=headers_admin
    )
    assert revoke_res.status_code == 201
    rev_json = revoke_res.json()
    new_version = rev_json["revocation_version"]
    assert new_version == initial_drl_ver + 1

    # 3. Delta query since initial version
    delta_res = client.get(f"/api/v1/revocations?since={initial_drl_ver}")
    assert delta_res.status_code == 200
    delta_json = delta_res.json()
    assert delta_json["version"] == new_version
    assert any(item["document_id"] == doc_id for item in delta_json["delta"])

    # 4. Delta query since new version (should be empty delta)
    latest_delta_res = client.get(f"/api/v1/revocations?since={new_version}")
    assert latest_delta_res.status_code == 200
    assert len(latest_delta_res.json()["delta"]) == 0


def test_audit_batch_upload_idempotency(client):
    """
    Tests verifier audit log batch uploads (FR-5.1, FR-5.2):
    Composite key (client_event_id, device_id) ensures retried uploads report duplicates.
    """
    event_id = str(uuid.uuid4())
    device_id = "device_scanner_bole_01"

    batch = {
        "events": [
            {
                "client_event_id": event_id,
                "device_id": device_id,
                "document_id": str(uuid.uuid4()),
                "verified_at": "2026-03-15T10:30:00Z",
                "result": "valid"
            }
        ]
    }

    # First upload
    res1 = client.post("/api/v1/audit/batch", json=batch)
    assert res1.status_code == 200
    assert res1.json()["accepted"] == 1
    assert res1.json()["duplicate"] == 0

    # Second upload (retry)
    res2 = client.post("/api/v1/audit/batch", json=batch)
    assert res2.status_code == 200
    assert res2.json()["accepted"] == 0
    assert res2.json()["duplicate"] == 1


def test_public_fraud_reporting(client, admin_token):
    """
    Tests public fraud report submission (FR-R1):
    Generates reference FR-XXXXXXXX, encrypts contact details, and allows admin review.
    """
    doc_id = str(uuid.uuid4())
    report_data = {
        "document_id": doc_id,
        "reason_code": "signature_failed",
        "description": "Scanned QR code produced invalid signature at municipal checkpoint.",
        "contact_details": "citizen.informant@example.et"
    }

    # Public submission (no authentication)
    res = client.post("/api/v1/fraud-reports", json=report_data)
    assert res.status_code == 201
    resp_json = res.json()
    ref = resp_json["reference"]
    assert ref.startswith("FR-")
    assert len(ref) == 11  # FR- + 8 alphanumeric

    # Administrator reviews reports
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    list_res = client.get("/api/v1/fraud-reports", headers=headers_admin)
    assert list_res.status_code == 200
    reports = list_res.json()["items"]
    target_report = next((r for r in reports if r["reference"] == ref), None)
    assert target_report is not None
    assert target_report["status"] == "new"

    # Administrator updates status to 'reviewing'
    patch_res = client.patch(
        f"/api/v1/fraud-reports/{target_report['id']}",
        json={"status": "reviewing"},
        headers=headers_admin
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "reviewing"


def test_sync_status_and_health_probes(client):
    """
    Tests sync status endpoint and health probes (live and ready).
    """
    # Sync status
    sync_res = client.get("/api/v1/sync/status")
    assert sync_res.status_code == 200
    sync_data = sync_res.json()
    assert "revocation_version" in sync_data
    assert "key_bundle_version" in sync_data
    assert "server_time" in sync_data

    # Liveness probe
    live_res = client.get("/health/live")
    assert live_res.status_code == 200
    assert live_res.json()["status"] == "alive"

    # Readiness probe
    ready_res = client.get("/health/ready")
    assert ready_res.status_code == 200
    assert ready_res.json()["status"] == "ready"
    assert ready_res.json()["database"] == "connected"
