import "./StatusBadge.css";

export default function StatusBadge({ status }: any) {
  const label = status || "Draft";
  const cls = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <span className={`status-badge ${cls}`}>
      {label}
    </span>
  );
}
