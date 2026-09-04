// NEW FILE — Dynamic Subscription & Plan Catalog System.
// SubscriptionContext — the pre-fetch provider the billing services need
// once they stop being synchronous localStorage reads.
//
// The service layer (subscriptionService / planCatalogService) keeps its
// read helpers synchronous through a module-level cache, so every existing
// caller — subscriptionGuard, the useState(() => getSubscription())
// initializers, the CustomEvent listeners — keeps working unchanged. What
// the cache needs is a single place that pulls the REAL data from the
// /billing/... endpoints once on app start (and on demand via refresh()).
// This provider is that place: mounted high in the tree (index.js), it
// pre-fetches the subscription + plan catalog whenever the backend is
// configured and a user is authenticated, then lets the services' own
// SUBSCRIPTION_UPDATED_EVENT / PLAN_CATALOG_UPDATED_EVENT wiring push the
// fresh state to every open page.
//
// Mirrors the AuthContext / FolderContext provider conventions (createContext
// + useX hook + value object). Falls back to a no-op in demo builds
// (REACT_APP_API_URL unset) where the localStorage data is already
// synchronously available.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { isApiEnabled, getAuthToken } from "../services/api/client";
import { refreshSubscriptionFromApi } from "../services/subscriptionService";
import { refreshPlanCatalogFromApi } from "../services/planCatalogService";

const SubscriptionContext = createContext(null);

export const SubscriptionProvider = ({ children }: any) => {
  // loading: true until the first pre-fetch settles (API mode only).
  // error:   the fetch failure, if any — pages render a retry affordance.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    // Demo build (no backend): everything is already available
    // synchronously from localStorage — nothing to fetch.
    if (!isApiEnabled()) {
      setError("");
      setLoading(false);
      return null;
    }

    // Unauthenticated (login/register screens): skip the authenticated
    // billing fetch; the provider re-runs on the next app load after login.
    if (!getAuthToken()) {
      setError("");
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError("");

    try {
      await Promise.all([
        refreshSubscriptionFromApi(),
        refreshPlanCatalogFromApi(),
      ]);
      setError("");
      return true;
    } catch (err) {
      setError(
        (err && err.message) ||
          "Your subscription details could not be loaded. Please try again."
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Pre-fetch once on app start (API mode). Event listeners are NOT needed
  // here — the services already dispatch SUBSCRIPTION_UPDATED_EVENT /
  // PLAN_CATALOG_UPDATED_EVENT on every write, and the pages listen to
  // those directly; this provider only owns the initial fetch + retry.
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SubscriptionContext.Provider value={{ loading, error, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);