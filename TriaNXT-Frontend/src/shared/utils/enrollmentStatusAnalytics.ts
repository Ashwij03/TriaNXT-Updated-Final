import { normalizeStatus } from "./normalizeStatus";
import { SUBJECT_STATUS_ORDER } from "./subjectStatusAnalytics";

export const ENROLLMENT_BAR_ORDER = [
  "Screened",
  "Enrolled",
  "Ongoing",
  "Completed",
  "Discontinued"
];

function toEnrollmentBarCategory(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "Withdrawn" || normalized === "Dropout") {
    return "Discontinued";
  }

  return normalized;
}

export function getEnrollmentStatusAnalytics(subjects: any = [],options: any = {}) {
  const { studyCode = null, studies = [] } = options;

  if (studyCode) {
    const studySubjects = subjects.filter((subject) => {
      const key =
        subject.studyId ||
        subject.studyKey ||
        subject.study ||
        subject.studyCode;

      return String(key) === String(studyCode);
    });

    const counts = Object.fromEntries(
      ENROLLMENT_BAR_ORDER.map((name) => [name, 0])
    );

    studySubjects.forEach((subject) => {
      const category = toEnrollmentBarCategory(subject?.status);

      if (category && counts[category] !== undefined) {
        counts[category] += 1;
      }
    });

    return ENROLLMENT_BAR_ORDER.map((name) => ({
      name,
      value: counts[name]
    }));
  }

  const studyCounts = new Map();

  studies.forEach((study) => {
    const code = study.code || study.studyId || study.id || study.name;

    if (code) {
      studyCounts.set(String(code), Number(study.enrolled) || 0);
    }
  });

  subjects.forEach((subject) => {
    const key = String(
      subject.studyId ||
        subject.studyKey ||
        subject.study ||
        subject.studyCode ||
        ""
    );

    if (!key) {
      return;
    }

    if (!studyCounts.has(key)) {
      studyCounts.set(key, 0);
    }

    studyCounts.set(key, (studyCounts.get(key) || 0) + 1);
  });

  return Array.from(studyCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export { SUBJECT_STATUS_ORDER };
