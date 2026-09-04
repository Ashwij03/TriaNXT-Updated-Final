// gapSync — frontend <-> FastAPI mirror engine contract:
//   * API mode on  -> pushGapCollection POSTs {records} and surfaces the
//     server report; pullGapRecords returns the collection array
//   * API mode off -> every call no-ops (ok:false / null) and never fetches
//   * failures are swallowed (fail-soft) — local behavior never throws
//
// isApiEnabled() reads import.meta.env.VITE_API_URL at module load, so the
// module is re-imported per scenario after stubbing the env.

import { describe, expect, it, vi, beforeEach } from "vitest";

function makeTransport() {
  const calls: { endpoint: string; body?: any }[] = [];
  const transport = {
    calls,
    post: vi.fn(async (endpoint: string, body?: any) => {
      calls.push({ endpoint, body });
      return { synced: 3, created: 1, updated: 2, skipped: [] };
    }),
    get: vi.fn(async (endpoint: string) => {
      calls.push({ endpoint });
      return [{ id: "IRB-1" }, { id: "IRB-2" }];
    }),
  };
  return transport;
}

describe("gapSync in API mode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_API_URL", "http://127.0.0.1:8000");
  });

  it("pushGapCollection POSTs the whole collection and returns the report", async () => {
    const transport = makeTransport();
    const { pushGapCollection } = await import("../gapSync");
    const records = [{ id: "AMD-1" }, { id: "AMD-2" }, { id: "AMD-3" }];

    const report = await pushGapCollection(
      "/api/site/amendments/sync",
      records,
      transport
    );

    expect(transport.post).toHaveBeenCalledWith("/api/site/amendments/sync", {
      records,
    });
    expect(report).toMatchObject({ ok: true, synced: 3, updated: 2 });
  });

  it("pullGapRecords returns the collection array", async () => {
    const transport = makeTransport();
    const { pullGapRecords } = await import("../gapSync");
    const records = await pullGapRecords("/api/site/irb/", transport);
    expect(records).toEqual([{ id: "IRB-1" }, { id: "IRB-2" }]);
    expect(transport.get).toHaveBeenCalledWith("/api/site/irb/");
  });
});

describe("gapSync with API mode off (offline)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_API_URL", "");
  });

  it("pushGapCollection no-ops without calling the transport", async () => {
    const transport = makeTransport();
    const { pushGapCollection } = await import("../gapSync");

    const report = await pushGapCollection("/api/site/irb/sync", [{ id: "x" }], transport);

    expect(report).toEqual({ ok: false });
    expect(transport.post).not.toHaveBeenCalled();
  });

  it("pullGapRecords returns null without calling the transport", async () => {
    const transport = makeTransport();
    const { pullGapRecords } = await import("../gapSync");

    const records = await pullGapRecords("/api/site/irb/", transport);

    expect(records).toBeNull();
    expect(transport.get).not.toHaveBeenCalled();
  });
});
