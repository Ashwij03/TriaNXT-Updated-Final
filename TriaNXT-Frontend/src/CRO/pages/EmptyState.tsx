import React from "react";
import { FaInbox } from "react-icons/fa";
import "../styles/EmptyState.css";

function EmptyState({ title = "No Data Found", message = "There are no items to display yet." }: any) {
  return (
    <div className="cro-empty-state">
      <FaInbox className="cro-empty-icon" />
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

export default EmptyState;
