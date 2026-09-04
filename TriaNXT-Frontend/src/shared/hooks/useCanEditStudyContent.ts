import { useEffect, useState } from "react";
import { canEditStudyContent, hasApprovedEditAccess } from "../utils/contentAccess";
import { getCurrentUser } from "../services/roleService";
import { PERMISSIONS_UPDATED } from "../services/accessPermissionService";

// Role-based edit access OR an admin-approved Edit Permission request for
// this module/study. Re-evaluates whenever a permission request is
// approved/rejected so the Edit Permission action reflects the decision
// immediately, without a page refresh.
export default function useCanEditStudyContent(module, studyCode = "") {
  const user = getCurrentUser();

  const compute = () =>
    canEditStudyContent(user) || hasApprovedEditAccess(user, module, studyCode);

  const [canEdit, setCanEdit] = useState(compute);

  useEffect(() => {
    setCanEdit(compute());

    const refresh = () => setCanEdit(compute());
    window.addEventListener(PERMISSIONS_UPDATED, refresh);
    return () => window.removeEventListener(PERMISSIONS_UPDATED, refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module, studyCode, user?.email]);

  return canEdit;
}
