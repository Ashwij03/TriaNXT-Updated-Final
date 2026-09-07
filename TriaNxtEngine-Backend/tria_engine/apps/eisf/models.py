# tria_engine/apps/eisf/models.py
#
# Persistence for the eISF Regulatory Document Repository (21 CFR Part 11).
#
# Two tables, following the repo's SQLAlchemy conventions (see
# apps/accounts/models.py and apps/ctms/models.py):
#
#   eisf_document    — one row per filed document version. The binary bytes
#                      live in private storage (never exposed as a public
#                      URL); the row stores the storage key plus the
#                      SHA-256 digest of the exact bytes, recorded at
#                      upload time. `content_sha256` is the integrity
#                      baseline the watermark/verify endpoint checks.
#   eisf_esignature  — immutable Part 11 signature events. Each row binds a
#                      signer, their printed name, the signature meaning, a
#                      server timestamp and the SHA-256 stamp of the signed
#                      content. There is deliberately no UPDATE endpoint and
#                      no UPDATE hook anywhere in the code: signature rows
#                      are append-only.
#
# study_id / site_id hold the study/site CODES (matching the frontend and
# the rest of the CTMS rows) as indexed columns so the Universal Access
# Guard (require_study_access) and the org-scoped filters run at the SQL
# level.
#
# Table creation is additive — register the module in the SETUP.md
# create_all snippet (and tests/conftest.py) exactly like apps/ctms.

from __future__ import annotations

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tria_engine.core.database import BIGINT, Base
from tria_engine.core.timeutils import utcnow


class EisfDocument(Base):
    __tablename__ = "eisf_document"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)

    # Frontend-facing document code (e.g. "TNX-001-icf-2f3a9c") and the
    # study/site codes the record is scoped to.
    code: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    organization_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("organizations_organization.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    study_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    site_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

    # Regulatory Repository taxonomy — folder_key must be one of
    # structure.ISF_FOLDER_KEYS (validated by the router/service).
    folder_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    document_name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(32), nullable=False, default="1.0")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="Draft")

    # File metadata + private storage pointer. `storage_key` is a
    # storage-relative path inside private media storage — never exposed as
    # a direct/public link; clients only ever receive short-lived
    # tokenized download URLs (see services.issue_download_url).
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False)
    # SHA-256 hex digest of the exact stored bytes at upload time — the
    # tamper-evidence baseline used by /verify (watermark check).
    content_sha256: Mapped[str] = mapped_column(String(64), nullable=False)

    # Optional frontend module/section context (which eISF module/section
    # filed the document) so API-mode documents can round-trip with the
    # localStorage eISF stores.
    source_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    uploaded_by_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("accounts_user.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[object] = mapped_column(
        DateTime, nullable=False, default=utcnow, onupdate=utcnow
    )

    uploaded_by: Mapped["object | None"] = relationship(
        "User", foreign_keys=[uploaded_by_id]
    )

    def __repr__(self) -> str:
        return f"<EisfDocument {self.code} {self.folder_key} v{self.version}>"


class ESignature(Base):
    """Immutable 21 CFR Part 11 electronic-signature event.

    Append-only by design: the API exposes create + list + verify, and
    nothing in the codebase ever updates or deletes a row.
    """

    __tablename__ = "eisf_esignature"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)

    # Unique signature token (human-auditable reference, mirrors the
    # accounts_auditlog.signature_token convention).
    token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)

    document_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("eisf_document.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # SET NULL keeps the audit trail intact if an account is ever removed.
    signer_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("accounts_user.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Part 11 captured attributes: meaning, printed signer name, server
    # timestamp, and the SHA-256 stamp over the signed content + signing
    # facts (see services.build_signature_stamp).
    meaning: Mapped[str] = mapped_column(String(32), nullable=False)
    printed_name: Mapped[str] = mapped_column(String(255), nullable=False)
    signed_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    # Digest of the exact document bytes that were signed (== the
    # document.content_sha256 baseline unless the file was tampered with
    # after signing — which is exactly what /verify detects).
    content_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    signature_stamp: Mapped[str] = mapped_column(String(64), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)

    document: Mapped["EisfDocument"] = relationship(
        "EisfDocument", foreign_keys=[document_id]
    )
    signer: Mapped["object | None"] = relationship("User", foreign_keys=[signer_id])

    def __repr__(self) -> str:
        return f"<ESignature {self.token} {self.meaning} on {self.document_id}>"


# Kept for tooling that walks model modules for create_all registration.
__all__ = ["EisfDocument", "ESignature"]
