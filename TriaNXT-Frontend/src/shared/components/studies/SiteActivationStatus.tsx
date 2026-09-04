import { FiMapPin } from "react-icons/fi";
import { SITE_ACTIVATION_BUCKETS } from "../../utils/siteStatusNormalizer";

function SiteActivationStatus({ counts }: any) {
  const data = counts || {};
  const total = SITE_ACTIVATION_BUCKETS.reduce(
    (sum, key) => sum + (data[key] || 0),
    0
  );

  return (
    <div className="study-widget-card">
      <div className="study-widget-header">
        <FiMapPin />
        <h3>Site Activation Status</h3>
      </div>
      {total === 0 ? (
        <p className="study-widget-empty">No site activation data available</p>
      ) : (
        <div className="study-status-grid">
          {SITE_ACTIVATION_BUCKETS.map((label) => (
            <div key={label} className="study-status-chip">
              <span className="study-status-count">{data[label] || 0}</span>
              <span className="study-status-label">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SiteActivationStatus;
