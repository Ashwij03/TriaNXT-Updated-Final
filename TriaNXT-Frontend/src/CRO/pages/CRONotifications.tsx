import React, { useMemo, useState } from "react";
import CROLayout from "./CROLayout";
import { useCROData } from "./CRODATAContext";
import CROStatusBadge from "./CROStatusBadge";
import EmptyState from "./EmptyState";
import { markNotificationRead } from "../../shared/services/notificationService";
import { getCurrentUser } from "../../shared/services/roleService";

// Shared notification records (services/notificationService.js) carry
// title/message/studyCode/createdAt/read (boolean) -- not the
// type/status/date shape this page previously assumed, and this context
// never exposed markNotificationRead/addNotification in the first place
// (both were destructured as undefined, so "Mark Read" and
// "+ Create Notification" crashed on click). This map turns a shared
// record's title into a short category label for the Type column and a
// "critical" flag for the summary card, and reads/marks-read go straight
// through the shared notificationService instead of missing context
// helpers.
const CATEGORY_BY_TITLE = {
  "Subject added": "Subject",
  "Subject updated": "Subject",
  "Visit scheduled": "Visit",
  "Visit updated": "Visit",
  "Document added": "Document",
  "Report created": "Report",
  "Report updated": "Report",
  "New comment": "Comment",
  "Permission request submitted": "Access",
  "Permission request approved": "Access",
  "Permission request rejected": "Access",
};

const CRITICAL_TITLES = new Set<any>([
  "Permission request submitted",
  "Permission request rejected",
]);

function formatNotificationDate(isoString) {
  const parsed = new Date(isoString);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function CRONotifications() {
  const { notifications, showModal } = useCROData();

  const [searchTerm, setSearchTerm] = useState("");

  const items = useMemo(
    () =>
      notifications.map((notification) => ({
        ...notification,
        category: CATEGORY_BY_TITLE[notification.title] || "System",
        status: notification.read ? "Read" : "Unread",
        displayDate: formatNotificationDate(notification.createdAt),
      })),
    [notifications]
  );

  const filteredNotifications = items.filter((item) =>
    item.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const criticalCount = items.filter(
    (item) => CRITICAL_TITLES.has(item.title) && item.status === "Unread"
  ).length;

  const handleMarkRead = (notificationId) => {
    markNotificationRead(notificationId, getCurrentUser());
  };

  return (
    <CROLayout>
      <h1 style={{ marginBottom: "1.5625rem" }}>Notifications</h1>

      <div className="cro-summary-cards">
        <div className="dashboard-card">
          <h3>Total Notifications</h3>
          <h1>{items.length}</h1>
        </div>

        <div className="dashboard-card">
          <h3>Unread</h3>
          <h1>
            {items.filter((item) => item.status === "Unread").length}
          </h1>
        </div>

        <div className="dashboard-card">
          <h3>Read</h3>
          <h1>
            {items.filter((item) => item.status === "Read").length}
          </h1>
        </div>

        <div className="dashboard-card">
          <h3>Critical Alerts</h3>
          <h1>{criticalCount}</h1>
        </div>
      </div>

      <div className="cro-panel">
        <div className="cro-panel-header">
          <input
            type="text"
            placeholder="Search Notification..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          <h2 className="sr-only">Notification Actions</h2>
        </div>

        {filteredNotifications.length === 0 ? (
          <EmptyState title="No Notifications Found" />
        ) : (
          <div className="cro-table-wrap tnxt-compact">
            <table className="cro-data-table ctms-standard-table">
              <thead>
                <tr>
                  <th>Notification ID</th>
                  <th>Message</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredNotifications.map((notification) => (
                  <tr key={notification.id}>
                    <td>{notification.id}</td>
                    <td>{notification.message}</td>
                    <td>{notification.category}</td>
                    <td>{notification.displayDate}</td>

                    <td>
                      <CROStatusBadge
                        status={
                          notification.status === "Unread"
                            ? "Pending"
                            : "Completed"
                        }
                      />

                      <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem" }}>
                        {notification.status}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="cro-btn-sm"
                        onClick={() =>
                          showModal({
                            title: notification.id,
                            message: notification.message,
                          })
                        }
                      >
                        View
                      </button>

                      {notification.status === "Unread" && (
                        <button
                          type="button"
                          className="cro-btn-sm"
                          onClick={() => handleMarkRead(notification.id)}
                          style={{ marginLeft: "0.5rem" }}
                        >
                          Mark Read
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CROLayout>
  );
}

export default CRONotifications;