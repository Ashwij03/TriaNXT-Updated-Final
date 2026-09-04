import React from "react";
import {
  MdFolderOpen,
  MdUnfoldMore,
  MdUnfoldLess,
} from "react-icons/md";

/**
 * Subject Explorer - sidebar header.
 *
 * Title + subject count, plus expand-all / collapse-all controls.
 * Presentational: all state lives in SubjectExplorer.
 *
 * Phase 10: styled (via SubjectExplorer.css) to match the top-level
 * "SUBJECTS" header treatment used by the eISF sidebar title
 * (bold, sticky, bordered) - no eISF component or class is imported here.
 */
function SubjectSidebarHeader({
  subjectCount = 0,
  allExpanded = false,
  onExpandAll,
  onCollapseAll,
  onTitleClick,
}: any) {
  return (
    <div className="sx-header">
      {/* Update 4: clicking "Subjects" returns to the existing All Subjects
          view (same navigation `StudySubjectsWorkspace`'s own "Back to
          Subjects" button uses - no duplicate nav path). Only interactive
          when a handler is supplied, so the standalone `/subjects` page
          (which does not pass one) keeps today's plain header. */}
      {onTitleClick ? (
        <button
          type="button"
          className="sx-header-title sx-header-title--link"
          onClick={onTitleClick}
          title="Back to All Subjects"
        >
          <MdFolderOpen size={16} className="sx-header-icon" />
          <span>Subjects</span>
          <span className="sx-header-count">{subjectCount}</span>
        </button>
      ) : (
        <div className="sx-header-title">
          <MdFolderOpen size={16} className="sx-header-icon" />
          <span>Subjects</span>
          <span className="sx-header-count">{subjectCount}</span>
        </div>
      )}

      <button
        type="button"
        className="sx-header-action"
        title={allExpanded ? "Collapse all" : "Expand all"}
        aria-label={allExpanded ? "Collapse all" : "Expand all"}
        onClick={allExpanded ? onCollapseAll : onExpandAll}
      >
        {allExpanded ? <MdUnfoldLess size={16} /> : <MdUnfoldMore size={16} />}
      </button>
    </div>
  );
}

export default SubjectSidebarHeader;
