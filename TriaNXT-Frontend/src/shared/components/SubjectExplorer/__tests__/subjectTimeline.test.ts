/**
 * subjectTimeline - pure builder tests. No storage involved: every source
 * (record, visits, consent events, files) is passed in explicitly.
 */
import { describe, it, expect } from "vitest";
import { buildSubjectTimeline } from "../subjectTimeline";

const RECORD = {
  id: "S-1",
  screeningDate: "2026-01-02",
  enrollmentDate: "2026-02-01",
  status: "Ongoing",
  updatedAt: "2026-03-01T12:00:00.000Z",
};

describe("buildSubjectTimeline", () => {
  it("merges status, visit, consent and document events newest-first", () => {
    const events = buildSubjectTimeline({
      record: RECORD,
      visits: [
        {
          id: 1,
          name: "Visit 1",
          plannedDate: "2026-03-01",
          actualDate: "2026-03-04",
          status: "Completed",
        },
        {
          id: 2,
          name: "Visit 2",
          plannedDate: "2026-04-01",
          status: "Scheduled",
        },
        {
          id: 3,
          name: "Visit 2 retry",
          plannedDate: "2026-03-02",
          status: "Missed",
        },
      ],
      consentEvents: [
        {
          id: "CNS-1",
          subjectId: "S-1",
          icfVersion: "1.0",
          date: "2026-01-05",
          createdAt: "2026-01-05T10:00:00.000Z",
          createdBy: "PI",
        },
      ],
      files: [
        { id: "F1", name: "consent.pdf", uploadedAt: "2026-01-05T11:00:00.000Z" },
        { id: "F2", name: "lab.xlsx", uploadedAt: "2026-03-04T09:00:00.000Z" },
      ],
    });

    const titles = events.map((e) => e.title);
    // Status steps (derived anchors, no recorded history).
    expect(titles).toContain("Screened");
    expect(titles).toContain("Enrolled");
    // Ongoing is beyond Enrolled in the canonical order -> recorded from
    // the record's updatedAt.
    expect(titles).toContain("Ongoing");
    // Completed visits and missed visits.
    expect(titles).toContain("Visit completed");
    expect(titles).toContain("Visit missed");
    // Scheduled (no completion) visit produces no event.
    expect(titles.filter((t) => t === "Visit completed")).toHaveLength(1);
    // Consent + documents.
    expect(titles).toContain("Consent signed (ICF v1.0)");
    expect(titles.filter((t) => t === "Document added")).toHaveLength(2);

    // Strictly descending timestamps.
    for (let i = 1; i < events.length; i += 1) {
      expect(events[i - 1].ts).toBeGreaterThanOrEqual(events[i].ts);
    }

    // Newest event is the lab document uploaded on 2026-03-04.
    expect(events[0]).toMatchObject({ kind: "document", detail: "lab.xlsx" });
  });

  it("does not double-report a step that has recorded status history", () => {
    const events = buildSubjectTimeline({
      record: {
        ...RECORD,
        status: "Withdrawn",
        statusHistory: [
          { status: "Screened", at: "2026-01-02T00:00:00.000Z", by: "PI" },
          { status: "Enrolled", at: "2026-02-01T00:00:00.000Z", by: "PI" },
          { status: "Withdrawn", at: "2026-03-20T00:00:00.000Z", by: "PI" },
        ],
      },
    });

    const titles = events.map((e) => e.title);
    expect(titles.filter((t) => t === "Screened")).toHaveLength(1);
    expect(titles.filter((t) => t === "Enrolled")).toHaveLength(1);
    expect(titles).toContain("Withdrawn");

    // Terminal transition carries the danger tone.
    const withdrawn = events.find((e) => e.title === "Withdrawn");
    expect(withdrawn.tone).toBe("danger");
    expect(withdrawn.by).toBe("PI");
  });

  it("drops events that have no usable date", () => {
    const events = buildSubjectTimeline({
      record: { ...RECORD, enrollmentDate: "—" },
      visits: [
        { id: 1, name: "No date yet", plannedDate: "", status: "Scheduled" },
      ],
      files: [{ id: "F1", name: "orphan.txt" }],
    });

    expect(events.some((e) => e.title === "Enrolled")).toBe(false);
    expect(events.some((e) => e.title === "No date yet")).toBe(false);
    expect(events.some((e) => e.detail === "orphan.txt")).toBe(false);
    expect(events.length).toBeGreaterThan(0); // Screened + Ongoing remain
  });

  it("caps the feed at MAX_EVENTS (60)", () => {
    const files = Array.from({ length: 80 }, (_, i) => ({
      id: `F${i}`,
      name: `file-${i}.pdf`,
      uploadedAt: new Date(2026, 0, 1, 0, i % 24, i).toISOString(),
    }));
    const events = buildSubjectTimeline({
      record: RECORD,
      files,
      visits: [
        {
          id: 1,
          name: "Visit 1",
          actualDate: "2026-03-01",
          status: "Completed",
        },
      ],
    });
    expect(events.length).toBe(60);
  });
});
