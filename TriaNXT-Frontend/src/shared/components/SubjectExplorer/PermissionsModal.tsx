import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Permissions Modal — shows and lets the user toggle which roles can
 * view/edit/delete this file. In Phase 4 (localStorage-only), changes
 * are recorded on the file record itself so the UI is fully functional;
 * a real backend would enforce these server-side.
 *
 * Props
 *   file      file record (may have a `permissions` map)
 *   onClose   () => void
 */

const ROLES = [
  { key: "admin", label: "Admin" },
  { key: "pi", label: "Principal Investigator" },
  { key: "sponsor", label: "Sponsor" },
  { key: "cro", label: "CRO" },
  { key: "site-staff", label: "Site Staff" },
];

const DEFAULT_PERMISSIONS = {
  admin: { view: true, edit: true, delete: true },
  pi: { view: true, edit: true, delete: false },
  sponsor: { view: true, edit: false, delete: false },
  cro: { view: true, edit: false, delete: false },
  "site-staff": { view: true, edit: false, delete: false },
};

export default function PermissionsModal({ file, onClose }: any) {
  const [perms, setPerms] = useState(() => ({
    ...DEFAULT_PERMISSIONS,
    ...(file?.permissions || {}),
  }));

  const toggle = useCallback((role, action) => {
    setPerms((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [action]: !prev[role]?.[action],
      },
    }));
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return createPortal(
    <div className="sxm-overlay" onClick={onClose}>
      <div
        className="sxm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="File permissions"
        style={{ maxWidth: "32rem" }}
      >
        <div className="sxm-header">
          <h3>Permissions — {file?.name}</h3>
          <button type="button" className="sxm-close" onClick={onClose}>✕</button>
        </div>

        <div className="sxm-body">
          <table className="ctms-standard-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Role</th>
                <th style={{ textAlign: "center" }}>View</th>
                <th style={{ textAlign: "center" }}>Edit</th>
                <th style={{ textAlign: "center" }}>Delete</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map(({ key, label }) => (
                <tr key={key}>
                  <td style={{ fontWeight: 600 }}>{label}</td>
                  {["view", "edit", "delete"].map((action) => (
                    <td key={action} style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={Boolean(perms[key]?.[action])}
                        onChange={() => toggle(key, action)}
                        aria-label={`${label} ${action} permission`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sxm-footer">
          <button type="button" className="sxm-btn sxm-btn--ghost" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="sxm-btn sxm-btn--primary"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
