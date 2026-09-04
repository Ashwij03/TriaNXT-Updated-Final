import React from "react";
import { MdPerson, MdFolder } from "react-icons/md";

/**
 * Subject Explorer - WORKSPACE BREADCRUMB (Phase 5)
 *
 * Renders the page breadcrumb, extended with one crumb per folder in the
 * current selection trail: Dashboard › Clinical Operations › Subjects ›
 * SUB-001 › Screening.
 *
 * Purely presentational - the crumb list is built by
 * `workspaceSelectionService.buildBreadcrumb`, so this component never
 * touches the tree or storage.
 *
 * Reuses the existing `sw-crumb*` classes from Subjects.css so the static
 * crumbs look exactly as they did in Phase 1; only the new folder crumbs add
 * `sw-crumb--folder` styling.
 *
 * Props
 *   crumbs     [{ id, label, to, type, isFolder, isCurrent }]
 *   onNavigate (to)      called for crumbs that have a route
 *   onSelect   (crumbId) called when a folder crumb is clicked
 */
function WorkspaceBreadcrumb({ crumbs = [], onNavigate, onSelect }: any) {
  if (crumbs.length === 0) return null;

  const activate = (crumb) => {
    if (crumb.isCurrent) return;
    if (crumb.to && typeof onNavigate === "function") {
      onNavigate(crumb.to);
      return;
    }
    // Folder crumbs jump the workspace back up the trail.
    if (crumb.isFolder && typeof onSelect === "function") onSelect(crumb.id);
  };

  return (
    <nav className="sw-breadcrumb" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => {
        const interactive =
          !crumb.isCurrent && (Boolean(crumb.to) || crumb.isFolder);

        const CrumbIcon =
          crumb.type === "subject"
            ? MdPerson
            : crumb.type === "folder"
            ? MdFolder
            : null;

        const className = [
          "sw-crumb",
          interactive ? "sw-crumb--link" : "",
          crumb.isFolder ? "sw-crumb--folder" : "",
          crumb.isCurrent ? "sw-crumb--current" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const content = (
          <>
            {CrumbIcon && (
              <CrumbIcon size={12} className="sw-crumb-icon" aria-hidden="true" />
            )}
            {crumb.label}
          </>
        );

        return (
          <React.Fragment key={`${crumb.id}-${index}`}>
            {index > 0 && (
              <span className="sw-crumb-sep" aria-hidden="true">
                ›
              </span>
            )}

            {crumb.isCurrent ? (
              <strong className={className} aria-current="page" title={crumb.label}>
                {content}
              </strong>
            ) : interactive ? (
              <span
                className={className}
                role="button"
                tabIndex={0}
                title={crumb.label}
                onClick={() => activate(crumb)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    activate(crumb);
                  }
                }}
              >
                {content}
              </span>
            ) : (
              <span className={className} title={crumb.label}>
                {content}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default WorkspaceBreadcrumb;
