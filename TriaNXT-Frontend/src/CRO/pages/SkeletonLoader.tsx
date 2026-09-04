import React from "react";
import "../styles/SkeletonLoader.css";

function SkeletonLoader({ rows = 3, type = "table" }: any) {
  if (type === "cards") {
    return (
      <div className="cro-skeleton-cards">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="cro-skeleton-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="cro-skeleton-table">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="cro-skeleton-row" />
      ))}
    </div>
  );
}

export default SkeletonLoader;
