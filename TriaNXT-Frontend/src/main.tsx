import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import App from "./App";
import { AuthProvider } from "./shared/context/AuthContext";
import { CROProvider } from "./CRO/pages/CRODATAContext";
import { CommentsProvider } from "./shared/comments/CommentsContext";
import { FolderProvider } from "./shared/context/FolderContext";
import { initializeAdminData } from "./shared/services/adminService";
import { initializeStudies } from "./shared/services/studyService";
import { initializeUpcomingVisitReminderSynchronization } from "./shared/services/visitScheduleService";

// ===== START: Dynamic Subscription & Plan Catalog — pre-fetch provider =====
// Mounted above App so subscription/plan data is fetched from the billing
// API once on app start; the services' CustomEvent wiring then pushes
// updates to every open page.
import { SubscriptionProvider } from "./shared/context/SubscriptionContext";
// ===== END: Dynamic Subscription & Plan Catalog — pre-fetch provider =====

// ---------------------------------------------------------------------------
// Dev-only origin alignment guard (SETUP.md §4b).
//
// The FastAPI session cookie is HttpOnly + SameSite=Lax. When the SPA is
// browsed on http://localhost:3000 while VITE_API_URL points at
// http://127.0.0.1:8000 (or vice versa), "localhost" and "127.0.0.1" are
// different sites, so the browser silently drops the cookie on every XHR and
// each API call returns 401 "Authentication credentials were not provided."
//
// This guard bounces the tab to the API's loopback alias (same port, path,
// query and hash) exactly once, so the session cookie is always first-party.
// It is skipped in tests (VITEST) and never fires for non-loopback hosts.
// ---------------------------------------------------------------------------
if (import.meta.env.DEV && !import.meta.env.VITEST) {
  try {
    const apiUrl = String(import.meta.env.VITE_API_URL || "");
    const loopbackAliases = ["127.0.0.1", "localhost"];
    if (apiUrl) {
      const apiHost = new URL(apiUrl).hostname;
      const pageHost = window.location.hostname;
      if (
        loopbackAliases.includes(apiHost) &&
        loopbackAliases.includes(pageHost) &&
        pageHost !== apiHost
      ) {
        const aligned =
          window.location.protocol +
          "//" +
          apiHost +
          (window.location.port ? ":" + window.location.port : "") +
          window.location.pathname +
          window.location.search +
          window.location.hash;
        console.info(
          `[trianxt] Aligning dev origin to ${apiHost} (was ${pageHost}) so the API session cookie stays first-party.`
        );
        window.location.replace(aligned);
      }
    }
  } catch {
    /* never block app boot on the alignment guard */
  }
}

// UPDATED: seed admin and studies localStorage data on app startup
initializeAdminData();
initializeStudies();
initializeUpcomingVisitReminderSynchronization();

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SubscriptionProvider>
          <CommentsProvider>
            <CROProvider>
              <FolderProvider>
                <App />
              </FolderProvider>
            </CROProvider>
          </CommentsProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
