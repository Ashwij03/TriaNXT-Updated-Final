import "./VersionHistoryModal.css";

function getHistory(document) {
  const source = document.history || document.versions || [];

  if (!source.length) {
    return [
      {
        version: document.version || "1.0",
        date: document.modifiedDate || "-",
        user: document.uploadedBy || "Study Staff",
        status: document.status || "-",
      },
    ];
  }

  const unique = [];

  source.forEach((item) => {
    const exists = unique.some(
      (entry) => String(entry.version) === String(item.version)
    );

    if (!exists) {
      unique.push(item);
    }
  });

  return unique.sort((a, b) => {
    const va = parseFloat(a.version);
    const vb = parseFloat(b.version);

    if (!Number.isNaN(va) && !Number.isNaN(vb)) {
      return vb - va;
    }

    return String(b.version).localeCompare(String(a.version));
  });
}

export default function VersionHistoryModal({
  open,
  document,
  onClose
}: any) {
  if (!open || !document) return null;

  const history = getHistory(document);

  return (
    <div className="history-overlay tnxt-compact">
      <div className="history-modal">
        <div className="history-header">
          <h3>Version History</h3>
          <button type="button" onClick={onClose}>✕</button>
        </div>
        <div className="history-table-wrapper">
          <table className="history-table ctms-standard-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Date</th>
                <th>User</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {history.map((item, index) => (
                <tr key={`${item.version}-${index}`}>
                  <td>{item.version}</td>
                  <td>{item.date || item.createdAt || "-"}</td>
                  <td>{item.user || item.createdBy || "Study Staff"}</td>
                  <td>{item.status || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}