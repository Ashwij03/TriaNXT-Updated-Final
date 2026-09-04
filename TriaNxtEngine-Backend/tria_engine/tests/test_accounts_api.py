# End-to-end tests for the migrated /api/accounts/ endpoints. Responses
# are asserted against the DRF-era contracts (status codes, envelope keys,
# message strings).

import io
import time


def _unique(tag):
    return f"{tag}{int(time.time() * 1000)}"


def _register(client, tag="u"):
    email = f"{_unique(tag)}@example.com"
    username = f"{_unique(tag)}"
    payload = {
        "username": username,
        "email": email,
        "password": "SmokePass123!",
        "confirm_password": "SmokePass123!",
        "first_name": "First",
        "last_name": "Last",
        "organization": 1,
        "role": 1,
    }
    r = client.post("/api/accounts/register/", json=payload)
    assert r.status_code == 201, r.text
    return email, username, r.json()["user_id"]


def _login(client, email, password="SmokePass123!"):
    r = client.post("/api/accounts/login/", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r


def test_register_login_session_flow(client):
    email, username, uid = _register(client)

    r = _login(client, email)
    assert r.json()["message"] == "Login successful"
    user = r.json()["user"]
    assert user["email"] == email
    assert user["username"] == username
    assert user["role"] == "Admin"
    assert user["organization_name"] == "Test Org"
    assert "sessionid" in {c.name for c in client.cookies.jar}

    # check-session keeps the session alive
    r = client.get("/api/accounts/check-session/", params={"username": username})
    assert r.status_code == 200
    assert r.json()["message"] == "Session active"

    # users list is visible to the authenticated superuser
    r = client.get("/api/accounts/users/", params={"page_number": 1, "page_size": 10})
    assert r.status_code == 200
    body = r.json()
    assert body["page_number"] == 1
    assert body["page_size"] == 10
    assert body["total_count"] >= 2
    assert any(u["username"] == username for u in body["results"])

    # logout clears the session cookie
    r = client.post("/api/accounts/logout/")
    assert r.status_code == 200
    assert r.json()["message"] == "Logged out successfully"
    assert "sessionid" not in {c.name for c in client.cookies.jar}


def test_login_invalid_credentials(client):
    r = client.post(
        "/api/accounts/login/",
        json={"email": "nobody@example.com", "password": "WrongPass123!"},
    )
    assert r.status_code == 401
    assert r.json() == {"message": "Invalid Credentials"}


def test_login_missing_fields_returns_schema_envelope(client):
    r = client.post("/api/accounts/login/", json={"email": "", "password": ""})
    assert r.status_code == 400
    body = r.json()
    assert body["message"] == "Request schema validation failed"
    assert "email" in body["errors"]
    assert "password" in body["errors"]


def test_register_duplicate_conflict(client):
    email, username, _uid = _register(client)
    payload = {
        "username": username,
        "email": email,
        "password": "SmokePass123!",
        "confirm_password": "SmokePass123!",
        "first_name": "First",
        "last_name": "Last",
        "organization": 1,
        "role": 1,
    }
    r = client.post("/api/accounts/register/", json=payload)
    assert r.status_code == 409
    assert "email" in r.json()["errors"]
    assert "username" in r.json()["errors"]


def test_unauthenticated_protected_endpoint(client):
    r = client.get("/api/accounts/users/")
    assert r.status_code == 401
    assert r.json() == {"detail": "Authentication credentials were not provided."}


def test_document_lifecycle(client):
    email, _username, uid = _register(client)
    _login(client, email)

    files = {"file": ("notes.txt", io.BytesIO(b"hello smoke"), "text/plain")}
    r = client.post(
        "/api/accounts/documents/upload/",
        data={"user_id": uid, "uploaded_by": email, "category": "general"},
        files=files,
    )
    assert r.status_code == 201, r.text
    data = r.json()["data"]
    assert data["original_name"] == "notes.txt"
    assert data["organization"] == "Test Org"
    assert data["uploaded_by"] == email
    doc_number = data["document_number"]

    r = client.get("/api/accounts/documents/", params={"page_size": 10})
    assert r.status_code == 200
    assert any(d["document_number"] == doc_number for d in r.json()["results"])

    r = client.get("/api/accounts/documents/download/", params={"document_number": doc_number})
    assert r.status_code == 200
    assert r.content == b"hello smoke"
    assert "attachment" in r.headers.get("content-disposition", "")

    r = client.delete(
        "/api/accounts/documents/delete/", params={"user_id": uid, "document_number": doc_number}
    )
    assert r.status_code == 200
    assert r.json() == {"message": "Document deleted successfully"}


def test_document_upload_rejects_unsupported_type(client):
    email, _username, uid = _register(client)
    _login(client, email)
    files = {"file": ("evil.exe", io.BytesIO(b"MZ"), "application/octet-stream")}
    r = client.post(
        "/api/accounts/documents/upload/",
        data={"user_id": uid, "uploaded_by": email},
        files=files,
    )
    # The upload service runs validate_file_extension (allowlist) before
    # validate_document, so the allowlist message is what the caller sees.
    assert r.status_code == 400
    body = r.json()
    assert body["message"] == "Validation failed"
    assert body["errors"].startswith("Unsupported file type. Allowed types:")
    assert "txt" in body["errors"]


def test_document_upload_email_mismatch(client):
    _email, _username, uid = _register(client)
    _login(client, "admin@test.local", "AdminPass123!")
    files = {"file": ("notes.txt", io.BytesIO(b"x"), "text/plain")}
    r = client.post(
        "/api/accounts/documents/upload/",
        data={"user_id": uid, "uploaded_by": "someone-else@example.com"},
        files=files,
    )
    assert r.status_code == 400
    assert "uploaded_by must match" in r.json()["message"]


def test_invalid_pagination_envelope(client):
    _login(client, "admin@test.local", "AdminPass123!")
    r = client.get("/api/accounts/users/", params={"page_number": "not-a-number"})
    assert r.status_code == 400
    body = r.json()
    assert body["message"] == "Request schema validation failed"
    assert body["errors"]["page_number"] == ["A valid integer is required."]


def test_profile_photo_flow(client):
    email, _username, _uid = _register(client)
    _login(client, email)

    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    r = client.post(
        "/api/accounts/profile-photo/upload/",
        data={"email": email},
        files={"photo": ("p.png", io.BytesIO(png), "image/png")},
    )
    assert r.status_code == 200, r.text
    assert r.json()["message"] == "Profile photo uploaded successfully"
    assert r.json()["profile_photo"].startswith("/media/")

    r = client.get("/api/accounts/profile-photo/view/")
    assert r.status_code == 200
    assert r.json()["name"].endswith(".png")
    assert r.json()["url"].startswith("/media/")

    r = client.delete("/api/accounts/profile-photo/delete/")
    assert r.status_code == 200
    assert r.json() == {"message": "Profile photo deleted successfully"}


def test_upload_form_flow(client):
    email, _username, uid = _register(client)
    _login(client, email)

    files = {"file": ("scan.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 16), "image/png")}
    r = client.post(
        "/api/accounts/upload-form/",
        data={"user_id": uid, "form_type": "IMAGE"},
        files=files,
    )
    assert r.status_code == 201, r.text
    form_id = r.json()["form_id"]

    r = client.get("/api/accounts/upload-form/view/", params={"form_id": form_id})
    assert r.status_code == 200
    assert r.json()["form_id"] == form_id
    assert r.json()["form_type"] == "IMAGE"

    import json as _json

    r = client.request(
        "DELETE",
        "/api/accounts/upload-form/delete/",
        content=_json.dumps({"user_id": uid, "form_id": form_id}),
        headers={"content-type": "application/json"},
    )
    assert r.status_code == 200
    assert r.json() == {"message": "IMAGE deleted successfully"}


def test_password_change_mfa_reset(client):
    email, _username, _uid = _register(client)
    _login(client, email)

    r = client.post(
        "/api/accounts/change-password/",
        json={
            "email": email,
            "current_password": "SmokePass123!",
            "new_password": "NewPass456!",
            "confirm_password": "NewPass456!",
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["message"] == "Password changed successfully"

    r = client.post("/api/accounts/logout/")
    assert r.status_code == 200

    # MFA login: OTP exposed in dev response, then verified
    r = client.post("/api/accounts/login-mfa/", json={"email": email, "password": "NewPass456!"})
    assert r.status_code == 200
    otp = r.json().get("otp_code")
    assert otp
    r = client.post("/api/accounts/verify-otp/", json={"email": email, "otp_code": otp})
    assert r.status_code == 200
    assert r.json()["message"] == "MFA login successful"

    # forgot -> reset password
    r = client.post("/api/accounts/forgot-password/", json={"email": email})
    assert r.status_code == 200
    reset_otp = r.json()["data"]["reset_otp"]
    assert reset_otp
    r = client.post(
        "/api/accounts/reset-password/",
        json={"email": email, "otp_code": reset_otp, "new_password": "FinalPass789!"},
    )
    assert r.status_code == 200
    assert r.json()["message"] == "Password reset successful"


def test_integrity_check(client):
    email, _username, _uid = _register(client)
    _login(client, email)
    r = client.post("/api/accounts/integrity-check/", json={"message": "abc"})
    assert r.status_code == 200
    body = r.json()
    assert body["original_message"] == "abc"
    assert len(body["sha256_hash"]) == 64


def test_audit_logs_paginated(client):
    _login(client, "admin@test.local", "AdminPass123!")
    r = client.get("/api/accounts/audit-logs/", params={"page_number": 1, "page_size": 10})
    assert r.status_code == 200
    body = r.json()
    assert body["total_count"] >= 1
    assert {"id", "user", "action", "description", "timestamp"} <= set(body["results"][0].keys())


def test_swagger_alias_redirects(client):
    r = client.get("/swagger/", follow_redirects=False)
    assert r.status_code in (302, 307)
    assert "/docs" in r.headers.get("location", "")
