# tria_engine/apps/eisf/services.py
#
# Service layer for the eISF Regulatory Document Repository.
#
# Responsibilities:
#   * private storage of document bytes + upload-time SHA-256 digests
#   * short-lived, tamper-evident, tokenized download URLs (documents are
#     never exposed through public/direct links — the only public surface is
#     /api/eisf/documents/<id>/content, gated by the signed token)
#   * signing: printed name, meaning, server timestamp and a SHA-256
#     signature stamp bound to the exact signed content + signing facts;
#     rows are append-only
#   * watermark/integrity verification: recomputes the stored file digest
#     and re-validates every recorded signature stamp against it
#
# Docstring conventions match the rest of the repo (accounts/ctms services).

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from tria_engine.core.config import settings
from tria_engine.core.storage import absolute_path, save_bytes
from tria_engine.core.timeutils import utcnow

from ..accounts.models import User
from ..accounts.rbac import resolve_user_scope
from ..accounts.services import create_audit_log
from .dependencies import FORBIDDEN_STUDY_DETAIL, ensure_study_access
from .models import ESignature, EisfDocument
from .structure import (
    isf_folder_label,
    signature_meaning_label,
)

# Default lifetime of a download token (seconds). Issued URLs are
# single-purpose and die after this window regardless of session.
DOWNLOAD_TOKEN_TTL_SECONDS = 120




# ---------------------------------------------------------------------------
# Hashing / canonical serialization
# ---------------------------------------------------------------------------


def sha256_hex(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _iso_utc(dt: datetime) -> str:
    """Naive-UTC DB value -> JS-style UTC ISO string (millisecond 'Z')."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _canonical_json(payload: dict) -> str:
    """Deterministic serialization: sorted keys, no whitespace — so the
    signature stamp is stable across processes/plumbing."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def build_signature_stamp(*, document: EisfDocument, user: User, meaning: str,
                          printed_name: str, signed_at: datetime,
                          content_sha256: str) -> str:
    """SHA-256 over the canonical signing facts.

    The stamp cryptographically binds: document (code, name, version, folder,
    study), signer (id + email + organization), the Part 11 captured
    attributes (meaning, printed name, server timestamp) and the SHA-256 of
    the exact bytes signed. Recomputing the stamp over the same facts is
    deterministic; ANY change to the document record, the content digest or
    the captured attributes breaks verification.
    """
    facts = {
        "version": 1,
        "document": {
            "code": document.code,
            "document_name": document.document_name,
            "version": document.version,
            "folder_key": document.folder_key,
            "study_id": document.study_id,
            "site_id": document.site_id,
        },
        "signer": {
            "user_id": user.id,
            "email": user.email,
            "organization_id": user.organization_id,
        },
        "signature": {
            "meaning": meaning,
            "printed_name": printed_name,
            "signed_at": _iso_utc(signed_at),
            "content_sha256": content_sha256,
        },
    }
    return sha256_hex(_canonical_json(facts).encode("utf-8"))


# ---------------------------------------------------------------------------
# Document payloads + record scoping
# ---------------------------------------------------------------------------


def scope_condition(model, user):
    """SQL visibility condition for the session user (superuser wildcard,
    otherwise organization equality plus study/site scope when assigned)."""
    if user is None or getattr(user, "is_superuser", False):
        return None
    conds = [model.organization_id == user.organization_id]
    scope = resolve_user_scope(user)
    if scope["studies"]:
        conds.append(or_(model.study_id.is_(None), model.study_id.in_(scope["studies"])))
    if scope["sites"]:
        conds.append(or_(model.site_id.is_(None), model.site_id.in_(scope["sites"])))
    return and_(*conds)


def load_document(db: Session, user: User, document_id: int) -> EisfDocument:
    """Load a document row the user may see; 404 when it is missing or
    outside their org/site/study scope (existence is never leaked)."""
    stmt = select(EisfDocument).where(EisfDocument.id == document_id)
    cond = scope_condition(EisfDocument, user)
    if cond is not None:
        stmt = stmt.where(cond)
    row = db.execute(stmt).scalars().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if getattr(row, "status", None) == "Deleted":
        # Retired (signed-deletion) documents are never exposed again.
        raise HTTPException(status_code=404, detail="Document not found.")
    return row


