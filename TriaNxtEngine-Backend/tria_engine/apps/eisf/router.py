# tria_engine/apps/eisf/router.py
#
# eISF Regulatory Document Repository API — mounted at /api/eisf by
# tria_engine/main.py.
#
#   GET    /api/eisf/folders                      standard ISF folder structure
#   GET    /api/eisf/documents                    org/study-scoped document list
#   POST   /api/eisf/documents                    file upload — requires a
#                                                 completed E-Signature
#                                                 (meaning/printedName, on the
#                                                 already-authenticated session)
#                                                 BEFORE the document is stored;
#                                                 the signature row is recorded
#                                                 as part of the upload
#   GET    /api/eisf/documents/{id}               document detail (no bytes)
#   DELETE /api/eisf/documents/{id}               signed retirement — requires
#                                                 E-Signature fields; without a
#                                                 completed signature the delete
#                                                 is refused
#   GET    /api/eisf/documents/{id}/download-url  short-lived token URL (the only
#                                                 way bytes are ever reached)
#   GET    /api/eisf/documents/{id}/content       streams bytes behind the token
#   GET    /api/eisf/documents/{id}/signatures    immutable signature records
#   GET    /api/eisf/documents/{id}/verify        watermark / integrity check
#
# Every endpoint that touches a study runs the Universal Access Guard
# (dependencies.require_study_access / ensure_study_access) and returns a
# proper 403 when the authenticated user is not assigned to that study.
# Role gates come from the central RBAC matrix (module "eisf" in
# accounts/rbac.py). Row lookups never leak existence across organizations
# (404), while same-org out-of-scope study access is answered with 403.

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from tria_engine.core.database import get_db
from tria_engine.core.timeutils import utcnow

from ..accounts.dependencies import get_current_user
from ..accounts.models import User
from ..accounts.services import create_audit_log
from . import services
from .dependencies import ensure_study_access, require_eisf_permission
from .models import EisfDocument
from .structure import (
    ISF_FOLDER_STRUCTURE,
    is_valid_folder_key,
    is_valid_signature_meaning,
    signature_meaning_label,
)

router = APIRouter(prefix="/api/eisf", tags=["eisf"])

# ---------------------------------------------------------------------------
# Folder structure
# ---------------------------------------------------------------------------


@router.get("/folders/")
@router.get("/folders")
def folder_list(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Standard Investigator Site File folders (Protocol, IRB/IEC, ...)."""
    return {"folders": ISF_FOLDER_STRUCTURE, "count": len(ISF_FOLDER_STRUCTURE)}


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------


@router.get("/documents/")
@router.get("/documents")
def document_list(
    request: Request,
    study: str = Query(default=""),
    folder: str = Query(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List documents the user may see (org scope + assigned study/site
    scope at the SQL level). A requested study the user is not assigned to
    is rejected with 403 — never silently filtered."""
    ensure_study_access(user, study or None)
    folder_key = folder.strip() or None
    if folder_key and not is_valid_folder_key(folder_key):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid folder. Allowed folders: {', '.join(f['key'] for f in ISF_FOLDER_STRUCTURE)}",
        )
    records = services.list_documents(
        db, user, study_code=study.strip() or None, folder_key=folder_key
    )
    return {"count": len(records), "documents": records}


@router.post("/documents/")
@router.post("/documents")
async def document_upload(
    request: Request,
    file: UploadFile = File(...),
    study: str = Form(...),
    folder: str = Form(...),
    document_name: str = Form(default=""),
    version: str = Form(default="1.0"),
    site: str = Form(default=""),
    meaning: str = Form(default=""),
    printedName: str = Form(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(require_eisf_permission("create")),
):
    """File a document into the eISF repository. Bytes go to private
    storage; only the digest + metadata are stored on the row.

    An E-Signature is MANDATORY and is part of this action: the uploader
    must pass `meaning` + `printedName` (identity comes from the
    already-authenticated session). Without a completed signature the
    upload is refused (422) and nothing is stored. On success the signature
    row is recorded against the new document in the same flow."""
    ensure_study_access(user, study.strip() or None)
    folder_key = folder.strip()
    if not is_valid_folder_key(folder_key):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid folder. Allowed folders: {', '.join(f['key'] for f in ISF_FOLDER_STRUCTURE)}",
        )
    if not study.strip():
        raise HTTPException(status_code=422, detail="study is required.")
    meaning_key = str(meaning or "").strip().lower()
    printed = str(printedName or "").strip()
    if not is_valid_signature_meaning(meaning_key):
        raise HTTPException(
            status_code=422,
            detail="meaning must be one of: approval, review, authorship, verification.",
        )
    if not printed:
        raise HTTPException(status_code=422, detail="printedName is required for the E-Signature.")

    content = await file.read()
    name = (document_name or "").strip() or _name_without_ext(file.filename) or "Document"
    _validate_upload(file.filename or name, content)

    try:
        document = services.create_document(
            db,
            user,
            study_code=study.strip(),
            site_code=site.strip() or None,
            folder_key=folder_key,
            document_name=name,
            version=(version or "1.0").strip(),
            file_name=file.filename or f"{name}.pdf",
            content_type=file.content_type,
            file_bytes=content,
        )
    except Exception as exc:
        create_audit_log(
            db, user=user, action="EISF_UPLOAD_FAILED",
            ip_address=_client_ip(request),
            description=f"{user.username} failed to upload an eISF document: {exc}",
        )
        raise HTTPException(status_code=400, detail="Document could not be stored.") from exc

    # The E-Signature IS part of the upload action: record it against the
    # freshly stored document in the same flow.
    signature = services.sign_document(
        db,
        user,
        document,
        meaning=meaning_key,
        printed_name=printed,
        ip_address=_client_ip(request),
    )

    create_audit_log(
        db,
        user=user,
        action="EISF_UPLOAD_DOCUMENT",
        ip_address=_client_ip(request),
        description=(
            f"{user.username} filed {document.document_name} v{document.version} "
            f"into {document.folder_key} for study {document.study_id} "
            f"(E-Signature: {signature_meaning_label(meaning_key)})"
        ),
        signature_meaning=f"Upload E-Signature ({signature_meaning_label(meaning_key)})",
    )
    return JSONResponse(
        {
            "message": "Document uploaded and E-Signed successfully.",
            "data": services.document_payload(db, document),
        },
        status_code=201,
    )


