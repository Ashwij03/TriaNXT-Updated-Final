import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { formatUserDisplayName } from "../services/roleService";
import { isApiEnabled } from "../services/api/client";
import {
  clearBackendSession,
  establishBackendSession,
} from "../services/backendSession";
import rolePermissions from "../utils/rolePermissions";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("currentUser")) || null;
    } catch {
      return null;
    }
  });

  const login = useCallback((userData) => {
    const nextUser = {
      ...userData,
      displayName: formatUserDisplayName(userData),
    };

    localStorage.setItem("currentUser", JSON.stringify(nextUser));

    setUser(nextUser);

    // API mode: make sure the browser holds the FastAPI session cookie so
    // subsequent API calls (scope assignment, gap-module sync, hydration)
    // are credentialed. Best-effort and idempotent per tab — local login
    // behavior is unchanged when the backend is unreachable.
    if (isApiEnabled()) {
      void establishBackendSession(nextUser);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("adminPreviewRole");

    setUser(null);

    // Best-effort backend logout so the session cookie does not linger.
    if (isApiEnabled()) {
      void clearBackendSession();
    }
  }, []);

  // Safety net: if another tab (or a login handler that bypasses this
  // context) writes to localStorage, re-hydrate React state so the two
  // never silently diverge. Also handles a stale tab where context is
  // null but localStorage is populated.
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== "currentUser") return;

      try {
        const next = event.newValue ? JSON.parse(event.newValue) : null;
        setUser((prev) => {
          // Only update if actually different to avoid re-render loops.
          const prevId = prev?.id;
          const nextId = next?.id;
          if (prevId === nextId) return prev;
          return next;
        });
      } catch {
        setUser(null);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Boot: when the app loads with a signed-in user in API mode, re-establish
  // the backend session if this tab has not done so yet (a fresh tab after a
  // reload has no cookie even though localStorage kept the SPA login).
  useEffect(() => {
    const bootUser = (() => {
      try {
        return JSON.parse(localStorage.getItem("currentUser")) || null;
      } catch {
        return null;
      }
    })();
    if (bootUser && isApiEnabled()) {
      void establishBackendSession(bootUser);
    }
  }, []);

  // FastAPI integration: once a session exists, hydrate the flagship gap
  // stores (Amendments / IP lots / IRB) from the backend when API mode is
  // on and the local store is empty (fresh browser). Best-effort only —
  // offline sessions are unaffected. Dynamic imports keep the module graph
  // free of cycles.
  const hydratedBackendRef = useRef(false);

  useEffect(() => {
    if (!user || hydratedBackendRef.current) {
      return undefined;
    }
    hydratedBackendRef.current = true;
    let cancelled = false;

    const hydrate = async () => {
      try {
        const [
          { hydrateAmendmentsFromBackend },
          { hydrateIpLotsFromBackend },
          { hydrateIrbFromBackend },
          { hydrateSubjectsFromBackend },
          { hydrateVisitsFromBackend },
        ] = await Promise.all([
          import("../services/amendmentService"),
          import("../services/ipAccountabilityService"),
          import("../services/irbSubmissionService"),
          import("../services/subjectService"),
          import("../services/visitScheduleService"),
        ]);
        if (cancelled) {
          return;
        }
        await Promise.allSettled([
          hydrateAmendmentsFromBackend(),
          hydrateIpLotsFromBackend(),
          hydrateIrbFromBackend(),
          hydrateSubjectsFromBackend(),
          hydrateVisitsFromBackend(),
        ]);
      } catch {
        // Backend unreachable / API mode off — hydration is best effort.
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user ? (user as any).id : null]);

  const role = user?.role || null;
  const displayName = useMemo(() => formatUserDisplayName(user), [user]);

  const permissions =
    role && rolePermissions[role] ? rolePermissions[role] : [];

  const hasPermission = (permission) => {
    return permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ? { ...user, displayName } : null,
        role,
        displayName,
        permissions,
        login,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);