import "./KPICard.css";

function KPICard({
  title,
  value,
  subtitle,
  icon,
  variant = "blue",
  trend,
  onClick,
  layout = "column",
}: any) {
  const variantClass = variant ? ` enterprise-kpi--${variant}` : "";
  const layoutClass = layout === "row" ? " enterprise-kpi--row" : "";

  if (layout === "row") {
    return (
      <div
        className={`enterprise-kpi${variantClass}${layoutClass}`}
        onClick={onClick}
      >
        <div className="enterprise-kpi-icon">{icon}</div>

        <div className="enterprise-kpi-title">{title}</div>

        <div className="enterprise-kpi-value">{value}</div>
      </div>
    );
  }

  return (
    <div
      className={`enterprise-kpi${variantClass}`}
      onClick={onClick}
    >
      <div className="enterprise-kpi-icon">

        {icon}

      </div>

      <div className="enterprise-kpi-content">

        <div className="enterprise-kpi-title">

          {title}

        </div>

        <div className="enterprise-kpi-value">

          {value}

        </div>

        <div className="enterprise-kpi-sub">

          {subtitle}

        </div>

        {trend && (
          <div className="enterprise-kpi-trend">{trend}</div>
        )}

      </div>

    </div>

  );
}

export default KPICard;