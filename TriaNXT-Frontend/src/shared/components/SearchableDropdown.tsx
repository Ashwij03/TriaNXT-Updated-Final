import { useEffect, useMemo, useRef, useState } from "react";
import "./SearchableDropdown.css";

const DEFAULT_VISIBLE = 5;

function sortOptions(options) {
  const allOption = options.find((option) => String(option.value) === "");
  const rest = options.filter((option) => String(option.value) !== "");

  const sortedRest = [...rest].sort((a, b) =>
    String(a.label).localeCompare(String(b.label), undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );

  return allOption ? [allOption, ...sortedRest] : sortedRest;
}

function SearchableDropdown({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  initialVisibleCount = DEFAULT_VISIBLE,
  className = ""
}: any) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  const sortedOptions = useMemo(() => sortOptions(options), [options]);

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return sortedOptions;
    }

    return sortedOptions.filter(
      (option) =>
        String(option.label).toLowerCase().includes(query) ||
        String(option.value).toLowerCase().includes(query)
    );
  }, [sortedOptions, search]);

  const visibleOptions = useMemo(() => {
    if (search.trim()) {
      return filteredOptions;
    }

    return filteredOptions.slice(0, initialVisibleCount);
  }, [filteredOptions, search, initialVisibleCount]);

  const selectedLabel =
    sortedOptions.find((option) => String(option.value) === String(value))
      ?.label || placeholder;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setOpen(false);
    setSearch("");
  };

  return (
    <div
      className={`searchable-dropdown ${className}`.trim()}
      ref={containerRef}
    >
      {label ? <label>{label}</label> : null}

      <button
        type="button"
        className="searchable-dropdown-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="searchable-dropdown-value">{selectedLabel}</span>
        <span className="searchable-dropdown-chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="searchable-dropdown-panel">
          <ul className="searchable-dropdown-list">
            {visibleOptions.map((option) => (
              <li key={String(option.value)}>
                <button
                  type="button"
                  className={
                    String(option.value) === String(value)
                      ? "searchable-dropdown-option is-selected"
                      : "searchable-dropdown-option"
                  }
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </button>
              </li>
            ))}

            {visibleOptions.length === 0 ? (
              <li className="searchable-dropdown-empty">No matches found</li>
            ) : null}
          </ul>

          <div className="searchable-dropdown-search">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default SearchableDropdown;