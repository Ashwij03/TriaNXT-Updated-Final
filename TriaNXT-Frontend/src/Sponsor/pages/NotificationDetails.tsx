import React from "react";
import AppLayout from "./AppLayout";
import { useLocation, useNavigate } from "react-router-dom";

const NotificationDetails = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const notification = location.state;

  if (!notification) {
    return (
      <AppLayout>
        <div style={{ padding: "1.5rem" }}>
          <h2>No Notification Selected</h2>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-container">
        <button
          type="button"
          className="back-btn"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>

        <h1>Notification Details</h1>

        <div className="kpi-grid">
          <div className="kpi-card">
            <h3>ID</h3>
            <h2>{notification.id || "—"}</h2>
          </div>

          <div className="kpi-card">
            <h3>Type</h3>
            <h2>{notification.type || "—"}</h2>
          </div>

          <div className="kpi-card">
            <h3>Severity</h3>
            <h2>{notification.severity || "—"}</h2>
          </div>

          <div className="kpi-card">
            <h3>Date</h3>
            <h2>{notification.date || "—"}</h2>
          </div>
        </div>

        <div className="details-card">
          <h2>Notification Information</h2>

          <div className="details-grid">
            <div>
              <strong>ID</strong>
              <p>{notification.id || "—"}</p>
            </div>

            <div>
              <strong>Type</strong>
              <p>{notification.type || "—"}</p>
            </div>

            <div>
              <strong>Severity</strong>
              <p>{notification.severity || "—"}</p>
            </div>

            <div>
              <strong>Message</strong>
              <p>{notification.message || "—"}</p>
            </div>
          </div>
        </div>

        <div className="details-card">
          <h2>Notification Summary</h2>

          <div className="details-grid">
            <div>
              <strong>Study</strong>
              <p>{notification.studyCode || "—"}</p>
            </div>

            <div>
              <strong>Date</strong>
              <p>{notification.date || "—"}</p>
            </div>

            <div>
              <strong>Severity</strong>
              <p>{notification.severity || "—"}</p>
            </div>

            <div>
              <strong>Status</strong>
              <p>{notification.read ? "Read" : "Unread"}</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default NotificationDetails;