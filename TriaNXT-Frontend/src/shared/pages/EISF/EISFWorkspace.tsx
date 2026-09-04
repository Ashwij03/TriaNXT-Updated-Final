import EISFDashboard from "./EDashboard/EISFDashboard";
function EISFWorkspace({ studyCode }: any) {
  return (
  <div className="module-card">
    <EISFDashboard studyCode={studyCode} />
  </div>
);
}

export default EISFWorkspace;