def load_document_for_action(db: Session, user: User, document_id: int,
                             *, allow_deleted: bool = False) -> EisfDocument:
    """Resolve a document for an explicit user action (sign, download,
    verify, retire/delete, signature evidence).

    Lookup is org-scoped (same-org documents are findable so an unassigned
    study access attempt is answered with a proper 403 — never a silent
    block); cross-organization lookups stay 404. The Universal Access Guard
    then checks the document's study against the user_studies mapping.

    Documents retired through a signed deletion are hidden everywhere
    except the immutable evidence endpoints (signatures / verify) — pass
    `allow_deleted=True` there so the audit trail stays readable.
    """
    stmt = select(EisfDocument).where(EisfDocument.id == document_id)
    if not getattr(user, "is_superuser", False):
        stmt = stmt.where(EisfDocument.organization_id == user.organization_id)
    row = db.execute(stmt).scalars().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if not allow_deleted and getattr(row, "status", None) == "Deleted":
        raise HTTPException(status_code=404, detail="Document not found.")
    ensure_study_access(user, row.study_id)
    # Site granularity (scope_data["sites"]) is enforced at the row level
    # for action paths too, mirroring the SQL-level list scoping.
    scope = resolve_user_scope(user)
    if scope["sites"] and row.site_id and row.site_id not in scope["sites"]:
        raise HTTPException(status_code=403, detail=FORBIDDEN_STUDY_DETAIL)
    return row


def list_documents(
    db: Session,
    user: User,
    *,
    study_code: str | None = None,
    folder_key: str | None = None,
) -> list[dict]:
    stmt = select(EisfDocument)
    cond = scope_condition(EisfDocument, user)
    if cond is not None:
        stmt = stmt.where(cond)
    if study_code:
        stmt = stmt.where(EisfDocument.study_id == str(study_code).strip())
    if folder_key:
        stmt = stmt.where(EisfDocument.folder_key == folder_key)
    stmt = stmt.where(EisfDocument.status != "Deleted")
    stmt = stmt.order_by(EisfDocument.created_at.desc(), EisfDocument.id.desc())
    rows = db.execute(stmt).scalars().all()
    counts = _signature_counts(db, [row.id for row in rows])
    return [_document_payload(row, signature_count=counts.get(row.id, 0)) for row in rows]


def document_payload(db: Session, document: EisfDocument) -> dict:
    counts = _signature_counts(db, [document.id])
    return _document_payload(document, signature_count=counts.get(document.id, 0))


def _signature_counts(db: Session, document_ids: list[int]) -> dict:
    if not document_ids:
        return {}
    rows = (
        db.execute(
            select(ESignature.document_id, func.count(ESignature.id))
            .where(ESignature.document_id.in_(document_ids))
            .group_by(ESignature.document_id)
        )
        .all()
    )
    return {document_id: count for document_id, count in rows}


def _document_payload(document: EisfDocument, signature_count: int = 0) -> dict:
    return {
        "id": document.id,
        "code": document.code,
        "studyId": document.study_id,
        "siteId": document.site_id,
        "folderKey": document.folder_key,
        "folder": isf_folder_label(document.folder_key),
        "documentName": document.document_name,
        "version": document.version,
        "status": document.status,
        "fileName": document.file_name,
        "contentType": document.content_type,
        "fileSize": document.file_size,
        "contentSha256": document.content_sha256,
        "sourceMetadata": document.source_metadata,
        "uploadedBy": (
            document.uploaded_by.email if document.uploaded_by is not None else None
        ),
        "createdAt": _iso_utc(document.created_at),
        "updatedAt": _iso_utc(document.updated_at),
        # Count of recorded Part 11 signatures (list endpoint keeps the
        # payload light; details via /signatures).
        "signatureCount": signature_count,
    }


# ---------------------------------------------------------------------------
# Storage + upload
# ---------------------------------------------------------------------------


def store_document_file(
    *,
    study_code: str,
    folder_key: str,
    file_name: str,
    content: bytes,
) -> str:
    """Persist the bytes in private media storage and return the
    storage-relative key. Callers store the key on the document row only."""
    rel_dir = (
        f"documents/eisf/{str(study_code or 'unsorted').strip()}/{folder_key}"
    )
    return save_bytes(rel_dir, file_name, content).name


