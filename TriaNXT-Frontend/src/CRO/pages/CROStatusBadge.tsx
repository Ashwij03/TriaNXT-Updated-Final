import React from "react";
import "../styles/CROStatusBadge.css";

const STATUS_MAP = {
  Completed: "completed",
  Pending: "pending",
  Scheduled: "scheduled",
  Approved: "approved",
  Expired: "expired",
  Open: "open",
  Answered: "answered",
  Closed: "closed",
  Active: "active",
  // Subject-status tokens that can surface on CRO pages after the shared
  // subject-status contract was introduced (Enrolled/Ongoing normalize as
  // on-study; Screened as pre-enrollment; terminal states as withdrawn).
  Enrolled: "active",
  Ongoing: "active",
  Screened: "pending",
  Screening: "pending",
  Randomized: "active",
  Withdrawn: "expired",
  Dropout: "expired",
  Generated: "completed",
  Unread: "pending",
  Read: "completed",
  Excellent: "approved",
  Good: "scheduled",
  "At Risk": "expired",
};

function CROStatusBadge({ status }: any) {
  const variant = STATUS_MAP[status] || "default";

  return (
    <span className={`cro-status-badge cro-status-${variant}`}>
      {status}
    </span>
  );
}

export default CROStatusBadge;
