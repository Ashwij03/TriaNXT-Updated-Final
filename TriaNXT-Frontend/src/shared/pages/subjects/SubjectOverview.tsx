function SubjectOverview({ subject }: any) {
  return (
    <div className="subject-overview">
      <div className="subject-overview-details">
        <p>
          <strong>Subject ID:</strong> {subject.id}
        </p>
        <p>
          <strong>Status:</strong> {subject.status}
        </p>
        <p>
          <strong>Last Visit:</strong> {subject.currentVisit || "—"}
        </p>
      </div>
    </div>
  );
}

export default SubjectOverview;