@router.get("/documents/{document_id}/")
@router.get("/documents/{document_id}")
def document_detail(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = services.load_document(db, user, document_id)
    return {"data": services.document_payload(db, document)}


@router.delete("/documents/{document_id}/")
@router.delete("/documents/{document_id}")
async def document_delete(
    request: Request,
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_eisf_permission("delete")),
):
    """Retire a document — requires a completed E-Signature.

    Body: {"meaning": ..., "printedName": ...}
    Identity comes from the already-authenticated session; the deletion is
    recorded as an immutable electronic-signature event bound to the
    document. Without these fields the delete is refused and the document
    is untouched."""
    body = await _json_body(request)
    meaning = str(body.get("meaning") or "").strip().lower()
    printed_name = str(body.get("printedName") or "").strip()

    if not is_valid_signature_meaning(meaning):
        raise HTTPException(
            status_code=422,
            detail="meaning must be one of: approval, review, authorship, verification.",
        )
    if not printed_name:
        raise HTTPException(status_code=422, detail="printedName is required for the E-Signature.")

    result = services.delete_document(
        db,
        user,
        document_id,
        meaning=meaning,
        printed_name=printed_name,
        ip_address=_client_ip(request),
    )
    return result


# ---------------------------------------------------------------------------
# Private / presigned-style download access
# ---------------------------------------------------------------------------


@router.get("/documents/{document_id}/download-url/")
@router.get("/documents/{document_id}/download-url")
def document_download_url(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Issue the short-lived token URL — the only path to document bytes.

    No public or direct /media links are ever returned: storage keys stay
    server-side and the token expires in ~2 minutes by default."""
    document = services.load_document_for_action(db, user, document_id)
    token = services.issue_download_token(db, user, document)
    download_url = f"/api/eisf/documents/{document.id}/content?token={token}"
    return {"documentId": document.id, "downloadUrl": download_url}


@router.get("/documents/{document_id}/content")
def document_content(
    document_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Stream document bytes after validating the download token.

    Responses carry the content digest + live integrity status in headers
    (X-TriaNXT-Sha256 / X-TriaNXT-Integrity) so clients can verify
    authenticity at view/download time."""
    services.resolve_download_token(document_id, token, user)
    document = services.load_document_for_action(db, user, document_id)
    content = services._content_bytes(document)
    import hmac as _hmac

    integrity_ok = _hmac.compare_digest(
        services.sha256_hex(content), document.content_sha256
    )
    return Response(
        content=content,
        media_type=document.content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{_safe_header(document.file_name)}"',
            "X-TriaNXT-Sha256": document.content_sha256,
            "X-TriaNXT-Integrity": "authentic" if integrity_ok else "tampered",
            "Cache-Control": "no-store, private",
        },
    )


# ---------------------------------------------------------------------------
# Electronic signatures (recorded as part of upload/delete — append-only)
# ---------------------------------------------------------------------------


@router.get("/documents/{document_id}/signatures/")
@router.get("/documents/{document_id}/signatures")
def document_signatures(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Retired documents keep their signature evidence readable.
    document = services.load_document_for_action(db, user, document_id, allow_deleted=True)
    records = services.list_signatures(db, document)
    return {"count": len(records), "signatures": records}


# ---------------------------------------------------------------------------
# Watermark / integrity verification
# ---------------------------------------------------------------------------


@router.get("/documents/{document_id}/verify/")
@router.get("/documents/{document_id}/verify")
def document_verify(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Recompute the stored-file SHA-256 and re-validate every signature
    stamp — the watermark/authenticity check shown before view/download."""
    document = services.load_document_for_action(db, user, document_id, allow_deleted=True)
    return services.verify_document_integrity(db, document)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _client_ip(request: Request) -> str | None:
    if request.client is None:
        return None
    return request.client.host


async def _json_body(request: Request) -> dict:
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=422, detail="Request body must be JSON.") from None
    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="Request body must be a JSON object.")
    return body


def _name_without_ext(filename: str | None) -> str:
    if not filename:
        return ""
    return os.path.splitext(os.path.basename(filename))[0]


def _validate_upload(filename: str, content: bytes) -> None:
    from tria_engine.apps.accounts.upload_config import (
        get_document_allowed_extensions,
        get_document_max_size,
    )

    ext = os.path.splitext(filename)[1].lower().lstrip(".")
    allowed = [item.lower() for item in get_document_allowed_extensions()]
    if allowed and ext not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type. Allowed types: {', '.join(allowed)}",
        )
    if len(content) > get_document_max_size():
        raise HTTPException(
            status_code=422, detail="File size exceeds the allowed limit."
        )
    if not content:
        raise HTTPException(status_code=422, detail="Cannot upload an empty file.")


def _safe_header(value: str) -> str:
    return (value or "document").replace('"', "").replace("\r", "").replace("\n", "")


# Re-export for tests/tooling that references the row-loading helper.
__all__ = ["router"]
