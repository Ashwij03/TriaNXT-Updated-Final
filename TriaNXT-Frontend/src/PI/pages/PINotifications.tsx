import React, { useEffect, useMemo, useState } from "react";
import {
  getNotificationsPageData,
  saveNotificationsPageData,
  filterByStudy,
  syncNotificationsPageToNavbar,
} from "./piDashboardService";

const PRIORITY_OPTIONS = ["All", "Critical", "High", "Medium", "Low"];
const CATEGORY_OPTIONS = [
  "All",
  "Upcoming Visits",
  "Regulatory Deadlines",
  "Safety Notifications",
  "Study Updates",
  "Recruitment Updates",
  "Compliance Alerts",
];

function PINotifications({ selectedStudy = "All Studies" }: any) {
  const [data, setData] = useState(() => getNotificationsPageData());
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    setData(getNotificationsPageData());
  }, [selectedStudy]);

  const persistNotifications = (updated) => {
    const unread = updated.items.filter((i) => i.status === "Unread").length;
    const alerts = updated.items.filter(
      (i) => i.priority === "High" || i.priority === "Critical"
    ).length;
    const saved = saveNotificationsPageData({
      ...updated,
      kpis: { ...updated.kpis, total: updated.items.length, unread, alerts },
    });
    syncNotificationsPageToNavbar(saved.items);
    setData(saved);
  };

  const toggleReadStatus = (id) => {
    const updatedItems = data.items.map((item) =>
      item.id === id
        ? { ...item, status: item.status === "Unread" ? "Read" : "Unread" }
        : item
    );
    persistNotifications({ ...data, items: updatedItems });
  };

  const filteredItems = useMemo(() => {
    let items = filterByStudy(data.items, selectedStudy);
    if (priorityFilter !== "All") {
      items = items.filter((i) => i.priority === priorityFilter);
    }
    if (categoryFilter !== "All") {
      items = items.filter((i) => i.category === categoryFilter);
    }
    if (statusFilter !== "All") {
      items = items.filter((i) => i.status === statusFilter);
    }
    return items;
  }, [data.items, selectedStudy, priorityFilter, categoryFilter, statusFilter]);

  const unreadFiltered = filteredItems.filter((i) => i.status === "Unread").length;
  const highPriority = filteredItems.filter(
    (i) => i.priority === "High" || i.priority === "Critical"
  ).length;
  const tasksDue = filteredItems.filter(
    (i) => i.status === "Unread" && i.priority !== "Low"
  ).length;

  const kpiItems = [
    { label: "Total Notifications", value: filteredItems.length, tone: "blue" },
    { label: "Unread", value: unreadFiltered, tone: "orange" },
    { label: "Tasks Due", value: tasksDue, tone: "purple" },
    { label: "Alerts", value: highPriority, tone: "red" },
  ];

  return (
    <div className="pi-page-content tnxt-compact">
      <div className="dashboard-header">
        <div>
          <h2>Notifications</h2>
          <p className="pi-subtitle">
            Stay updated on tasks and alerts
            {selectedStudy !== "All Studies" ? ` — ${selectedStudy}` : ""}
          </p>
        </div>
        <div className="dashboard-actions pi-filter-row">
          <select className="pi-filter-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p === "All" ? "All Priorities" : p}</option>
            ))}
          </select>
          <select className="pi-filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c === "All" ? "All Categories" : c}</option>
            ))}
          </select>
          <select className="pi-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Status</option>
            <option value="Unread">Unread</option>
            <option value="Read">Read</option>
          </select>
        </div>
      </div>

      <div className="pi-kpi-cards-grid">
        {kpiItems.map((kpi) => (
          <div key={kpi.label} className={`pi-enterprise-kpi ${kpi.tone} pi-kpi-clickable`}>
            <span className="pi-enterprise-kpi-label">{kpi.label}</span>
            <span className="pi-enterprise-kpi-value">{kpi.value}</span>
          </div>
        ))}
      </div>

      <div className="table-container">
        <div className="section-header">
          <h2>Recent Notifications</h2>
          <button
            type="button"
            className="view-all-btn"
            onClick={() => {
              setPriorityFilter("All");
              setCategoryFilter("All");
              setStatusFilter("All");
            }}
          >
            Clear Filters
          </button>
        </div>
        <div className="pi-table-responsive">
          <table className="pi-table ctms-standard-table">
            <thead>
              <tr>
                <th>Message</th>
                <th>Category</th>
                <th>Study</th>
                <th>Priority</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center" }}>
                    No notifications match the selected filters
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="pi-table-clickable"
                    onClick={() => toggleReadStatus(item.id)}
                  >
                    <td>{item.message}</td>
                    <td>{item.category || "—"}</td>
                    <td>{item.study || "—"}</td>
                    <td>
                      <span className={`pi-priority-badge ${item.priority.toLowerCase()}`}>
                        {item.priority}
                      </span>
                    </td>
                    <td>{item.date}</td>
                    <td>
                      <span className={item.status === "Unread" ? "status-danger" : "status-success"}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="view-all-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleReadStatus(item.id);
                        }}
                      >
                        Mark {item.status === "Unread" ? "Read" : "Unread"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default PINotifications;
