import React from 'react';
import '../styles/KpiCard.css';

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  iconBg,
  iconColor,
  onClick
}: any) {
  return (
    <div
      className="kpi-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="kpi-icon" style={{ backgroundColor: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div className="kpi-content">
        <h4 className="kpi-title">{title}</h4>
        <h2 className="kpi-value">{value}</h2>
        <p className="kpi-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}

export default KpiCard;
