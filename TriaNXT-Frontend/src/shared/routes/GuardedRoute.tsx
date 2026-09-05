import { Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import ROLES from "../constants/roles";
import {
  canAccessRoute,
  getAdminPreviewRole,
  getCurrentUser,
  getEffectiveRole,
  getEffectiveUser,
  getPIPreviewRole,
  getUserScopeRestrictions,
  hasPermission,
  isAdmin,
  restrictStudiesToUserScope,
} from "../services/roleService";
import { getStudies } from "../services/studyService";

/**
 * GuardedRoute — Universal Route / Study Access Guard.
 *
 * Wraps any element that requires a signed-in session, a role/permission
 * and — for URLs scoped to a study — an assignment to that study in the
 * logged-in user's assigned-study list.
 *
 * Access policy (mirrors the backend require_study_access dependency):
 *   1. not signed in                    -> /login
 *   2. role not in allowedRoles         -> /unauthorized (403 page, never a
 *                                          silent block)
 *   3. requiredPermission missing       -> /unauthorized
 *   4. route not in the access matrix   -> /unauthorized
 *   5. the URL names a study (id/code in a path param or ?study/studyCode)
 *      that is not in the user's assigned studies (scope_data) or not in
 *      the studies their role/organization can see -> /unauthorized
 *
 * Adapters: `StudyRouteGuard` is GuardedRoute configured to read the study
 * from the route's `:id` param (the /studies/:id-style URL shape).
 */

const UNAUTHORIZED_PATH = "/unauthorized";

function isLoggedIn() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("isLoggedIn") === "true";
}

/**
 * Find the raw study token in the URL: explicit `study` prop first, then a
 * path param, then ?study / ?studyCode query parameters.
 */
function resolveStudyToken({
  study,
  studyParam,
  pathParams,
  searchParams,
}: any) {
  if (study) return String(study).trim();
  if (studyParam) {
    const fromParam = pathParams[studyParam];
    if (fromParam) return String(fromParam).trim();
  }
  return (
    searchParams.get("study") ||
    searchParams.get("studyCode") ||
    searchParams.get("study_id") ||
    ""
  ).trim();
}

function GuardedRoute({
  children,
  allowedRoles,
  requiredPermission,
  study,
  studyParam,
  onUnauthorized = UNAUTHORIZED_PATH,
}: any) {
  const location = useLocation();
  const pathParams = useParams();
  const [searchParams] = useSearchParams();

  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  const currentUser = getCurrentUser();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const effectiveUser = getEffectiveUser(currentUser);
  const effectiveRole = effectiveUser?.role || currentUser.role;
  const adminPreviewAllowed =
    isAdmin(currentUser) &&
    allowedRoles &&
    allowedRoles.includes(getAdminPreviewRole());
  const piPreviewAllowed =
    currentUser.role === ROLES.PI &&
    allowedRoles &&
    allowedRoles.includes(getPIPreviewRole());

  // 2 — role gate.
  if (
    allowedRoles &&
    !allowedRoles.includes(effectiveRole) &&
    !adminPreviewAllowed &&
    !piPreviewAllowed
  ) {
    return (
      <Navigate
        to={onUnauthorized}
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // 3 — fine-grained permission gate.
  if (requiredPermission && effectiveRole !== ROLES.ADMIN && !hasPermission(requiredPermission)) {
    return (
      <Navigate
        to={onUnauthorized}
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // 4 — route access matrix (deny-by-default, never a silent block).
  if (!canAccessRoute(location.pathname, currentUser)) {
    return (
      <Navigate
        to={onUnauthorized}
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // 5 — study-level access guard for /studies/:id-style URLs.
  const rawStudy = resolveStudyToken({ study, studyParam, pathParams, searchParams });

  if (rawStudy) {
    const scopeRestrictions = getUserScopeRestrictions(currentUser);
    const assignedStudyCodes = scopeRestrictions.studies || [];

    // scope_data["studies"] stores study CODES — an exact match against
    // those codes is authoritative for Admin-assigned restrictions.
    const matchedByScopeCode =
      assignedStudyCodes.length === 0 || assignedStudyCodes.includes(rawStudy);

    if (!matchedByScopeCode) {
      return (
        <Navigate
          to={onUnauthorized}
          replace
          state={{ from: location.pathname + location.search }}
        />
      );
    }

    // For users without a finite scope_data assignment the guard falls back
    // to the role/org-visible study list (the "assigned study list" the
    // frontend already derives for the sidebar). The study may be addressed
    // by its id or its code.
    const allStudies = getStudies();
    if (Array.isArray(allStudies) && allStudies.length > 0) {
      const visibleStudies = restrictStudiesToUserScope(allStudies, currentUser);
      const found = visibleStudies.some((studyRow) =>
        [studyRow.code, studyRow.studyId, studyRow.studyCode, studyRow.id]
          .filter((value) => value !== undefined && value !== null)
          .some((value) => String(value) === rawStudy)
      );
      if (!found) {
        return (
          <Navigate
            to={onUnauthorized}
            replace
            state={{ from: location.pathname + location.search }}
          />
        );
      }
    }
  }

  return children;
}

/**
 * StudyRouteGuard — guards /studies/:id-style routes by reading the study
 * token from the route's `:id` (or `:studyId`) param before rendering.
 */
export function StudyRouteGuard({
  children,
  allowedRoles,
  requiredPermission,
  studyParam = "id",
  ...rest
}: any) {
  return (
    <GuardedRoute
      allowedRoles={allowedRoles}
      requiredPermission={requiredPermission}
      studyParam={studyParam}
      {...rest}
    >
      {children}
    </GuardedRoute>
  );
}

export default GuardedRoute;
