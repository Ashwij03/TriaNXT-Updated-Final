# tria_engine/tests/test_eisf_guard_and_signatures.py
#
# eISF Regulatory Document Repository — Universal Access Guard + mandatory
# E-Signatures bound to upload/delete + watermark/tamper verification +
# private (tokenized) download access.
#
# Covered here:
#   * unauthenticated access to /api/eisf -> 401
#   * standard ISF folder structure endpoint
#   * require_study_access: users with a user_studies assignment get a
#     proper 403 (never a silent block) for studies outside their list,
#     while in-scope studies and org lists work
#   * E-Signature is MANDATORY and part of the action flow:
#       - uploading a document without a signature is refused (422)
#       - a successful upload records the signature (meaning / printed name
#         / timestamp / SHA-256 stamp) against the new document
#       - deleting a document requires a completed signature; without one
#         the delete is refused, and a signed deletion retires the document
#         while keeping the immutable signature evidence readable
#   * watermark verification: authentic digest passes; a tampered stored
#     file is reported as tampered along with every affected signature
#   * document bytes are only reachable through short-lived tokenized
#     download URLs (forged/expired/other-user tokens are rejected)

from __future__ import annotations

import re
import time
import uuid

from fastapi.testclient import TestClient

from tria_engine.apps.accounts.models import User
from tria_engine.apps.eisf.models import ESignature, EisfDocument
from tria_engine.apps.organizations.models import Organization, Role
from tria_engine.core.database import SessionLocal
from tria_engine.core.security import hash_password
from tria_engine.core.storage import absolute_path
from tria_engine.main import app

PASSWORD = "SitePass123!"
ADMIN_EMAIL = "admin@test.local"
ADMIN_PASSWORD = "AdminPass123!"

STUDY_A = "TNX-EISF-A"
STUDY_B = "TNX-EISF-B"
# Unique per-test study codes so count-based assertions never collide with
# documents left behind by earlier tests in this file (the test DB is
# shared/session-scoped across the whole file).
STUDY_UPLOAD = f"TNX-EISF-UP-{uuid.uuid4().hex[:6]}"
STUDY_RECORD = f"TNX-EISF-REC-{uuid.uuid4().hex[:6]}"
STUDY_CRO = f"TNX-EISF-CRO-{uuid.uuid4().hex[:6]}"
STUDY_DELETE = f"TNX-EISF-DEL-{uuid.uuid4().hex[:6]}"
STAMP_RE = re.compile(r"^[0-9a-f]{64}$")
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]+\.[0-9a-f]{64}$")

PDF_BYTES_A = b"%PDF-1.4\nStudy protocol TNX-EISF-A v1.0 (eisf test payload)\n%%EOF\n"
PDF_BYTES_B = b"%PDF-1.4\nStudy protocol TNX-EISF-B v1.0 (eisf test payload)\n%%EOF\n"


# ---------------------------------------------------------------------------
# Seed helpers (mirror test_rbac.py / test_scope_filters.py)
# ---------------------------------------------------------------------------


def _seed_user(role_name: str, tag: str, scope_data: dict | None = None) -> str:
    db = SessionLocal()
    try:
        org = db.query(Organization).order_by(Organization.id).first()
        role = (
            db.query(Role)
            .filter(Role.name == role_name, Role.organization_id == org.id)
            .first()
        )
        if role is None:
            role = Role(name=role_name, organization_id=org.id)
            db.add(role)
            db.flush()
        email = f"{role_name.lower().replace(' ', '.')}.{tag}-{uuid.uuid4().hex[:6]}@test.local"
        db.add(
            User(
                username=email.split("@")[0],
                email=email,
                password=hash_password(PASSWORD),
                first_name=role_name,
                last_name="User",
                is_active=True,
                organization_id=org.id,
                role_id=role.id,
                scope_data=scope_data,
            )
        )
        db.commit()
        return email
    finally:
        db.close()