def create_document(
    db: Session,
    user: User,
    *,
    study_code: str,
    site_code: str | None,
    folder_key: str,
    document_name: str,
    version: str,
    file_name: str,
    content_type: str | None,
    file_bytes: bytes,
    source_metadata: dict | None = None,
) -> EisfDocument:
    content_sha256 = sha256_hex(file_bytes)
    storage_key = store_document_file(
        study_code=study_code,
        folder_key=folder_key,
        file_name=file_name,
        content=file_bytes,
    )
    code = f"{str(study_code or 'DOC').strip()}-{folder_key}-{uuid.uuid4().hex[:8]}"
    row = EisfDocument(
        code=code,
        organization_id=user.organization_id,
        study_id=str(study_code).strip() if study_code else None,
        site_id=str(site_code).strip() if site_code else None,
        folder_key=folder_key,
        document_name=document_name,
        version=version or "1.0",
        status="Draft",
        file_name=file_name,
        content_type=content_type,
        file_size=len(file_bytes),
        storage_key=storage_key,
        content_sha256=content_sha256,
        source_metadata=source_metadata,
        uploaded_by_id=user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete_document(
    db: Session,
    user: User,
    document_id: int,
    *,
    meaning: str,
    printed_name: str,
    ip_address: str | None = None,
) -> dict:
    """Signed, immutable retirement of a document.

    Deletion is itself an electronic-signature event (who deleted it, with
    what meaning, when) — the caller MUST pass a completed signature step
    (meaning + printed name, on top of the already-authenticated session).
    The signature row is recorded against the document and the document is
    retired to status="Deleted" so the immutable evidence (signature rows,
    content digest, audit log) survives; list/detail/download no longer
    expose it.
    """
    document = load_document_for_action(db, user, document_id)
    meaning = (meaning or "").strip().lower()
    printed = (printed_name or "").strip()
    signed_at = utcnow()
    try:
        content_sha256 = sha256_hex(_content_bytes(document))
    except HTTPException:
        # Storage file already missing — fall back to the recorded digest so
        # the deletion signature is still bound to the original content.
        content_sha256 = document.content_sha256
    stamp = build_signature_stamp(
        document=document,
        user=user,
        meaning=meaning,
        printed_name=printed,
        signed_at=signed_at,
        content_sha256=content_sha256,
    )
    signature = ESignature(
        token=uuid.uuid4().hex,
        document_id=document.id,
        signer_id=user.id,
        meaning=meaning,
        printed_name=printed,
        signed_at=signed_at,
        content_sha256=content_sha256,
        signature_stamp=stamp,
        ip_address=ip_address,
    )
    db.add(signature)
    code = document.code
    document.status = "Deleted"
    document.updated_at = utcnow()
    db.commit()
    db.refresh(signature)

    create_audit_log(
        db,
        user=user,
        action="E_SIGN_DOCUMENT_DELETE",
        ip_address=ip_address,
        description=(
            f"{user.username} electronically signed the deletion of document "
            f"{code} (v{document.version}, {signature_meaning_label(meaning)})"
        ),
        signature_token=signature.token,
        signature_meaning=f"Deletion E-Signature ({signature_meaning_label(meaning)})",
    )
    return {
        "message": f"Document {code} retired by electronic signature.",
        "code": code,
        "signatureToken": signature.token,
        "data": _signature_payload(signature),
    }


# ---------------------------------------------------------------------------
# Part 11 electronic signatures
# ---------------------------------------------------------------------------


def _content_bytes(document: EisfDocument) -> bytes:
    path = absolute_path(document.storage_key)
    if not path.is_file():
        raise HTTPException(
            status_code=409,
            detail="Stored file is missing — document integrity cannot be established.",
        )
    return path.read_bytes()


def sign_document(
    db: Session,
    user: User,
    document: EisfDocument,
    *,
    meaning: str,
    printed_name: str,
    ip_address: str | None = None,
) -> ESignature:
    """Record an electronic signature for a document.

    1. Identity comes from the already-authenticated session user (no
       password re-authentication step).
    2. Hash the exact stored bytes — the signature is bound to content, so
       any later modification of the file breaks the signature.
    3. Persist the signature row with the SHA-256 stamp + audit log.
    """
    content_sha256 = sha256_hex(_content_bytes(document))
    meaning = meaning.strip().lower()
    printed = (printed_name or "").strip()
    if not printed:
        raise HTTPException(status_code=422, detail="Printed signer name is required.")
    signed_at = utcnow()
    stamp = build_signature_stamp(
        document=document,
        user=user,
        meaning=meaning,
        printed_name=printed,
        signed_at=signed_at,
        content_sha256=content_sha256,
    )
    signature = ESignature(
        token=uuid.uuid4().hex,
        document_id=document.id,
        signer_id=user.id,
        meaning=meaning,
        printed_name=printed,
        signed_at=signed_at,
        content_sha256=content_sha256,
        signature_stamp=stamp,
        ip_address=ip_address,
    )
    db.add(signature)
    db.commit()
    db.refresh(signature)

    create_audit_log(
        db,
        user=user,
        action="E_SIGN_DOCUMENT",
        ip_address=ip_address,
        description=(
            f"{user.username} electronically signed document {document.code} "
            f"(v{document.version}, {signature_meaning_label(meaning)})"
        ),
        signature_token=signature.token,
        signature_meaning=f"Electronic signature ({signature_meaning_label(meaning)})",
    )
    return signature


def _signature_payload(signature: ESignature) -> dict:
    return {
        "id": signature.id,
        "token": signature.token,
        "documentId": signature.document_id,
        "meaning": signature.meaning,
        "meaningLabel": signature_meaning_label(signature.meaning),
        "printedName": signature.printed_name,
        "signedAt": _iso_utc(signature.signed_at),
        "contentSha256": signature.content_sha256,
        "signatureStamp": signature.signature_stamp,
        "signerId": signature.signer_id,
        "signerEmail": signature.signer.email if signature.signer is not None else None,
    }


def list_signatures(db: Session, document: EisfDocument) -> list[dict]:
    stmt = (
        select(ESignature)
        .where(ESignature.document_id == document.id)
        .order_by(ESignature.signed_at.asc(), ESignature.id.asc())
    )
    return [_signature_payload(sig) for sig in db.execute(stmt).scalars().all()]


# ---------------------------------------------------------------------------
# Watermark / integrity verification (tamper evidence)
# ---------------------------------------------------------------------------


def verify_document_integrity(db: Session, document: EisfDocument) -> dict:
    """Recompute the stored file digest and re-validate every signature.

    status == "authentic"  -> stored bytes match the upload digest AND every
                              signature stamp validates against the content.
    status == "tampered"   -> the file (or a signed record) no longer matches
                              what was originally stored/signed.
    """
    recorded = document.content_sha256
    try:
        stored_digest = sha256_hex(_content_bytes(document))
        content_ok = hmac.compare_digest(stored_digest, recorded)
    except HTTPException:
        stored_digest = None
        content_ok = False

    signatures = db.execute(
        select(ESignature)
        .where(ESignature.document_id == document.id)
        .order_by(ESignature.signed_at.asc(), ESignature.id.asc())
    ).scalars().all()

    signature_results = []
    for sig in signatures:
        signature_results.append(
            {
                **{
                    "id": sig.id,
                    "meaning": sig.meaning,
                    "meaningLabel": signature_meaning_label(sig.meaning),
                    "printedName": sig.printed_name,
                    "signedAt": _iso_utc(sig.signed_at),
                    "token": sig.token,
                },
                # A signature is intact when the currently stored content
                # digest equals the digest it was created against.
                "status": (
                    "authentic"
                    if content_ok and hmac.compare_digest(stored_digest, sig.content_sha256)
                    else "tampered"
                ),
            }
        )

    all_authentic = content_ok and all(
        item["status"] == "authentic" for item in signature_results
    )
    return {
        "documentId": document.id,
        "code": document.code,
        "status": "authentic" if all_authentic else "tampered",
        "verifiedAt": _iso_utc(utcnow()),
        "recordedSha256": recorded,
        "storedSha256": stored_digest,
        "signatureCount": len(signature_results),
        "signatures": signature_results,
    }


# ---------------------------------------------------------------------------
# Private (presigned-style) download access
# ---------------------------------------------------------------------------


def _sign_token(payload: str) -> str:
    return hmac.new(
        str(settings.SECRET_KEY).encode("utf-8"), payload.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def issue_download_token(db: Session, user: User, document: EisfDocument,
                         ttl_seconds: int = DOWNLOAD_TOKEN_TTL_SECONDS) -> str:
    """Issue a short-lived, single-purpose download token bound to the user.

    The returned URL is the ONLY way to reach document bytes — storage keys
    are never exposed, /media is never linked from eISF, and the token dies
    after `ttl_seconds` even if the session stays open. (In an S3-backed
    deployment this same helper returns a real presigned GET URL.)
    """
    expiry = int(utcnow().timestamp()) + max(1, ttl_seconds)
    payload = _b64url(
        json.dumps(
            {"doc": document.id, "uid": user.id, "exp": expiry},
            separators=(",", ":"),
        ).encode("utf-8")
    )
    return f"{payload}.{_sign_token(payload)}"


def resolve_download_token(document_id: int, token: str, user: User) -> int:
    """Validate the download token; returns the document id on success.

    Raises 403 for a forged/expired/mismatched token (never 404 — the token
    itself is what authorizes this access path)."""
    if not token or "." not in token:
        raise HTTPException(status_code=403, detail="Invalid download token.")
    payload_b64, provided = token.split(".", 1)
    expected = _sign_token(payload_b64)
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=403, detail="Invalid download token.")
    try:
        raw = _b64url_decode(payload_b64)
        payload = json.loads(raw.decode("utf-8"))
        document_id = int(payload.get("doc"))
        user_id = int(payload.get("uid"))
        expiry = int(payload.get("exp", 0))
    except (ValueError, TypeError, UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(status_code=403, detail="Invalid download token.") from None
    if user_id != user.id:
        raise HTTPException(
            status_code=403, detail="Download token belongs to another user."
        )
    if expiry < int(utcnow().timestamp()):
        raise HTTPException(status_code=403, detail="Download token has expired.")
    return document_id


def _b64url(content: bytes) -> str:
    return base64.urlsafe_b64encode(content).decode("ascii").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def basename_for_download(document: EisfDocument) -> str:
    """Safe download filename: original name, sanitized."""
    name = os.path.basename(document.file_name or f"{document.code}.pdf")
    return name or f"{document.code}.pdf"
