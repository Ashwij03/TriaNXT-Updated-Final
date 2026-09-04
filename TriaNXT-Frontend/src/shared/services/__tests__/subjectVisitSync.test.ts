/**
 * Subjects & visits write-through mirror (extension of the six gap-module
 * integration): subjectService.writeSubjectsByStudy and
 * visitScheduleService.saveSchedules — the single write chokepoints behind
 * every enrollment / screening / visit action — must push their flat
 * collections to the FastAPI sync endpoints, and the boot hydration pulls
 * backend rows back into an empty store. gapSync's transport is mocked so
 * the tests observe the exact payloads without any network.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../gapSync", () => ({
  pullGapRecords: vi.fn(async () => null),
  syncGapCollection: vi.fn(),
}));

import { syncGapCollection, pullGapRecords } from "../gapSync";
import {
  buildSubjectSyncRecords,
  writeSubjectsByStudy,
  readSubjectsByStudy,
  hydrateSubjectsFromBackend,
  SUBJECTS_SYNC_ENDPOINT,
  SUBJECTS_LIST_ENDPOINT,
} from "../subjectService";
import {
  saveSchedules,
  hydrateVisitsFromBackend,
  VISITS_SYNC_ENDPOINT,
  VISITS_LIST_ENDPOINT,
} from "../visitScheduleService";

const SCHEDULES_KEY = "adminSchedules";

const SUBJECT_STORE = {
  "TNX-001": [
    { id: "S-1001", subjectId: "S-1001", studyId: "TNX-001", status: "Enrolled", site: "Site A" },
  ],
  "TNX-002": [
    { id: "S-1001", subjectId: "S-1001", studyId: "TNX-002", status: "Screened", site: "Site B" },
    { id: "S-2001", subjectId: "S-2001", studyId: "TNX-002", status: "Active", site: "Site B" },
  ],
};

const VISIT_ROWS = [
  {
    id: "TNX-001::S-1001::Screening",
    date: "2026-09-02",
    subjectId: "S-1001",
    visit: "Screening",
    status: "Completed",
    study: "TNX-001",
    time: "09:00 AM",
    studyKey: "TNX-001",
  },
];

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
});

describe("buildSubjectSyncRecords", () => {
  it("flattens study buckets into records, preserving fields and studyId", () => {
    const rows = buildSubjectSyncRecords(SUBJECT_STORE);
    expect(rows).toHaveLength(3);
    // Identical subject numbers in different studies stay separate rows.
    expect(rows.filter((r) => r.subjectId === "S-1001")).toHaveLength(2);
    expect(rows.map((r) => r.studyId).sort()).toEqual(["TNX-001", "TNX-002", "TNX-002"]);
    expect(rows[0].site).toBe("Site A");
  });

  it("returns [] for non-object stores and skips non-array buckets", () => {
    expect(buildSubjectSyncRecords(undefined)).toEqual([]);
    expect(buildSubjectSyncRecords(null)).toEqual([]);
    expect(buildSubjectSyncRecords({ "TNX-001": null, "TNX-002": [] })).toEqual([]);
  });
});

describe("subject write-through", () => {
  it("pushes the flat collection after every writeSubjectsByStudy call", () => {
    writeSubjectsByStudy(SUBJECT_STORE);
    expect(syncGapCollection).toHaveBeenCalledWith(
      SUBJECTS_SYNC_ENDPOINT,
      expect.arrayContaining([
        expect.objectContaining({ subjectId: "S-1001", studyId: "TNX-001" }),
        expect.objectContaining({ subjectId: "S-1001", studyId: "TNX-002" }),
      ])
    );
    const payload = (syncGapCollection as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(payload).toHaveLength(3);
  });
});

describe("visit write-through", () => {
  it("pushes schedule rows from saveSchedules (the enrollment/visit chokepoint)", () => {
    saveSchedules(VISIT_ROWS);
    expect(syncGapCollection).toHaveBeenCalledWith(VISITS_SYNC_ENDPOINT, VISIT_ROWS);
  });

  it("passes an empty array safely when schedules is not a list", () => {
    saveSchedules(undefined as never);
    expect(syncGapCollection).toHaveBeenCalledWith(VISITS_SYNC_ENDPOINT, []);
  });
});

describe("hydration", () => {
  it("subjects: pulls backend rows into an empty store, bucketed by studyId", async () => {
    const remote = [
      { subjectId: "S-9001", studyId: "ST-X", status: "Enrolled" },
      { subjectId: "S-9002", studyId: "ST-X", status: "Screened" },
    ];
    (pullGapRecords as ReturnType<typeof vi.fn>).mockResolvedValue(remote);
    await hydrateSubjectsFromBackend();
    expect(pullGapRecords).toHaveBeenCalledWith(SUBJECTS_LIST_ENDPOINT);
    const restored = readSubjectsByStudy();
    expect(restored["ST-X"]).toHaveLength(2);
    expect(restored["ST-X"].map((s) => s.subjectId).sort()).toEqual(["S-9001", "S-9002"]);
  });

  it("subjects: skips the pull when the local store already has rows", async () => {
    writeSubjectsByStudy(SUBJECT_STORE);
    await hydrateSubjectsFromBackend();
    expect(pullGapRecords).not.toHaveBeenCalledWith(
      SUBJECTS_LIST_ENDPOINT,
      expect.anything()
    );
  });

  it("visits: pulls backend rows into an empty schedule store", async () => {
    (pullGapRecords as ReturnType<typeof vi.fn>).mockResolvedValue(VISIT_ROWS);
    await hydrateVisitsFromBackend();
    expect(pullGapRecords).toHaveBeenCalledWith(VISITS_LIST_ENDPOINT);
    expect(JSON.parse(localStorage.getItem(SCHEDULES_KEY) as string)).toEqual(VISIT_ROWS);
  });

  it("visits: skips the pull when schedules already exist locally", async () => {
    saveSchedules(VISIT_ROWS);
    await hydrateVisitsFromBackend();
    expect(pullGapRecords).not.toHaveBeenCalledWith(
      VISITS_LIST_ENDPOINT,
      expect.anything()
    );
  });
});
