/**
 * gapSync — frontend <-> FastAPI integration engine for the six gap modules
 * ============================================================================
 * The gap pages (Amendments, IP, IRB, ICF, Vendors, Feasibility) persist to
 * localStorage through one write helper per module. When the app runs in
 * API mode (VITE_API_URL configured) those helpers now ALSO push the whole
 * collection to the module's backend sync endpoint, so the FastAPI side is
 * a live mirror of everything the pages create/change/delete — and the
 * boot-time pull hydration (used by the flagship modules) restores backend
 * data into a fresh browser whose local store is empty.
 *
 * Every function here is additive and fail-soft: if the backend is
 * unreachable, or API mode is off, local behavior is byte-identical to
 * before (no throw, no UI change). Tests can inject a fake transport.
 */

import { api, isApiEnabled } from "./api/client";

export interface GapPushResult {
  ok: boolean;
  created?: number;
  updated?: number;
  synced?: number;
  skipped?: unknown[];
}

/** POST a whole collection to the module sync endpoint (API mode only). */
export async function pushGapCollection(
  endpoint: string,
  records: any[],
  transport: any = api
): Promise<GapPushResult> {
  if (!isApiEnabled()) {
    return { ok: false };
  }
  try {
    const res: any = await transport.post(endpoint, { records });
    if (!res || typeof res !== "object") {
      return { ok: true };
    }
    return { ok: true, ...res };
  } catch {
    // Backend unreachable / not authenticated — local store still stands.
    return { ok: false };
  }
}

/** Fire-and-forget mirror push (used by each module's write helper). */
export function syncGapCollection(
  endpoint: string,
  records: any[],
  transport: any = api
): void {
  void pushGapCollection(endpoint, records, transport);
}

/** GET a collection from the backend (API mode only); null when disabled. */
export async function pullGapRecords(
  endpoint: string,
  transport: any = api
): Promise<any[] | null> {
  if (!isApiEnabled()) {
    return null;
  }
  try {
    const res: any = await transport.get(endpoint);
    return Array.isArray(res) ? res : null;
  } catch {
    return null;
  }
}