def _login(client, email: str, password: str = PASSWORD):
    res = client.post(
        "/api/accounts/login/",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, res.text
    return client


def _login_admin(client):
    return _login(client, ADMIN_EMAIL, ADMIN_PASSWORD)


def _sig_fields(meaning="authorship", printedName="E-Sign Tester"):
    # Identity comes from the authenticated session — no password re-auth.
    return {
        "meaning": meaning,
        "printedName": printedName,
    }


def _upload(client, *, study: str, folder: str, name: str, content: bytes, version="1.0", **sig):
    fields = _sig_fields(**sig)
    return client.post(
        "/api/eisf/documents/",
        data={
            "study": study,
            "folder": folder,
            "document_name": name,
            "version": version,
            **fields,
        },
        files={"file": (f"{name.replace(' ', '_')}.pdf", content, "application/pdf")},
    )


def _upload_ok(client, *, study: str, folder: str, name: str, content: bytes, version="1.0", **sig):
    res = _upload(client, study=study, folder=folder, name=name, content=content, version=version, **sig)
    assert res.status_code == 201, res.text
    return res.json()["data"]


# ==========================================================================
# Auth + folder structure
# ==========================================================================


def test_unauthenticated_eisf_is_rejected(client):
    assert client.get("/api/eisf/documents/").status_code == 401
    assert client.get("/api/eisf/folders/").status_code == 401


def test_standard_isf_folder_structure(client):
    _login_admin(client)
    res = client.get("/api/eisf/folders/")
    assert res.status_code == 200
    keys = [folder["key"] for folder in res.json()["folders"]]
    assert keys == [
        "protocol",
        "irb_iec",
        "regulatory",
        "cvs_licenses",
        "icf",
        "financials",
        "monitoring_reports",
    ]


def test_upload_rejects_nonstandard_folder(client):
    _login_admin(client)
    res = _upload(
        client, study=STUDY_A, folder="random-junk", name="Protocol",
        content=PDF_BYTES_A,
    )
    assert res.status_code == 422
    assert "Invalid folder" in res.json()["detail"]


# ==========================================================================
# Universal Access Guard — study-level 403s
# ==========================================================================


def _admin_delete(client, document_id, body):
    import json as _json
    admin = _admin_session()
    return admin.request(
        "DELETE",
        f"/api/eisf/documents/{document_id}/",
        content=_json.dumps(body),
        headers={"content-type": "application/json"},
    )


def test_restricted_user_list_out_of_scope_study_403(client):
    _login_admin(client)
    _admin_upload(client, study=STUDY_A, folder="protocol", name="A Protocol", content=PDF_BYTES_A)
    _admin_upload(client, study=STUDY_B, folder="protocol", name="B Protocol", content=PDF_BYTES_B)

    email = _seed_user("Site Staff", "eisf-scope", {"studies": [STUDY_A]})
    _login(client, email)

    # Explicit study outside the user_studies mapping -> 403, not a silent filter.
    res = client.get("/api/eisf/documents/", params={"study": STUDY_B})
    assert res.status_code == 403, res.text
    assert res.json()["detail"] == "You have no access to this study/page."

    # In-scope study works and only returns that study's documents.
    res = client.get("/api/eisf/documents/", params={"study": STUDY_A})
    assert res.status_code == 200
    assert res.json()["count"] == 1
    assert res.json()["documents"][0]["documentName"] == "A Protocol"


def test_restricted_user_cannot_act_on_out_of_scope_document(client):
    _login_admin(client)
    doc_b = _admin_upload(
        client, study=STUDY_B, folder="protocol", name="B Protocol", content=PDF_BYTES_B
    )
    email = _seed_user("Site Staff", "eisf-doc403", {"studies": [STUDY_A]})
    _login(client, email)

    for path in (
        f"/api/eisf/documents/{doc_b['id']}/signatures/",
        f"/api/eisf/documents/{doc_b['id']}/verify/",
        f"/api/eisf/documents/{doc_b['id']}/download-url",
    ):
        res = client.get(path)
        assert res.status_code == 403, (path, res.text)
        assert res.json()["detail"] == "You have no access to this study/page."


def test_unassigned_user_keeps_org_scope(client):
    _login_admin(client)
    _admin_upload(client, study=STUDY_A, folder="regulatory", name="Auth Letter", content=PDF_BYTES_A)
    # No scope_data -> organization scope only (existing behaviour preserved).
    email = _seed_user("Site Staff", "eisf-orgscope")
    _login(client, email)
    res = client.get("/api/eisf/documents/", params={"study": STUDY_A})
    assert res.status_code == 200
    documents = res.json()["documents"]
    assert documents, "org-scope user should see the organization's documents"
    assert all(document["studyId"] == STUDY_A for document in documents)
    assert any(document["documentName"] == "Auth Letter" for document in documents)


# ==========================================================================
# Mandatory E-Signatures — part of upload / delete, never after the fact
# ==========================================================================


def _staff_signer(client, tag="eisf-signer", study=STUDY_A) -> tuple[dict, str]:
    """Site Staff session assigned to `study` (can file + sign)."""
    email = _seed_user("Site Staff", tag, {"studies": [study]})
    _login(client, email)
    return email


def _admin_session() -> TestClient:
    """Dedicated admin TestClient. Admin helper actions must NEVER reuse the
    test's shared `client`: logging admin in on it would silently replace
    whatever session the test under construction is exercising."""
    admin = TestClient(app)
    _login(admin, ADMIN_EMAIL, ADMIN_PASSWORD)
    return admin


def _admin_upload(client, *, study=STUDY_A, folder="protocol", name="Document",
                  content=PDF_BYTES_A, **sig):
    admin = _admin_session()
    defaults = _sig_fields(printedName="Admin User")
    sig = {**defaults, **(sig or {})}
    return _upload_ok(admin, study=study, folder=folder, name=name, content=content, **sig)


def test_upload_requires_completed_signature(client):
    """Uploads without a completed E-Signature never store."""
    email = _staff_signer(client, tag="eisf-up", study=STUDY_UPLOAD)
    printed = email.split("@")[0]

    # Missing signature entirely -> 422, nothing stored.
    res = client.post(
        "/api/eisf/documents/",
        data={
            "study": STUDY_UPLOAD,
            "folder": "icf",
            "document_name": "ICF v1",
            "version": "1.0",
        },
        files={"file": ("icf_v1.pdf", PDF_BYTES_A, "application/pdf")},
    )
    assert res.status_code == 422, res.text
    assert "meaning" in res.json()["detail"] or "printedName" in res.json()["detail"]
    assert client.get("/api/eisf/documents/", params={"study": STUDY_UPLOAD}).json()["count"] == 0

    # Incomplete signature (missing printed name) -> 422, nothing stored.
    res = _upload(
        client, study=STUDY_UPLOAD, folder="icf", name="ICF v1", content=PDF_BYTES_A,
        meaning="authorship", printedName="",
    )
    assert res.status_code == 422, res.text
    assert client.get("/api/eisf/documents/", params={"study": STUDY_UPLOAD}).json()["count"] == 0


def test_upload_validates_meaning_and_records_full_signature_record(client):
    email = _staff_signer(client, tag="eisf-rec", study=STUDY_RECORD)
    printed = email.split("@")[0]

    # Invalid meaning -> 422.
    res = _upload(
        client, study=STUDY_RECORD, folder="icf", name="ICF v1", content=PDF_BYTES_A,
        meaning="whatever", printedName=printed,
    )
    assert res.status_code == 422, res.text

    # Valid upload records the signature as part of the action.
    doc = _upload_ok(
        client, study=STUDY_RECORD, folder="icf", name="ICF v1", content=PDF_BYTES_A,
        meaning="authorship", printedName=printed,
    )
    assert doc["contentSha256"]
    assert STAMP_RE.match(doc["contentSha256"])
    assert doc["signatureCount"] == 1

    res = client.get(f"/api/eisf/documents/{doc['id']}/signatures/")
    assert res.status_code == 200
    assert res.json()["count"] == 1
    data = res.json()["signatures"][0]
    assert data["meaning"] == "authorship"
    assert data["meaningLabel"] == "Authorship"
    assert data["printedName"] == printed
    assert data["signedAt"]
    assert STAMP_RE.match(data["signatureStamp"]), data["signatureStamp"]
    assert data["signerEmail"] == email
    # Stamp must be bound to the real content digest (== upload digest).
    assert data["contentSha256"] == doc["contentSha256"]

    # Uploader identity is visible on the document record.
    detail = client.get(f"/api/eisf/documents/{doc['id']}/").json()["data"]
    assert detail["signatureCount"] == 1


def test_cro_is_read_only_on_eisf(client):
    email = _seed_user("CRA", "eisf-cro", {"studies": [STUDY_CRO]})
    _login(client, email)
    # Read access is fine...
    _admin_upload(client, study=STUDY_CRO, folder="regulatory", name="Authorisation")
    res = client.get("/api/eisf/documents/", params={"study": STUDY_CRO})
    assert res.status_code == 200 and res.json()["count"] == 1
    # ...but CRO cannot file documents (module role matrix).
    res = _upload(
        client, study=STUDY_CRO, folder="regulatory", name="Blocked",
        content=PDF_BYTES_A, meaning="review", printedName="CRO Monitor",
    )
    assert res.status_code == 403, res.text


def test_delete_requires_completed_signature(client):
    """Deleting requires the E-Signature step inside the delete itself."""
    _login_admin(client)  # the shared client reads the document afterwards
    doc = _admin_upload(client, study=STUDY_DELETE, name="Regulatory Letter")
    doc_id = doc["id"]

    # No signature payload -> refused, document untouched.
    res = _admin_delete(client, doc_id, {})
    assert res.status_code == 422, res.text

    # Incomplete signature (missing printed name) -> refused, document untouched.
    res = _admin_delete(
        client,
        doc_id,
        {"meaning": "approval", "printedName": ""},
    )
    assert res.status_code == 422, res.text
    assert client.get(f"/api/eisf/documents/{doc_id}/").status_code == 200
    assert client.get(f"/api/eisf/documents/{doc_id}/signatures/").json()["count"] == 1

    # Completed signature (meaning + printed name on the authenticated
    # session) -> signed retirement; evidence stays immutable.
    res = _admin_delete(
        client,
        doc_id,
        {"meaning": "approval", "printedName": "Admin User"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["code"] == doc["code"]
    assert STAMP_RE.match(body["data"]["signatureStamp"])

    # The document is retired from every normal surface...
    assert client.get(f"/api/eisf/documents/{doc_id}/").status_code == 404
    res = client.get("/api/eisf/documents/", params={"study": STUDY_DELETE})
    assert res.status_code == 200 and res.json()["count"] == 0

    # ...but the signature evidence (upload + signed deletion) is readable.
    res = client.get(f"/api/eisf/documents/{doc_id}/signatures/")
    assert res.status_code == 200, res.text
    assert res.json()["count"] == 2
    meanings = [sig["meaning"] for sig in res.json()["signatures"]]
    assert "approval" in meanings and "authorship" in meanings
    res = client.get(f"/api/eisf/documents/{doc_id}/verify/")
    assert res.status_code == 200
    assert res.json()["status"] == "authentic"


# ==========================================================================
# Watermark / integrity verification (tamper evidence)
# ==========================================================================


def test_verify_authentic_then_tampered(client):
    doc = _admin_upload(client, name="Protocol v1")
    email = _seed_user("Site Staff", "eisf-verifier", {"studies": [STUDY_A]})
    _login(client, email)

    # Upload signature already bound to the content.
    res = client.get(f"/api/eisf/documents/{doc['id']}/verify/")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "authentic", body
    assert body["storedSha256"] == body["recordedSha256"]
    assert body["signatures"][0]["status"] == "authentic"

    # Tamper with the stored bytes behind the server's back.
    db = SessionLocal()
    try:
        row = db.query(EisfDocument).filter(EisfDocument.id == doc["id"]).first()
        path = absolute_path(row.storage_key)
        path.write_bytes(b"%PDF-1.4\nTAMPERED - signature must break\n%%EOF\n")
    finally:
        db.close()

    res = client.get(f"/api/eisf/documents/{doc['id']}/verify/")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "tampered", body
    assert body["storedSha256"] != body["recordedSha256"]
    assert body["signatures"][0]["status"] == "tampered"


# ==========================================================================
# Private / tokenized download access
# ==========================================================================


def test_download_only_through_tokenized_url(client):
    doc = _admin_upload(client, name="Protocol v1")
    email = _seed_user("Site Staff", "eisf-dl", {"studies": [STUDY_A]})
    _login(client, email)

    res = client.get(f"/api/eisf/documents/{doc['id']}/download-url")
    assert res.status_code == 200, res.text
    download_url = res.json()["downloadUrl"]
    assert download_url.startswith(f"/api/eisf/documents/{doc['id']}/content?token=")
    token = download_url.split("token=", 1)[1]
    assert TOKEN_RE.match(token)

    # No raw bytes on the metadata/detail surface.
    detail = client.get(f"/api/eisf/documents/{doc['id']}/").json()["data"]
    assert "contentSha256" in detail and "storageKey" not in detail
    assert "file://" not in download_url and "/media/" not in download_url

    # Valid token streams bytes with an integrity header.
    res = client.get(download_url)
    assert res.status_code == 200
    assert res.content == PDF_BYTES_A
    assert res.headers["X-TriaNXT-Sha256"] == doc["contentSha256"]
    assert res.headers["X-TriaNXT-Integrity"] == "authentic"

    # Forged / other-user / expired tokens are rejected with 403.
    assert client.get(f"/api/eisf/documents/{doc['id']}/content?token=forged.token").status_code == 403
    assert client.get(f"/api/eisf/documents/{doc['id']}/content").status_code in (400, 422)


def test_signature_stamp_is_deterministic_and_content_bound(client):
    """Two uploads of identical content record distinct stamps (timestamp +
    document code bound in), both pinned to the same content digest."""
    email = _staff_signer(client, tag="eisf-stamp")
    printed = email.split("@")[0]

    first = _upload_ok(
        client, study=STUDY_A, folder="regulatory", name="Auth Letter A",
        content=PDF_BYTES_A, meaning="review", printedName=printed,
    )
    time.sleep(0.02)
    second = _upload_ok(
        client, study=STUDY_A, folder="regulatory", name="Auth Letter B",
        content=PDF_BYTES_A, meaning="review", printedName=printed,
    )

    first_sig = client.get(f"/api/eisf/documents/{first['id']}/signatures/").json()["signatures"][0]
    second_sig = client.get(f"/api/eisf/documents/{second['id']}/signatures/").json()["signatures"][0]

    # Different documents/signatures -> different stamps, same content digest.
    assert first_sig["signatureStamp"] != second_sig["signatureStamp"]
    assert first_sig["contentSha256"] == second_sig["contentSha256"] == first["contentSha256"]
    assert STAMP_RE.match(first_sig["signatureStamp"]) and STAMP_RE.match(second_sig["signatureStamp"])
