# tria_engine/apps/accounts/rbac.py
#
# Central Role-Based Access Control for the TriaNXT CTMS API — the single
# source of truth for "who may do what" (RBAC_Implementation_Prompt.md).
#
# Design:
#   * Role is resolved SERVER-SIDE from the authenticated session (the User
#     row's is_superuser flag + organizations_role.name). Client-supplied
#     role claims are never trusted (validation G9).
#   * enforce(user, module, action) is a central permission check — no
#     per-endpoint ad hoc role logic. It raises HTTP 403 Forbidden (JSON
#     {"detail": ...}) when the role is missing or not in the action's
#     allowed set (validation G3).
#   * Data scope is enforced separately by the record layer: every list/read
#     filters to the user's organization (superuser = wildcard) and out-of-
#     scope record access resolves to 404 (validation G4).

from __future__ import annotations

from fastapi import HTTPException

# ---------------------------------------------------------------------------
# Canonical roles (RBAC spec Section 1/2)
# ---------------------------------------------------------------------------

ADMIN = "ADMIN"
SITE_STAFF = "SITE_STAFF"
PI = "PI"
CRO = "CRO"
SPONSOR = "SPONSOR"

ALL_ROLES = (ADMIN, SITE_STAFF, PI, CRO, SPONSOR)

# organizations_role.name -> canonical role. "CRA" is the legacy name for the
# CRO role (Clinical Research Associate) — both map to CRO.
ROLE_ALIASES = {
    "admin": ADMIN,
    "site staff": SITE_STAFF,
    "sitestaff": SITE_STAFF,
    "site_staff": SITE_STAFF,
    "site coordinator": SITE_STAFF,
    "pi": PI,
    "principal investigator": PI,
    "cra": CRO,
    "cro": CRO,
    "monitor": CRO,
    "sponsor": SPONSOR,
}

FORBIDDEN_DETAIL = "Forbidden: your role does not permit this action."


def resolve_role(user) -> str | None:
    """Resolve the canonical role from the authenticated session.

    Superusers are always ADMIN (wildcard scope). Returns None when the user
    has no resolvable role — deny-by-default: no role means no writes.
    """
    if user is None:
        return None
    if getattr(user, "is_superuser", False):
        return ADMIN
    role = getattr(user, "role", None)
    name = (getattr(role, "name", "") or "").strip().lower()
    return ROLE_ALIASES.get(name)


def role_label(role: str | None) -> str:
    return role or "UNKNOWN"


# ---------------------------------------------------------------------------
# Permission matrix (RBAC spec Section 2 — Permitted Actions per module).
#
# Only WRITE actions are enumerated: reads are authenticated + org-scoped for
# every role (records outside the user's organization resolve to 404, G4).
# CRO has read/review/oversight rights only on these modules; PI reviews and
# approves IRB/ICF (medical oversight) but has no direct edit rights on
# subject/enrollment/screening data (P5).
# ---------------------------------------------------------------------------

# module -> action -> allowed roles
PERMISSION_MATRIX: dict[str, dict[str, set[str]]] = {
    "amendments": {
        "create": {ADMIN, SPONSOR},
        "update": {ADMIN, SPONSOR, SITE_STAFF, PI},
        "delete": {ADMIN, SPONSOR},
    },
    "irb": {
        "create": {ADMIN, SPONSOR, SITE_STAFF},
        "update": {ADMIN, SPONSOR, SITE_STAFF, PI},
        "delete": {ADMIN},
    },
    "icf": {
        "create": {ADMIN, SPONSOR, SITE_STAFF},
        "update": {ADMIN, SPONSOR, SITE_STAFF, PI},
        "delete": {ADMIN},
    },
    "ip": {
        "create": {ADMIN, SITE_STAFF},
        "update": {ADMIN, SITE_STAFF},
        "delete": {ADMIN},
    },
    "vendor": {
        "create": {ADMIN, SPONSOR},
        "update": {ADMIN, SPONSOR},
        "delete": {ADMIN},
    },
    "feasibility": {
        "create": {ADMIN, SPONSOR},
        "update": {ADMIN, SPONSOR},
        "delete": {ADMIN},
    },
    # Safety AE/SAE case reporting is a site duty: Site Staff and PI report,
    # Sponsor records SAE cross-reference/reconciliation. CRO is read-only
    # (oversight) — consistent with the CRO no-writes rule on the gap modules.
    "safety": {
        "create": {ADMIN, SITE_STAFF, PI, SPONSOR},
        "update": {ADMIN, SITE_STAFF, PI, SPONSOR},
        "delete": {ADMIN},
    },
    # Monitoring access: any non-approver role may REQUEST access; only
    # Admin / Site Staff approve, reject or revoke (the frontend APPROVER
    # roles in MonitoringAccess.tsx).
    "monitoring": {
        "create": {ADMIN, CRO, SPONSOR, PI},
        "update": {ADMIN, SITE_STAFF},
        "delete": {ADMIN},
    },
    # AI Review write actions (document QC, comment triage, finding
    # decisions) belong to the sponsor-side oversight roles. The two page
    # endpoints (site risk, copilot) are read-only.
    "ai": {
        "create": {ADMIN, SPONSOR, CRO},
        "update": {ADMIN, SPONSOR, CRO},
        "delete": {ADMIN},
    },
    # Subject enrollment / screening is performed at the site by Site Staff
    # and the PI (and, for sponsor-run studies, the Sponsor workspace); the
    # write-through mirror therefore allows those roles. CRO stays
    # read-only (oversight, G3).
    "subjects": {
        "create": {ADMIN, SITE_STAFF, PI, SPONSOR},
        "update": {ADMIN, SITE_STAFF, PI, SPONSOR},
        "delete": {ADMIN},
    },
    # Visit scheduling / status updates follow the same site-side roles;
    # visits are created when a subject is enrolled or a stage completes.
    "visits": {
        "create": {ADMIN, SITE_STAFF, PI, SPONSOR},
        "update": {ADMIN, SITE_STAFF, PI, SPONSOR},
        "delete": {ADMIN},
    },
    # eISF Regulatory Document Repository. Reads are org/study-scoped for
    # every authenticated role (no row here); filing (upload/update) is a
    # site + sponsor duty, deletion is Admin-only, and Part 11 signing is
    # open to every document-owning role (CRO/Monitor stays read-only).
    "eisf": {
        "create": {ADMIN, SITE_STAFF, PI, SPONSOR},
        "update": {ADMIN, SITE_STAFF, PI, SPONSOR},
        "delete": {ADMIN},
        "sign": {ADMIN, SITE_STAFF, PI, SPONSOR},
    },
}


