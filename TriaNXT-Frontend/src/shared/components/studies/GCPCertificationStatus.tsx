import { FiAward } from "react-icons/fi";
import { GCP_CERT_BUCKETS } from "../../utils/siteStatusNormalizer";

function GCPCertificationStatus({ counts }: any) {
  const data = counts || {};
  const total = GCP_CERT_BUCKETS.reduce(
    (sum, key) => sum + (data[key] || 0),
    0
  );

  return (
    <div className="study-widget-card">
      <div className="study-widget-header">
        <FiAward />
        <h3>GCP Certification Status</h3>
      </div>
      {total === 0 ? (
        <p className="study-widget-empty">No GCP certification records found</p>
      ) : (
        <div className="study-status-grid">
          {GCP_CERT_BUCKETS.map((label) => (
            <div key={label} className={`study-status-chip gcp-${label.toLowerCase()}`}>
              <span className="study-status-count">{data[label] || 0}</span>
              <span className="study-status-label">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GCPCertificationStatus;
