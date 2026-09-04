/**
 * Unit tests for SubscriptionContext (the pre-fetch provider)
 * ===========================================================
 *
 * Verifies the provider's state machine that MyLicense / Subscription
 * Management read for their loading / error / retry affordances:
 *   - Demo build (API disabled): refresh() is a no-op — nothing fetches,
 *     no loading flash.
 *   - API mode + authenticated: pre-fetches the subscription + plan
 *     catalog once on mount; loading is true while in flight and cleared
 *     afterwards.
 *   - API mode + no auth token: skips the authenticated billing fetch.
 *   - Fetch failure: error state carries the message for the retry banner.
 *
 * The provider's service/client imports are mocked so no real module
 * state (localStorage caches) leaks between tests.
 */

import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SubscriptionProvider, useSubscription } from "../SubscriptionContext";
import { isApiEnabled, getAuthToken } from "../../services/api/client";
import {
  refreshSubscriptionFromApi,
} from "../../services/subscriptionService";
import {
  refreshPlanCatalogFromApi,
} from "../../services/planCatalogService";

jest.mock("../../services/api/client", () => ({
  isApiEnabled: jest.fn(() => false),
  getAuthToken: jest.fn(() => "test-token"),
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

jest.mock("../../services/subscriptionService", () => ({
  refreshSubscriptionFromApi: jest.fn(),
}));

jest.mock("../../services/planCatalogService", () => ({
  refreshPlanCatalogFromApi: jest.fn(),
}));

function Probe() {
  const { loading, error, refresh } = useSubscription();
  return (
    <div data-testid="ctx">
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error || ""}</span>
      <span data-testid="has-refresh">
        {typeof refresh === "function" ? "yes" : "no"}
      </span>
    </div>
  );
}

function renderProvider() {
  return render(
    <SubscriptionProvider>
      <Probe />
    </SubscriptionProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  isApiEnabled.mockReturnValue(false);
  getAuthToken.mockReturnValue("test-token");
  refreshSubscriptionFromApi.mockResolvedValue({ status: "Active" });
  refreshPlanCatalogFromApi.mockResolvedValue([]);
});

describe("demo build (API disabled)", () => {
  test("mounting does not fetch and settles with no loading/error", async () => {
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    );
    expect(screen.getByTestId("error")).toHaveTextContent("");
    expect(refreshSubscriptionFromApi).not.toHaveBeenCalled();
    expect(refreshPlanCatalogFromApi).not.toHaveBeenCalled();
  });
});

describe("API mode", () => {
  test("pre-fetches subscription + catalog once on mount and clears loading", async () => {
    isApiEnabled.mockReturnValue(true);

    renderProvider();

    await waitFor(() =>
      expect(refreshSubscriptionFromApi).toHaveBeenCalledTimes(1)
    );
    expect(refreshPlanCatalogFromApi).toHaveBeenCalledTimes(1);

    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    );
    expect(screen.getByTestId("error")).toHaveTextContent("");
  });

  test("exposes loading=true while the pre-fetch is in flight", async () => {
    isApiEnabled.mockReturnValue(true);

    let resolveSubscription;
    refreshSubscriptionFromApi.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubscription = resolve;
        })
    );
    refreshPlanCatalogFromApi.mockResolvedValue([]);

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("true")
    );

    resolveSubscription({ status: "Active" });
    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    );
  });

  test("skips the fetch when no auth token exists (login/register screens)", async () => {
    isApiEnabled.mockReturnValue(true);
    getAuthToken.mockReturnValue(null);

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    );
    expect(refreshSubscriptionFromApi).not.toHaveBeenCalled();
    expect(refreshPlanCatalogFromApi).not.toHaveBeenCalled();
    expect(screen.getByTestId("error")).toHaveTextContent("");
  });

  test("surfaces the fetch failure through the error state (retry affordance)", async () => {
    isApiEnabled.mockReturnValue(true);
    refreshSubscriptionFromApi.mockRejectedValue(
      new Error("Billing service unavailable")
    );

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent(
        "Billing service unavailable"
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    );
  });
});
