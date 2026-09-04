/**
 * Scope assignment through the API — saveUserScopeWithBackend contract:
 *   * local patch happens first (same behavior as saveUserScope)
 *   * in API mode the backend user (matched by email) receives the PUT
 *     /api/accounts/users/{id}/scope/ with normalized codes
 *   * outcomes are explicit: persisted / no-backend-user / offline /
 *     forbidden / api-disabled — never a silent swallow
 *   * a 401 (stale Admin backend session) triggers one login + retry so the
 *     assignment still lands; other errors report offline without throwing
 *
 * isApiEnabled() reads import.meta.env.VITE_API_URL at module load, so the
 * roleService module is re-imported per scenario after stubbing the env.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const ADMIN = {
  id: 1,
  email: "admin1@demo.com",
  password: "Admin@123",
  name: "Alex Admin",
  role: "Admin",
};

const STAFF = { id: 7, email: "staff1@demo.com", role: "SiteStaff" };

function seedLocal(user: any, records: any[]) {
  localStorage.setItem("users", JSON.stringify(records));
  localStorage.setItem("currentUser", JSON.stringify(user));
}

function makeTransport(overrides: any = {}) {
  const calls: { endpoint: string; body?: any }[] = [];
  let putCount = 0;
  const transport = {
    calls,
    get: vi.fn(async (endpoint: string) => {
      calls.push({ endpoint });
      if (overrides.usersList !== undefined) {
        return overrides.usersList;
      }
      return [{ id: STAFF.id, email: STAFF.email, role_name: "SITE_STAFF" }];
    }),
    put: vi.fn(async (endpoint: string, body?: any) => {
      putCount += 1;
      calls.push({ endpoint, body });
      if (overrides.putErrorOnce && putCount === 1) {
        throw overrides.putErrorOnce;
      }
      if (overrides.putErrorEvery) {
        throw overrides.putErrorEvery;
      }
      return { id: STAFF.id, scope_data: body };
    }),
    post: vi.fn(async (endpoint: string, body?: any) => {
      calls.push({ endpoint, body });
      if (overrides.loginError) {
        throw overrides.loginError;
      }
      return { message: "Login successful" };
    }),
  };
  return transport;
}

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

async function loadRoleService() {
  const mod = await import("../roleService");
  return mod.saveUserScopeWithBackend;
}

describe("saveUserScopeWithBackend with API mode off", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "");
  });

  it("patches locally and reports api-disabled without transport calls", async () => {
    seedLocal(ADMIN, [ADMIN, STAFF]);
    const transport = makeTransport();
    const saveUserScopeWithBackend = await loadRoleService();

    const outcome = await saveUserScopeWithBackend(
      STAFF,
      { studies: ["TNX-001"], sites: ["SITE-01"] },
      transport
    );

    expect(outcome).toEqual({ persisted: false, reason: "api-disabled" });
    expect(transport.get).not.toHaveBeenCalled();
    expect(transport.put).not.toHaveBeenCalled();
    // Local patch still happened (scope survives offline).
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    expect(users.find((u: any) => u.email === STAFF.email).scope_data).toEqual({
      studies: ["TNX-001"],
      sites: ["SITE-01"],
    });
  });
});

describe("saveUserScopeWithBackend with API mode on", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "http://127.0.0.1:8000");
  });

  it("PUTs normalized scope to the backend user matched by email", async () => {
    seedLocal(ADMIN, [ADMIN, STAFF]);
    const transport = makeTransport();
    const saveUserScopeWithBackend = await loadRoleService();

    const outcome = await saveUserScopeWithBackend(
      STAFF,
      { studies: [" TNX-001 ", "TNX-001", ""], sites: [" SITE-01 ", ""] },
      transport
    );

    expect(outcome).toEqual({ persisted: true, reason: "persisted" });
    expect(transport.get).toHaveBeenCalledWith("/api/accounts/users/?page_size=100");
    expect(transport.put).toHaveBeenCalledWith(
      "/api/accounts/users/7/scope/",
      { studies: ["TNX-001"], sites: ["SITE-01"] }
    );
  });

  it("reports no-backend-user when the email has no accounts_user mirror", async () => {
    seedLocal(ADMIN, [ADMIN, STAFF]);
    const transport = makeTransport({ usersList: [] });
    const saveUserScopeWithBackend = await loadRoleService();

    const outcome = await saveUserScopeWithBackend(
      STAFF,
      { sites: ["SITE-01"] },
      transport
    );

    expect(outcome).toEqual({
      persisted: false,
      reason: "no-backend-user",
    });
    expect(transport.put).not.toHaveBeenCalled();
  });

  it("relogs in once on a 401 and retries the PUT", async () => {
    seedLocal(ADMIN, [ADMIN, STAFF]);
    const transport = makeTransport({ putErrorOnce: { status: 401 } });
    const saveUserScopeWithBackend = await loadRoleService();

    const outcome = await saveUserScopeWithBackend(
      STAFF,
      { sites: ["SITE-01"] },
      transport
    );

    expect(outcome).toEqual({ persisted: true, reason: "persisted" });
    expect(transport.put).toHaveBeenCalledTimes(2);
    // The retry login used the signed-in Admin's directory credentials.
    expect(transport.post).toHaveBeenCalledWith("/api/accounts/login/", {
      email: ADMIN.email,
      password: ADMIN.password,
    });
  });

  it("reports offline when the login retry also fails, without throwing", async () => {
    seedLocal(ADMIN, [ADMIN, STAFF]);
    const transport = makeTransport({
      putErrorEvery: { status: 401 },
      loginError: new Error("ECONNREFUSED"),
    });
    const saveUserScopeWithBackend = await loadRoleService();

    const outcome = await saveUserScopeWithBackend(
      STAFF,
      { sites: ["SITE-01"] },
      transport
    );

    expect(outcome).toEqual({ persisted: false, reason: "offline" });
    // Local patch still applied.
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    expect(users.find((u: any) => u.email === STAFF.email).scope_data.sites).toEqual([
      "SITE-01",
    ]);
  });

  it("reports forbidden on a 403", async () => {
    seedLocal(ADMIN, [ADMIN, STAFF]);
    const transport = makeTransport({ putErrorEvery: { status: 403 } });
    const saveUserScopeWithBackend = await loadRoleService();

    const outcome = await saveUserScopeWithBackend(
      STAFF,
      { sites: ["SITE-01"] },
      transport
    );

    expect(outcome).toEqual({ persisted: false, reason: "forbidden" });
  });
});
