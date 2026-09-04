/**
 * backendSession — contract for the best-effort FastAPI session bootstrap:
 *   * API mode off  -> never fetches, reports "api-disabled"
 *   * API mode on   -> POSTs /api/accounts/login/ with the signed-in user's
 *     email + the password from the local directory record
 *   * missing email / missing stored password -> no-op outcome, no throw
 *   * per-tab marker makes the bootstrap idempotent (no duplicate LOGINs)
 *   * clearBackendSession POSTs logout and clears the marker
 *
 * isApiEnabled() reads import.meta.env.VITE_API_URL at module load, so the
 * module is re-imported per scenario after stubbing the env (same pattern as
 * gapSync.test.ts).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

function makeTransport() {
  const calls: { endpoint: string; body?: any }[] = [];
  const transport = {
    calls,
    post: vi.fn(async (endpoint: string, body?: any) => {
      calls.push({ endpoint, body });
      return { message: "ok" };
    }),
  };
  return transport;
}

function seedDirectory(records: any[]) {
  localStorage.setItem("users", JSON.stringify(records));
}

const DIR_USER = {
  id: 1,
  email: "admin1@demo.com",
  password: "Admin@123",
  name: "Alex Admin",
  role: "Admin",
};

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
  sessionStorage.clear();
});

describe("establishBackendSession with API mode off", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "");
  });

  it("no-ops without calling the transport", async () => {
    const transport = makeTransport();
    const { establishBackendSession } = await import("../backendSession");

    const result = await establishBackendSession(DIR_USER, transport);

    expect(result).toEqual({ ok: false, reason: "api-disabled" });
    expect(transport.post).not.toHaveBeenCalled();
  });
});

describe("establishBackendSession with API mode on", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "http://127.0.0.1:8000");
  });

  it("POSTs login with the directory password and reports success", async () => {
    seedDirectory([DIR_USER]);
    const transport = makeTransport();
    const { establishBackendSession } = await import("../backendSession");

    const result = await establishBackendSession(DIR_USER, transport);

    expect(transport.post).toHaveBeenCalledWith("/api/accounts/login/", {
      email: "admin1@demo.com",
      password: "Admin@123",
    });
    expect(result).toEqual({ ok: true, reason: "logged-in" });
  });

  it("is idempotent per tab — the marker prevents a second login", async () => {
    seedDirectory([DIR_USER]);
    const transport = makeTransport();
    const { establishBackendSession } = await import("../backendSession");

    await establishBackendSession(DIR_USER, transport);
    const second = await establishBackendSession(DIR_USER, transport);

    expect(second).toEqual({ ok: true, reason: "already-established" });
    expect(transport.post).toHaveBeenCalledTimes(1);
  });

  it("force bypasses the marker (stale-cookie retry path)", async () => {
    seedDirectory([DIR_USER]);
    const transport = makeTransport();
    const { establishBackendSession } = await import("../backendSession");

    await establishBackendSession(DIR_USER, transport);
    await establishBackendSession(DIR_USER, transport, true);

    expect(transport.post).toHaveBeenCalledTimes(2);
  });

  it("reports bad-credentials on a 401", async () => {
    seedDirectory([DIR_USER]);
    const transport = makeTransport();
    transport.post.mockRejectedValue({ status: 401 });
    const { establishBackendSession } = await import("../backendSession");

    const result = await establishBackendSession(DIR_USER, transport);

    expect(result).toEqual({ ok: false, reason: "bad-credentials" });
  });

  it("reports unreachable on a network failure and never throws", async () => {
    seedDirectory([DIR_USER]);
    const transport = makeTransport();
    transport.post.mockRejectedValue(new Error("ECONNREFUSED"));
    const { establishBackendSession } = await import("../backendSession");

    const result = await establishBackendSession(DIR_USER, transport);

    expect(result).toEqual({ ok: false, reason: "unreachable" });
  });

  it("no-ops when the directory record has no stored password", async () => {
    seedDirectory([{ ...DIR_USER, password: undefined }]);
    const transport = makeTransport();
    const { establishBackendSession } = await import("../backendSession");

    const result = await establishBackendSession(DIR_USER, transport);

    expect(result).toEqual({ ok: false, reason: "no-local-password" });
    expect(transport.post).not.toHaveBeenCalled();
  });

  it("reports no-user without an email", async () => {
    const transport = makeTransport();
    const { establishBackendSession } = await import("../backendSession");

    const result = await establishBackendSession({ name: "ghost" }, transport);

    expect(result).toEqual({ ok: false, reason: "no-user" });
    expect(transport.post).not.toHaveBeenCalled();
  });
});

describe("clearBackendSession", () => {
  it("POSTs logout and clears the marker in API mode", async () => {
    vi.stubEnv("VITE_API_URL", "http://127.0.0.1:8000");
    const transport = makeTransport();
    const { establishBackendSession, clearBackendSession } = await import(
      "../backendSession"
    );
    seedDirectory([DIR_USER]);

    await establishBackendSession(DIR_USER, transport);
    await clearBackendSession(transport);

    expect(transport.post).toHaveBeenCalledWith("/api/accounts/logout/", {});
    expect(sessionStorage.getItem("trianxtBackendSessionFor")).toBeNull();
  });

  it("no-ops when API mode is off", async () => {
    vi.stubEnv("VITE_API_URL", "");
    const transport = makeTransport();
    const { clearBackendSession } = await import("../backendSession");

    await clearBackendSession(transport);

    expect(transport.post).not.toHaveBeenCalled();
  });
});
