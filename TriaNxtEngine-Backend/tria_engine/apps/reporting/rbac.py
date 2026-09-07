# tria_engine/apps/reporting/rbac.py
#
# Local role policy for the reporting / financials modules.
#
# The central RBAC matrix (tria_engine/apps/accounts/rbac.py) is owned by
# the auth module and is intentionally NOT modified here. Instead this file
# reuses accounts' role *resolution* (resolve_role) and expresses the
# reporting-specific write matrix locally, so the module stays additive:
#
#   * Reads are authenticated + org-scoped for every role (same convention
#     as the ctms record layer — CRO/PI keep read/oversight rights).
#   * Template saves follow the legacy front-end reportService design
#     (Admin / Site Staff / PI manage; Sponsor may save builder templates;
#     CRO is view-only).
#   * Budgets / milestones are entered by the sponsor-side and site roles;
#     payout *approval* is restricted to Admin / Sponsor.

from __future__ import annotations

from fastapi import HTTPException

from ..accounts.rbac import ADMIN, CRO, PI, SITE_STAFF, SPONSOR, resolve_role, role_label

FORBIDDEN = "Forbidden: your role does not permit this action."

# module -> action -> allowed roles
_REPORTING_MATRIX: dict[str, dict[str, set[str]]] = {
    "reports": {
        # Save / update / delete own templates + run any standard report.
        "create": {ADMIN, SITE_STAFF, PI, SPONSOR},
        "update": {ADMIN, SITE_STAFF, PI, SPONSOR},
        "delete": {ADMIN, SITE_STAFF, PI, SPONSOR},
    },
    "budgets": {
        "create": {ADMIN, SPONSOR, SITE_STAFF},
        "update": {ADMIN, SPONSOR},
    },
    "milestones": {
        "create": {ADMIN, SPONSOR, SITE_STAFF},
        "update": {ADMIN, SPONSOR},
    },
    "invoices": {
        "create": {ADMIN, SPONSOR, SITE_STAFF},
        "update": {ADMIN, SPONSOR, SITE_STAFF},
    },
    "payouts": {
        # Requesting a payout is a site/sponsor duty.
        "create": {ADMIN, SPONSOR, SITE_STAFF},
        # Approving/rejecting/marking paid is sponsor-side (Admin = wildcard).
        "approve": {ADMIN, SPONSOR},
    },
}


def resolve_reporting_role(user) -> str | None:
    return resolve_role(user)


def allowed_role(user, module: str, action: str) -> bool:
    role = resolve_reporting_role(user)
    if role == ADMIN:
        return True
    matrix = _REPORTING_MATRIX.get(module, {})
    roles = matrix.get(action)
    if not roles:
        return False
    return role in roles


def enforce_reporting(user, module: str, action: str) -> str:
    """403 when the session role may not perform `action` on `module`."""
    role = resolve_reporting_role(user)
    if not allowed_role(user, module, action):
        raise HTTPException(
            status_code=403,
            detail=(
                FORBIDDEN
                + f" [module={module}, action={action}, role={role_label(role)}]"
            ),
        )
    return role or ADMIN


def may_read(user) -> bool:
    """Every authenticated org member may read reporting/finance data."""
    return resolve_reporting_role(user) is not None


def allow_writes(user, module: str) -> bool:
    return allowed_role(user, module, "create") or allowed_role(user, module, "update")
