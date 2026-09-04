import { describe, it, expect, beforeEach } from "vitest";
import {
  addCandidate,
  getCandidates,
  getCandidate,
  getScoringConfig,
  setScoringConfig,
  sendQuestionnaire,
  submitQuestionnaireResponse,
  scoreCandidate,
  decideCandidate,
  convertCandidateToSite,
  deleteCandidate,
  getCandidateStatusCounts,
} from "../feasibilityService";

describe("feasibilityService (M23 / spec 6.30)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function candidateAtEachStage() {
    const candidate = addCandidate({
      studyCode: "STDY-001",
      institution: "Riverside Medical",
      contactName: "Dr. K. Patel",
    });
    sendQuestionnaire(candidate.id);
    submitQuestionnaireResponse(candidate.id, {
      patientPopulation: 150,
      competingTrials: false,
      infrastructure: "Dedicated research suite",
      staffAvailability: "2 FTE coordinators",
    });
    scoreCandidate(candidate.id, {
      population: 90,
      competingTrials: 80,
      infrastructure: 85,
      staff: 80,
      timeline: 70,
    });
    return candidate;
  }

  it("adds a candidate in Identified state", () => {
    const candidate = addCandidate({ institution: "Riverside Medical" });
    expect(candidate.status).toBe("Identified");
    expect(candidate.score).toBeNull();
    expect(getCandidates("STDY-001")).toHaveLength(0);
    expect(getCandidates()).toHaveLength(1);
  });

  it("requires an institution name", () => {
    expect(() => addCandidate({})).toThrow(/Institution/);
  });

  it("walks Identified -> Questionnaire Sent -> Scored", () => {
    const candidate = addCandidate({ institution: "Riverside Medical" });
    expect(sendQuestionnaire(candidate.id).status).toBe("Questionnaire Sent");

    const scored = scoreCandidate(candidate.id, {
      population: 100,
      competingTrials: 100,
      infrastructure: 100,
      staff: 100,
      timeline: 100,
    });
    expect(scored.status).toBe("Scored");
    expect(scored.score).toBe(100);
  });

  it("computes the weighted score from study criteria", () => {
    const candidate = addCandidate({ studyCode: "STDY-001", institution: "A" });
    sendQuestionnaire(candidate.id);
    // Default weights: population .35, competingTrials .2, infrastructure
    // .2, staff .15, timeline .1 — only population scores 100 => 35.
    const scored = scoreCandidate(candidate.id, {
      population: 100,
      competingTrials: 0,
      infrastructure: 0,
      staff: 0,
      timeline: 0,
    });
    expect(scored.score).toBe(35);
  });

  it("cannot be scored before the questionnaire is sent", () => {
    const candidate = addCandidate({ institution: "A" });
    expect(() =>
      scoreCandidate(candidate.id, {
        population: 90,
        competingTrials: 90,
        infrastructure: 90,
        staff: 90,
        timeline: 90,
      })
    ).toThrow(/questionnaire/);
  });

  it("stores a custom per-study scoring configuration", () => {
    setScoringConfig("STDY-001", {
      criteria: [
        { key: "population", label: "Patient population", weight: 0.6 },
        { key: "infrastructure", label: "Infrastructure", weight: 0.4 },
      ],
      minScore: 70,
    });
    const config = getScoringConfig("STDY-001");
    expect(config.minScore).toBe(70);
    expect(() =>
      setScoringConfig("STDY-001", {
        criteria: [{ key: "population", label: "Population", weight: 0.5 }],
        minScore: 70,
      })
    ).toThrow(/sum to 1/);
  });

  it("requires a rationale for any selection decision", () => {
    const candidate = candidateAtEachStage();
    expect(() => decideCandidate(candidate.id, "Rejected", "")).toThrow(
      /rationale/
    );
    expect(() => decideCandidate(candidate.id, "Selected", "")).toThrow(
      /rationale/
    );
  });

  it("rejects below-threshold scores from selection", () => {
    const low = addCandidate({ studyCode: "STDY-001", institution: "Low" });
    sendQuestionnaire(low.id);
    scoreCandidate(low.id, {
      population: 40,
      competingTrials: 40,
      infrastructure: 40,
      staff: 40,
      timeline: 40,
    });
    expect(() =>
      decideCandidate(low.id, "Selected", "Seems viable.")
    ).toThrow(/below the study selection threshold/);
  });

  it("selects a qualifying candidate and converts it to a site stub", () => {
    const candidate = candidateAtEachStage();
    const selected = decideCandidate(
      candidate.id,
      "Selected",
      "Population and infrastructure fit the protocol."
    );
    expect(selected.status).toBe("Selected");

    const converted = convertCandidateToSite(candidate.id);
    expect(converted.converted.siteCode).toMatch(/^ST-/);
    expect(converted.converted.siteName).toBe("Riverside Medical");
    // Questionnaire history is preserved on the site stub
    expect(converted.converted.questionnaire.patientPopulation).toBe(150);

    expect(() => convertCandidateToSite(candidate.id)).toThrow(
      /already been converted/
    );
  });

  it("only converts Selected candidates", () => {
    const candidate = addCandidate({ institution: "A" });
    sendQuestionnaire(candidate.id);
    expect(() => convertCandidateToSite(candidate.id)).toThrow(
      /Selected candidates/
    );
  });

  it("keeps rejected candidates searchable and blocks their deletion", () => {
    const candidate = candidateAtEachStage();
    decideCandidate(candidate.id, "Rejected", "Overlapping competing trial.");
    expect(getCandidate(candidate.id).status).toBe("Rejected");
    expect(() => deleteCandidate(candidate.id)).toThrow(/retained/);
  });

  it("counts candidates per status for the pipeline dashboard", () => {
    const a = candidateAtEachStage();
    decideCandidate(a.id, "Selected", "Good fit.");
    const b = addCandidate({ institution: "B" });
    const counts = getCandidateStatusCounts(getCandidates());
    expect(counts.Selected).toBe(1);
    expect(counts.Identified).toBe(1);
    expect(counts.Converted).toBe(0);
    convertCandidateToSite(a.id);
    expect(getCandidateStatusCounts(getCandidates()).Converted).toBe(1);
    expect(() => deleteCandidate(b.id)).not.toThrow();
  });
});
