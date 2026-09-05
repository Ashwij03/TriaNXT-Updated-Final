import { Link, useLocation } from "react-router-dom";
import { TbShieldLock } from "react-icons/tb";
import "./Unauthorized.css";
import {
  getCurrentUser,
  getDashboardPath,
  getEffectiveRole,
} from "../services/roleService";
import ROLES from "../constants/roles";

/**
 * Unauthorized / 403 page — rendered by the Universal Access Guard when a
 * signed-in user tries to open a study/page that is not assigned to their
 * role or organization. Also registered as a standalone route at
 * /unauthorized and /forbidden.
 *
 * Unlike a silent redirect back to the dashboard, this page tells the user
 * exactly what happened and gives them the two exits they need:
 *   * Return to Dashboard
 *   * Request Support / Request Access (existing Access Request flow)
 */
export default function Unauthorized() {
  const location = useLocation();
  const currentUser = getCurrentUser();
  const isLoggedIn =
    currentUser && localStorage.getItem("isLoggedIn") === "true";

  const dashboardPath = isLoggedIn
    ? getDashboardPath(getEffectiveRole(currentUser) || currentUser.role || ROLES.ADMIN)
    : "/login";

  const attemptedPath =
    (location.state && location.state.from) || location.pathname;

  return (
    <div className="unauthorized-page tnxt-compact">
      <div className="unauthorized-card">
        <div className="unauthorized-icon" aria-hidden="true">
          <TbShieldLock />
        </div>

        <span className="unauthorized-code">403 — Forbidden</span>
        <h1>You have no access to this study/page.</h1>

        <p className="unauthorized-detail">
          {attemptedPath && attemptedPath !== "/unauthorized" && (
            <>
              <span className="unauthorized-path">{attemptedPath}</span>
              <br />
            </>
          )}
          {isLoggedIn
            ? "Your role or assigned studies do not include this area. If you believe this is an error, request access from your administrator."
            : "Please sign in to continue, or request access from your administrator."}
        </p>

        <div className="unauthorized-actions">
          <Link className="unauthorized-btn primary" to={dashboardPath}>
            Return to Dashboard
          </Link>

          <Link className="unauthorized-btn secondary" to="/access-request">
            Request Support / Request Access
          </Link>
        </div>

        {isLoggedIn && (
          <p className="unauthorized-footnote">
            Signed in as {currentUser.name || currentUser.email || "your account"} ·{" "}
            <Link to="/security">Manage your session</Link>
          </p>
        )}
      </div>
    </div>
  );
}
