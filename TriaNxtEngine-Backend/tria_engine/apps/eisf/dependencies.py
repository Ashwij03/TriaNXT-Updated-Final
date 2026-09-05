# tria_engine/apps/eisf/dependencies.py
#
# Universal Access Guard — FastAPI dependency layer for the eISF Regulatory
# Document Repository (and reusable by any router that handles study-scoped
# data).
#
#   require_study_access(study_code)  — 403 when the authenticated user is
#     not assigned to the requested study (checks the user_studies mapping,
#     i.e. accounts_user.scope_data["studies"] resolved through
#     accounts.rbac). Superusers/Admins and users without an explicit study
#     restriction keep their organization scope. This is the "don't block
#     silently — reject with a proper 403" backend counterpart to the
#     frontend StudyRouteGuard, which redirects to /unauthorized.
#
#   require_eisf_permission(action)  — role gate over the RBAC permission
#     matrix (accounts.rbac) for eISF write/sign actions.
#
# Record-level org/site/study scoping happens separately when loading rows
# (see .services.load_document): out-of-scope rows resolve to 404 so
# existence is never leaked, while the study-level dependency above answers
# 403 for an explicitly requested study the user is not assigned to.

from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException

from tria_engine.core.database import get_db

from ..accounts.dependencies import get_current_user
from ..accounts.models import User
from ..accounts.rbac import enforce, resolve_user_scope

FORBIDDEN_STUDY_DETAIL = "You have no access to this study/page."


def user_has_study_access(user, study_code: str | None) -> bool:
    """True when the session user may access `study_code`.

    Mirrors accounts.rbac.resolve_user_scope semantics:
      * superuser/Admin            -> wildcard
      * no study/site assignment   -> org scope only (allowed here; site
        granularity is enforced at the row level)
      * explicit study assignment  -> the requested study must be listed
    """
    if user is None or getattr(user, "is_superuser", False):
        return True
    scope = resolve_user_scope(user)
    studies = scope["studies"]
    if not studies:
        return True
    requested = str(study_code or "").strip()
    if not requested:
        # No explicit study requested — record-level scoping applies.
        return True
    return requested in studies


def require_study_access(study_code: str | None) -> Callable:
    """Dependency factory: 403 when the user is not assigned to the study.

    Usage:
        @router.get("/documents/")
        def list_documents(
            study: str = Query(...),
            user: User = Depends(require_study_access(study)),
        ): ...
    """

    def _dependency(user: User = Depends(get_current_user)) -> User:
        ensure_study_access(user, study_code)
        return user

    return _dependency


def ensure_study_access(user, study_code: str | None) -> None:
    """Raise HTTP 403 when the authenticated user is not assigned to the
    requested study (checks the user_studies mapping)."""
    if not user_has_study_access(user, study_code):
        raise HTTPException(status_code=403, detail=FORBIDDEN_STUDY_DETAIL)


def require_eisf_permission(action: str) -> Callable:
    """Dependency factory for eISF write/sign actions (RBAC matrix)."""

    def _dependency(user: User = Depends(get_current_user)) -> User:
        enforce(user, "eisf", action)
        return user

    return _dependency
