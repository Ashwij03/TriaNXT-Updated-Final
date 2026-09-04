import "../styles/CROOversight.css";

const DEFAULT_CONTRACTS = [
  {
    id: "CRO-001",
    name: "ClinTech Research",
    studies: 3,
    sites: 8,
    status: "Active",
    contractEnd: "2026-12-31"
  },
  {
    id: "CRO-002",
    name: "Global CRO Partners",
    studies: 2,
    sites: 5,
    status: "Active",
    contractEnd: "2027-03-15"
  },
  {
    id: "CRO-003",
    name: "MedMonitor CRO",
    studies: 1,
    sites: 3,
    status: "Onboarding",
    contractEnd: "2026-09-30"
  }
];

function CROContracts({ onViewDetails }: any) {
  const contracts = (() => {
    try {
      const stored = JSON.parse(localStorage.getItem("croContracts"));
      return Array.isArray(stored) && stored.length > 0
        ? stored
        : DEFAULT_CONTRACTS;
    } catch {
      return DEFAULT_CONTRACTS;
    }
  })();

  return (
    <div className="table-section tnxt-compact">
      <h2>CRO Contracts</h2>
      <table className="cro-table ctms-standard-table">
        <thead>
          <tr>
            <th>CRO ID</th>
            <th>Organization</th>
            <th>Studies</th>
            <th>Sites</th>
            <th>Status</th>
            <th>Contract End</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract) => (
            <tr key={contract.id}>
              <td>{contract.id}</td>
              <td>{contract.name}</td>
              <td>{contract.studies}</td>
              <td>{contract.sites}</td>
              <td>{contract.status}</td>
              <td>{contract.contractEnd}</td>
              <td>
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => onViewDetails?.(contract)}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CROContracts;
