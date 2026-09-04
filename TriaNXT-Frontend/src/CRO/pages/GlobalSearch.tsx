import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import { useCROData } from "./CRODATAContext";
import "../styles/GlobalSearch.css";

const LISTBOX_ID = "cro-global-search-listbox";

function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { globalSearch } = useCROData();
  const navigate = useNavigate();
  const wrapperRef = useRef(null);

  const results = query.trim().length >= 1 ? globalSearch(query) : [];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (result) => {
    setQuery("");
    setOpen(false);
    if (result.type === "Subject") {
      navigate(`/cro-subject/${result.id}`);
    } else {
      navigate(result.route);
    }
  };

  return (
    <div className="cro-global-search" ref={wrapperRef}>
      <FaSearch className="cro-global-search-icon" />
      <input
        type="text"
        className="cro-global-search-input"
        placeholder="Search subjects, visits, docs, reports..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        aria-label="Global search"
        aria-autocomplete="list"
        role="combobox"
        aria-controls={LISTBOX_ID}
        aria-expanded={open && query.trim().length >= 1}
      />
      {open && query.trim().length >= 1 && (
        <ul
          id={LISTBOX_ID}
          className="cro-global-search-dropdown"
          role="listbox"
        >
          {results.length === 0 ? (
            <li className="cro-global-search-empty">No results found</li>
          ) : (
            results.map((result) => (
              <li key={`${result.type}-${result.id}`}>
                <button
                  type="button"
                  className="cro-global-search-item"
                  onClick={() => handleSelect(result)}
                  role="option"
                  aria-selected="false"
                >
                  <span className="cro-global-search-type">{result.type}</span>
                  <span className="cro-global-search-label">{result.label}</span>
                  {result.sublabel && (
                    <span className="cro-global-search-sublabel">{result.sublabel}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default GlobalSearch;
