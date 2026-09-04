import React from "react";
import "../styles/StatusBadge.css";

const STATUS_MAP = {
  Completed: "completed",
  Pending: "pending",
  Scheduled: "scheduled",
  Approved: "approved",
  Expired: "expired",
  Active: "active",
  Generated: "completed",
  Unread: "pending",
  Read: "completed",
  Open: "pending",
  Answered: "approved",
  Closed: "completed",
};

function StatusBadge({ status }: any) {
  const variant = STATUS_MAP[status] || "default";

  return (
    <span className={`cro-status-badge cro-status-badge--${variant}`}>
      {status}
    </span>
  );
}

export default StatusBadge;
