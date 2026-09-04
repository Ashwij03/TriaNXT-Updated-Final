
// newly added

import "./DashboardCard.css";

function DashboardCard({
  title,
  children,
  className = ""
}: any) {

  return (

    <div className={`dashboard-widget-card${className ? ` ${className}` : ""}`}>

      <div className="dashboard-widget-header">

        <h3>{title}</h3>

      </div>

      <div className="dashboard-widget-body">

        {children}

      </div>

    </div>

  );
}

export default DashboardCard;