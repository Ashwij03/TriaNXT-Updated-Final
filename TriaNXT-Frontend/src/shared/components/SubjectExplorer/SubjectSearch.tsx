import React from "react";
import { MdSearch, MdClose } from "react-icons/md";

/**
 * Subject Explorer - search box.
 *
 * Filters the explorer tree as you type. Controlled component:
 * the value and handlers are owned by SubjectExplorer.
 *
 * Note: this is the *explorer* search and is intentionally separate
 * from the subject-table search in the main content toolbar.
 */
function SubjectSearch({ value, onChange, onClear }: any) {
  return (
    <div className="sx-search">
      <MdSearch size={15} className="sx-search-icon" />

      <input
        type="text"
        className="sx-search-input"
        placeholder="Filter folders..."
        aria-label="Filter subject folders"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />

      {value && (
        <button
          type="button"
          className="sx-search-clear"
          aria-label="Clear folder filter"
          onClick={onClear}
        >
          <MdClose size={13} />
        </button>
      )}
    </div>
  );
}

export default SubjectSearch;
