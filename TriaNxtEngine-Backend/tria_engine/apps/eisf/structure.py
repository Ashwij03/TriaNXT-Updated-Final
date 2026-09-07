# tria_engine/apps/eisf/structure.py
#
# Canonical Regulatory Document Repository (eISF) structure — the single
# source of truth for the standardized Investigator Site File folder
# taxonomy and for the 21 CFR Part 11 electronic-signature meanings.
#
# The seven top-level folders mirror the Architecture Blueprint for the
# eISF Regulatory Document Repository:
#
#   Protocol, IRB/IEC, Regulatory, CVs/Licenses, ICF, Financials,
#   Monitoring Reports
#
# Every document persisted through the eISF API must carry a folder_key
# from ISF_FOLDER_KEYS — the routers validate against it, so documents can
# never be filed into ad-hoc folders. `source_module_ids` maps each
# standard folder onto the granular eISF menu modules the frontend already
# exposes (Constants/EISFMenuConfig.ts), so the frontend can classify its
# existing modules under the standard structure without data loss.

from __future__ import annotations

# ---------------------------------------------------------------------------
# Standard ISF folder structure (Architecture Blueprint)
# ---------------------------------------------------------------------------

ISF_FOLDER_STRUCTURE: list[dict] = [
    {
        "key": "protocol",
        "label": "Protocol",
        "description": "Approved study protocol, protocol amendments and related correspondence.",
        "source_module_ids": ["3.0"],
        "typical_documents": [
            "Current Approved Study Protocol",
            "Protocol Amendments",
            "Site Protocol Version Tracker",
        ],
    },
    {
        "key": "irb_iec",
        "label": "IRB/IEC",
        "description": "Ethics committee (IRB/IEC) approvals, submissions and correspondence.",
        "source_module_ids": ["6.0"],
        "typical_documents": [
            "Ethics Approval Letters",
            "Ethics Submission Documents",
            "Committee Composition & Compliance",
        ],
    },
    {
        "key": "regulatory",
        "label": "Regulatory",
        "description": "Regulatory authorisations and supplementary regulatory documents.",
        "source_module_ids": ["5.0"],
        "typical_documents": [
            "Regulatory Authorisation",
            "Supplementary Documents",
        ],
    },
    {
        "key": "cvs_licenses",
        "label": "CVs/Licenses",
        "description": "Investigator/staff curricula vitae, medical licences, GCP and other training certificates.",
        "source_module_ids": ["1.0"],
        "typical_documents": [
            "CVs",
            "Medical Licences",
            "GCP Training Certificates",
            "EDC Training Certifications",
        ],
    },
    {
        "key": "icf",
        "label": "ICF",
        "description": "Informed consent forms (PGICF/PICF), version trackers and signed consent documents.",
        "source_module_ids": ["4.0"],
        "typical_documents": [
            "PGICF & PICF Version Tracker",
            "Current PGICF & PICFs",
            "Signed PGICF & PICFs",
        ],
    },
    {
        "key": "financials",
        "label": "Financials",
        "description": "Finance documentation: invoices, receipts and related correspondence.",
        "source_module_ids": ["19.0"],
        "typical_documents": ["Invoices / Receipts", "Related Correspondence"],
    },
    {
        "key": "monitoring_reports",
        "label": "Monitoring Reports",
        "description": "Monitoring visit reports, correspondence, audits and inspections.",
        "source_module_ids": ["15.0"],
        "typical_documents": [
            "Site Monitoring Log",
            "Monitoring Visit Correspondence and Feedback",
            "Trial Close-Out",
            "Regulatory Inspections Reports and Correspondence",
        ],
    },
]

ISF_FOLDER_KEYS: list[str] = [folder["key"] for folder in ISF_FOLDER_STRUCTURE]
ISF_FOLDER_LABELS: dict[str, str] = {
    folder["key"]: folder["label"] for folder in ISF_FOLDER_STRUCTURE
}


def isf_folder_label(folder_key: str | None) -> str:
    return ISF_FOLDER_LABELS.get(folder_key or "", folder_key or "")


def is_valid_folder_key(folder_key: str | None) -> bool:
    return (folder_key or "").strip() in ISF_FOLDER_KEYS


def folder_for_module(module_id: str | None) -> dict | None:
    """Map a granular eISF menu module id onto its standard folder."""
    module = str(module_id or "")
    for folder in ISF_FOLDER_STRUCTURE:
        if module in folder["source_module_ids"]:
            return folder
    return None


# ---------------------------------------------------------------------------
# 21 CFR Part 11 signature meanings
# ---------------------------------------------------------------------------

# meaning key -> human label shown in the signing ceremony
SIGNATURE_MEANINGS: list[dict] = [
    {"key": "approval", "label": "Approval"},
    {"key": "review", "label": "Review"},
    {"key": "authorship", "label": "Authorship"},
    {"key": "verification", "label": "Verification"},
]

SIGNATURE_MEANING_KEYS: list[str] = [meaning["key"] for meaning in SIGNATURE_MEANINGS]
SIGNATURE_MEANING_LABELS: dict[str, str] = {
    meaning["key"]: meaning["label"] for meaning in SIGNATURE_MEANINGS
}

# Part 11 (21 CFR 11.200) — each signing event states its purpose; the
# printed-name + password re-authentication requirement is enforced by the
# routers/signature service, not just the UI.
SIGNATURE_MEANING_DESCRIPTIONS: dict[str, str] = {
    "approval": "I approve this document for the stated purpose.",
    "review": "I have reviewed this document and its contents.",
    "authorship": "I authored / take ownership of this document.",
    "verification": "I verified this document's integrity and authenticity.",
}


def is_valid_signature_meaning(meaning: str | None) -> bool:
    return (meaning or "").strip().lower() in SIGNATURE_MEANING_KEYS


def signature_meaning_label(meaning: str | None) -> str:
    return SIGNATURE_MEANING_LABELS.get((meaning or "").strip().lower(), meaning or "")
