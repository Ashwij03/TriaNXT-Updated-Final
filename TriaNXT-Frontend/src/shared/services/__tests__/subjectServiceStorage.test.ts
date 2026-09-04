/**
 * Subject-store resilience contract for subjectService:
 *  1. writeSubjectsByStudy refuses non-object writes (an undefined write can
 *     never persist the literal string "undefined");
 *  2. readSubjectsByStudy self-heals — a corrupt live key falls back to the
 *     last-known-good .bak shadow backup instead of silently collapsing to {};
 *  3. repairSubjectStoreIfCorrupt() restores the backup at boot and no-ops on
 *     a healthy store (an empty {} store is healthy — never "repaired");
 *  4. every successful write keeps a .bak shadow copy.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  readSubjectsByStudy,
  writeSubjectsByStudy,
  repairSubjectStoreIfCorrupt,
} from "../subjectService";

const LIVE = "subjectsByStudy";
const BACKUP = "subjectsByStudy.bak";

const GOOD_STORE = {
  "TNX-001": [
    { id: "S-1001", subjectId: "S-1001", studyId: "TNX-001", status: "Enrolled" },
  ],
};

function seed(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("subjectService subject-store resilience", () => {
  it("refuses an undefined write — live store and shadow backup stay untouched", () => {
    seed(LIVE, GOOD_STORE);
    seed(BACKUP, GOOD_STORE);
    const liveBefore = localStorage.getItem(LIVE);
    const backupBefore = localStorage.getItem(BACKUP);

    // JSON.stringify(undefined) -> undefined -> localStorage.setItem coerces
    // it to the literal string "undefined"; the guard must refuse this class
    // of corrupting write before it reaches storage.
    writeSubjectsByStudy(undefined);

    expect(localStorage.getItem(LIVE)).toBe(liveBefore);
    expect(localStorage.getItem(BACKUP)).toBe(backupBefore);
  });

  it("refuses null and array writes as well", () => {
    seed(LIVE, GOOD_STORE);
    seed(BACKUP, GOOD_STORE);

    writeSubjectsByStudy(null);
    writeSubjectsByStudy([{ id: "S-9999" }]);

    expect(JSON.parse(localStorage.getItem(LIVE) as string)).toEqual(GOOD_STORE);
    expect(JSON.parse(localStorage.getItem(BACKUP) as string)).toEqual(GOOD_STORE);
  });

  it("restores a corrupt live key from the .bak backup on read", () => {
    seed(BACKUP, GOOD_STORE);
    // The exact observed corruption: a boot-time race persisting
    // JSON.stringify(undefined) -> the literal string "undefined".
    localStorage.setItem(LIVE, "undefined");

    const studies = readSubjectsByStudy();
    expect(studies).toEqual(GOOD_STORE);
    // Self-heal also rewrites the live key so subsequent reads are stable.
    expect(JSON.parse(localStorage.getItem(LIVE) as string)).toEqual(GOOD_STORE);
  });

  it("restores a live key holding non-JSON garbage from the .bak backup on read", () => {
    seed(BACKUP, GOOD_STORE);
    localStorage.setItem(LIVE, "{not json at all");

    expect(readSubjectsByStudy()).toEqual(GOOD_STORE);
    expect(JSON.parse(localStorage.getItem(LIVE) as string)).toEqual(GOOD_STORE);
  });

  it("boot repair restores the backup and reports the restored bucket count", () => {
    seed(BACKUP, GOOD_STORE);
    localStorage.setItem(LIVE, "undefined");

    const result = repairSubjectStoreIfCorrupt();
    expect(result.repaired).toBe(true);
    expect(result.buckets).toBe(1);
    expect(JSON.parse(localStorage.getItem(LIVE) as string)).toEqual(GOOD_STORE);
  });

  it("never repairs a legitimately empty store — an emptied {} is healthy", () => {
    seed(LIVE, {});
    seed(BACKUP, GOOD_STORE);

    expect(repairSubjectStoreIfCorrupt()).toEqual({ repaired: false });
    // readSubjectsByStudy also treats {} as healthy: no backup resurrection.
    expect(readSubjectsByStudy()).toEqual({});
    expect(localStorage.getItem(LIVE)).toBe("{}");
  });

  it("reports no-backup when both the live store and backup are absent", () => {
    expect(repairSubjectStoreIfCorrupt()).toEqual({
      repaired: false,
      reason: "no-backup",
    });
  });

  it("keeps a .bak shadow copy on every successful write", () => {
    writeSubjectsByStudy(GOOD_STORE);

    expect(JSON.parse(localStorage.getItem(LIVE) as string)).toEqual(GOOD_STORE);
    expect(JSON.parse(localStorage.getItem(BACKUP) as string)).toEqual(GOOD_STORE);
  });
});