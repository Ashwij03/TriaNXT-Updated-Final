import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getDashboardPath, getEffectiveRole, getCurrentUser } from "../services/roleService";

export function useLiveChatNavigation(liveChatPath) {
  const navigate = useNavigate();
  const location = useLocation();

  const originPath = `${location.pathname}${location.search || ""}`;

  const openLiveChat = useCallback(() => {
    navigate(liveChatPath, {
      state: {
        from: originPath,
      },
    });
  }, [liveChatPath, navigate, originPath]);

  const returnFromLiveChat = useCallback(() => {
    const fromPath = location.state?.from;
    const fallbackPath = getDashboardPath(
      getEffectiveRole(getCurrentUser()) || getCurrentUser()?.role
    );

    navigate(fromPath || fallbackPath, { replace: true });
  }, [location.state, navigate]);

  const backLabel =
    location.state?.from &&
    !String(location.state.from).endsWith("-dashboard")
      ? "Back"
      : "Back to Dashboard";

  return {
    openLiveChat,
    returnFromLiveChat,
    backLabel,
    originPath,
  };
}

export default useLiveChatNavigation;
