import React, { useMemo } from "react";
import DataTable from "./dashboard/shared/DataTable";
import "./TrainingLog.css";

// ---- Refactored to mirror the DelegationLog architecture used by
// StudyLogsTab: the parent (StudyLogsTab) is the single source of truth
// and passes the training records down as a prop. The visual look
// (blue-link training name, delegate avatar strip, warning badge,
// hover tooltip) is preserved from the original static implementation
// — only the data source changed. ----
const TrainingLog = ({ records = [] }: any) => {
  // Normalize incoming records so the shared DataTable pipeline
  // (search / filter / pagination) sees stable primitive fields, while
  // the row-render still has access to the raw delegate array for the
  // avatar strip. `delegateNames` is a hidden searchable string that
  // lets users find rows by delegate name/role even though the visible
  // Delegates column shows avatars only.
  const normalizedRecords = useMemo(
    () =>
      (Array.isArray(records) ? records : []).map((item) => ({
        id: item.id,
        training: item.training || "",
        linkedDuties: item.linkedDuties || "",
        site: item.site || "",
        delegateCount: Array.isArray(item.delegates)
          ? item.delegates.length
          : 0,
        delegateNames: (Array.isArray(item.delegates) ? item.delegates : [])
          .map((d) => `${d.name || ""} ${d.role || ""}`.trim())
          .join(" | "),
        _raw: item
      })),
    [records]
  );

  const trainingColumns = useMemo(
    () => [
      {
        key: "training",
        label: "Training",
        render: (value) => <span className="blue-link">{value || "—"}</span>
      },
      { key: "linkedDuties", label: "Linked Duties" },
      {
        key: "delegateCount",
        label: "Delegates",
        render: (_value, row) => {
          const item = row._raw || {};
          const delegates = Array.isArray(item.delegates)
            ? item.delegates
            : [];
          if (delegates.length === 0) {
            return <span style={{ color: "#98a2b3" }}>—</span>;
          }
          return (
            <div className="delegate-icons">
              {delegates.map((delegate, idx) => (
                <div
                  key={`${delegate.name || "delegate"}-${idx}`}
                  className="delegate-wrapper"
                >
                  <div className="delegate-avatar">
                    <img
                      src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(
                        delegate.name || String(idx)
                      )}`}
                      alt=""
                    />
                    {delegate.status && delegate.status !== "complete" && (
                      <span
                        className={
                          delegate.status === "warning"
                            ? "training-warning"
                            : "warning"
                        }
                      >
                        {delegate.status === "warning" ? "▲" : "!"}
                      </span>
                    )}
                  </div>
                  <div className="delegate-tooltip">
                    <h4>{delegate.name || "—"}</h4>
                    <p>{delegate.role || ""}</p>
                    <span>
                      {(row.training || item.training || "Training")}{" "}
                      certification
                    </span>
                  </div>
                </div>
              ))}
            </div>
          );
        }
      }
    ],
    []
  );

  return (
    <div className="training-container tnxt-compact">
      <h2 className="delegation-title">C. Training Log</h2>

      {/* Same canonical DataTable pipeline that Delegation Log uses:
          authorized dataset → search / filters → pagination. Every
          action resets pagination via DataTable's internal effects. */}
      <DataTable
        columns={trainingColumns}
        data={normalizedRecords}
        emptyMessage="No training records found"
        searchable
        searchPlaceholder="Search trainings, duties or delegate names..."
        searchFields={["training", "linkedDuties", "delegateNames"]}
        filters={[{ key: "training", label: "Training" }]}
        pagination
        initialPageSize={10}
      />
    </div>
  );
};

export default TrainingLog;