import "./AuditTrailModal.css";

function getAuditTrail(document) {
  const auditTrail = document.auditTrail || [];

  if (auditTrail.length) {
    return auditTrail;
  }

  return [
    {
      date: document.modifiedDate || "-",
      user: document.uploadedBy || "Study Staff",
      action: "Loaded",
      remarks: `Current status: ${document.status || "-"}`,
    },
  ];
}

export default function AuditTrailModal({
  open,
  document,
  onClose
}: any) {
  if (!open || !document) return null;

  const auditTrail = getAuditTrail(document);

  return (
    <div className="audit-overlay tnxt-compact">
      <div className="audit-modal">
        <div className="audit-header">
          <h3>Audit Trail</h3>
          <button type="button" onClick={onClose}>✕</button>
        </div>

        <table className="audit-table ctms-standard-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Action</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {auditTrail.map((item, index) => (
              <tr key={`${item.action}-${index}`}>
                <td>{item.date || item.createdAt || "-"}</td>
                <td>{item.user || item.createdBy || "Study Staff"}</td>
                <td>{item.action || "Updated"}</td>
                <td>{item.remarks || item.description || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
