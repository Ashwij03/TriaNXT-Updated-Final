import React from "react";

function PIKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "blue",
  onClick,
  clickable = false,
}: any) {
  const isClickable = clickable || Boolean(onClick);

  return (
    <div
      className={`pi-card pi-kpi-card${isClickable ? " pi-kpi-clickable" : ""}`}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div className="card-header">
        {Icon && (
          <div className={`icon-circle ${color}`}>
            <Icon />
          </div>
        )}
        <div className="card-content">
          <span className="card-title">{title}</span>
          <span className="card-value">{value}</span>
          {subtitle && <span className="card-subtitle">{subtitle}</span>}
        </div>
      </div>
    </div>
  );
}

export default PIKpiCard;