def module_for_model(model) -> str:
    """Map a ctms JSON-record model class to its permission-matrix module."""
    name = getattr(model, "__tablename__", "") or getattr(model, "__name__", "")
    table = name.lower().replace("ctms_", "")
    if table in ("amendment",):
        return "amendments"
    if table in ("iplot",):
        return "ip"
    if table in ("irbsubmission",):
        return "irb"
    if table in ("icfversion", "consentevent", "reconsentcampaign"):
        return "icf"
    if table in ("vendor", "kit"):
        return "vendor"
    if table in ("feasibilitycandidate", "feasibilityscoring"):
        return "feasibility"
    if table in ("safetyaecase",):
        return "safety"
    if table in ("monitoringrequest",):
        return "monitoring"
    if table in ("subject",):
        return "subjects"
    if table in ("visit",):
        return "visits"
    # Unknown table -> deny writes (fail closed).
    return table


def allowed(role: str | None, module: str, action: str) -> bool:
    if role == ADMIN:
        return True
    matrix = PERMISSION_MATRIX.get(module)
    if not matrix:
        return False
    roles = matrix.get(action)
    if not roles:
        return False
    return role in roles


def enforce(user, module: str, action: str) -> str:
    """Central permission check — raise 403 when the session role is not
    allowed to perform `action` on `module`. Returns the resolved role."""
    role = resolve_role(user)
    if not allowed(role, module, action):
        raise HTTPException(
            status_code=403,
            detail=(
                FORBIDDEN_DETAIL
                + f" [module={module}, action={action}, role={role_label(role)}]"
            ),
        )
    return role or ADMIN


def enforce_for_model(user, model, action: str) -> str:
    return enforce(user, module_for_model(model), action)


# ---------------------------------------------------------------------------
# Site/study scope (RBAC spec Section 4.1 — scope bindings)
#
# The user's assigned study/site codes are resolved from the authenticated
# session (accounts_user.scope_data JSON, assigned by an Admin). Superusers
# are wildcard. A NULL/empty assignment means "no site/study restriction" —
# the user keeps plain organization scope so unassigned users behave exactly
# as before this feature landed.
# ---------------------------------------------------------------------------


def parse_scope_data(user) -> dict:
    """Normalise accounts_user.scope_data -> {"studies": set|None, "sites": set|None}."""
    raw = getattr(user, "scope_data", None)
    if not isinstance(raw, dict):
        return {"studies": None, "sites": None}

    def _codes(key):
        values = raw.get(key)
        if not isinstance(values, (list, tuple, set)):
            return None
        codes = {str(v).strip() for v in values if str(v).strip()}
        return codes or None

    return {"studies": _codes("studies"), "sites": _codes("sites")}


def resolve_user_scope(user) -> dict:
    """Effective site/study scope for record filtering.

    Returns {"studies": None | frozenset, "sites": None | frozenset} where
    None means "no restriction" (wildcard for superusers, org-only for
    unassigned users).
    """
    if user is None or getattr(user, "is_superuser", False):
        return {"studies": None, "sites": None}
    scope = parse_scope_data(user)
    return {
        "studies": frozenset(scope["studies"]) if scope["studies"] else None,
        "sites": frozenset(scope["sites"]) if scope["sites"] else None,
    }


def has_finite_scope(user) -> bool:
    scope = resolve_user_scope(user)
    return bool(scope["studies"] or scope["sites"])


def assert_write_scope(user, study_code, site_code):
    """403 when a record being written falls outside the user's assigned
    site/study scope. Records with no study/site (org-level rows such as
    vendor records) are always in scope for organization members.

    Superuser/Admin -> wildcard (validation A1). Unassigned non-superusers
    -> org scope only, unchanged from previous behaviour.
    """
    if user is None or getattr(user, "is_superuser", False):
        return
    scope = resolve_user_scope(user)
    studies, sites = scope["studies"], scope["sites"]
    if not studies and not sites:
        return
    study = (str(study_code) if study_code else "").strip()
    site = (str(site_code) if site_code else "").strip()
    if study and studies and study not in studies:
        raise HTTPException(
            status_code=403,
            detail=f"Forbidden: record study '{study}' is outside your assigned study scope.",
        )
    if site and sites and site not in sites:
        raise HTTPException(
            status_code=403,
            detail=f"Forbidden: record site '{site}' is outside your assigned site scope.",
        )