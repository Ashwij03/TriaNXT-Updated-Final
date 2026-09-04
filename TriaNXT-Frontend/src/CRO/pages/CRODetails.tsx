import "../styles/CROOversight.css";

function CRODetails({ cro }: any) {
  if (!cro) {
    return null;
  }

  return (
    <div className="table-section">
      <h2>CRO Details — {cro.name}</h2>
      <div className="cro-detail-grid">
        <div>
          <label>CRO ID</label>
          <span>{cro.id}</span>
        </div>
        <div>
          <label>Organization</label>
          <span>{cro.name}</span>
        </div>
        <div>
          <label>Active Studies</label>
          <span>{cro.studies}</span>
        </div>
        <div>
          <label>Monitored Sites</label>
          <span>{cro.sites}</span>
        </div>
        <div>
          <label>Status</label>
          <span>{cro.status}</span>
        </div>
        <div>
          <label>Contract End</label>
          <span>{cro.contractEnd}</span>
        </div>
        <div>
          <label>Primary Contact</label>
          <span>monitor@{String(cro.name).toLowerCase().replace(/\s+/g, "")}.com</span>
        </div>
        <div>
          <label>Oversight Level</label>
          <span>Full Monitoring</span>
        </div>
      </div>
    </div>
  );
}

export default CRODetails;
