// AlertsPanel — reused enterprise-style alerts card.
// Public API is unchanged: consumers still pass { title, alerts } where
// each alert is { type, title, message }. Internally the component now
// derives a live summary and applies an enterprise-grade layout, but
// no business logic has changed and no new widgets are introduced.

import React, { useMemo } from "react";

import "./AlertsPanel.css";

const ALERT_TYPE_META = {
  danger: { label: "Critical", icon: "!", tone: "danger" },
  warning: { label: "Warning", icon: "!", tone: "warning" },
  success: { label: "Resolved", icon: "\u2713", tone: "success" },
  info: { label: "Info", icon: "i", tone: "info" },
};

function getAlertMeta(type) {
  return ALERT_TYPE_META[type] || ALERT_TYPE_META.info;
}

function AlertsPanel({ title = "Alerts", alerts = [] }: any) {
  const safeAlerts = useMemo(
    () => (Array.isArray(alerts) ? alerts : []),
    [alerts],
  );

  const summary = useMemo(() => {
    return safeAlerts.reduce(
      (acc, alert) => {
        const key = ALERT_TYPE_META[alert?.type] ? alert.type : "info";
        acc[key] = (acc[key] || 0) + 1;
        acc.total += 1;
        return acc;
      },
      { total: 0, danger: 0, warning: 0, success: 0, info: 0 },
    );
  }, [safeAlerts]);

  return (
    <section
      className="alerts-card alerts-card--enterprise"
      aria-label={title}
    >
      <header className="alerts-header">
        <div className="alerts-header__titles">
          <h3>{title}</h3>
          <p className="alerts-subtitle">
            {summary.total > 0
              ? `${summary.total} active signal${summary.total === 1 ? "" : "s"}`
              : "All clear — no active signals"}
          </p>
        </div>

        <div className="alerts-summary" role="list">
          <span className="alerts-summary__chip alerts-summary__chip--danger" role="listitem">
            <span className="alerts-summary__dot" aria-hidden="true" />
            {summary.danger} Critical
          </span>
          <span className="alerts-summary__chip alerts-summary__chip--warning" role="listitem">
            <span className="alerts-summary__dot" aria-hidden="true" />
            {summary.warning} Warning
          </span>
          <span className="alerts-summary__chip alerts-summary__chip--info" role="listitem">
            <span className="alerts-summary__dot" aria-hidden="true" />
            {summary.info} Info
          </span>
        </div>
      </header>

      <div className="alerts-body">
        {safeAlerts.length > 0 ? (
          safeAlerts.map((alert, index) => {
            const meta = getAlertMeta(alert?.type);

            return (
              <article
                key={`${alert?.title || "alert"}-${index}`}
                className={`alert-item alert-item--${meta.tone}`}
              >
                <div
                  className={`alert-icon alert-icon--${meta.tone}`}
                  aria-hidden="true"
                >
                  {meta.icon}
                </div>

                <div className="alert-content">
                  <div className="alert-meta">
                    <span className={`alert-badge alert-badge--${meta.tone}`}>
                      {meta.label}
                    </span>
                  </div>

                  <div className="alert-title">{alert?.title}</div>

                  <div className="alert-message">{alert?.message}</div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="no-alerts">
            <div className="no-alerts__icon" aria-hidden="true">
              &#10003;
            </div>
            <div className="no-alerts__title">You&rsquo;re all caught up</div>
            <div className="no-alerts__message">
              No active alerts for this view.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default AlertsPanel;