import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/dashboard/shared/DashboardLayout";
import KPICard from "../../components/dashboard/shared/KPICard";
import StudyModal from "../../components/studies/StudyModal";
import { createStudy } from "../../services/studyService";
import { getSubjectsForStudy, resolveStudyKey } from "../../services/subjectService";
import {
  getAccessibleStudies,
  getCurrentUser,
} from "../../services/roleService";
import { canAddStudy } from "../../utils/contentAccess";
import { resolveSiteDisplay } from "../../utils/siteDisplay";
import { readStorage } from "../../utils/storageHelpers";
import {
  HEADER_FILTERS_EVENT,
  INSTITUTION_FILTER_EVENT,
  getStoredIndicationFilter,
  getStoredInstitutionFilter,
  getStoredSiteNumberFilter,
} from "../../constants/headerFilters";
import { getInstitutionForSiteNumber } from "../../services/filterService";
import {
  STUDY_STATUS_OPTIONS,
  STUDY_STATUS_DEFAULT,
  getStudyStatusClass,
} from "../../constants/studyStatus";
import {
  FiFolder,
  FiGrid,
  FiList,
  FiColumns,
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";

import "./Studies.css";

const STUDIES_PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

/**
 * Subject data access via subjectService — the single source of truth.
 */
function getSubjectsForStudyFromService(study) {
  try {
    const studyKey = resolveStudyKey(study);
    return getSubjectsForStudy(studyKey);
  } catch {
    return [];
  }
}

const initialForm = {
  code: "",
  name: "",
  protocol: "",
  indication: "",
  siteNumber: "",
  country: "",
  location: "",
  site: "",
  enrolled: "",
  targetSubjects: "",
  status: STUDY_STATUS_DEFAULT,
  principalInvestigator: "",
  sponsor: "",
  cro: "",
  startDate: "",
  completedDate: "",
  description: "",
};

function normalizeValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function readSiteRecords() {
  const sites = readStorage("sites", []);
  return Array.isArray(sites) ? sites : [];
}

function resolveStudySite(study, sites) {
  const siteReference = study?.site || study?.location;

  if (!siteReference) {
    return null;
  }

  const normalizedReference = normalizeValue(siteReference);

  return (
    sites.find((site) =>
      [site.siteNumber, site.id, site.name].some(
        (value) => normalizeValue(value) === normalizedReference
      )
    ) || null
  );
}

function getStudySiteNumber(study, sites) {
  const site = resolveStudySite(study, sites);

  return site?.siteNumber || site?.id || study?.siteNumber || "";
}

/**
 * Resolves the actual Site Name for a study by looking up its assigned
 * site record (matched via resolveStudySite, the same lookup used for the
 * Site Number column). Falls back to the raw site/location string stored
 * on the study when no matching site record exists yet. Deliberately does
 * NOT fall back to study.name — a study object always has its own `name`
 * field (the study title), and using that as a generic fallback caused the
 * Site Name column to silently display the study's name instead of the
 * site's name whenever no site record matched.
 */
function getStudySiteName(study, sites) {
  const site = resolveStudySite(study, sites);

  if (site) {
    return site.siteName || site.name || study?.site || study?.location || "";
  }

  return study?.site || study?.location || "";
}

/**
 * Display-only formatter that renders a date as "yyyy-mm-dd", matching the
 * Start Date column's format. Reads the calendar date directly off the
 * stored string when possible so no timezone conversion can shift the day.
 */
function formatDateYYYYMMDD(dateValue) {
  if (!dateValue) {
    return "-";
  }

  const raw = String(dateValue).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return raw;
}

function getStoredCompletedDateDisplay(study) {
  if (!study?.completedDate) {
    return "";
  }

  return formatDateYYYYMMDD(study.completedDate);
}

function Studies() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  // A2 (Role-Scoped Study Visibility): every role — including CRO — reads
  // through getAccessibleStudies() so the Studies list only ever shows
  // studies the current role is authorized to see. The sidebar
  // (useRoleStudiesSidebar) now reads through the same function, so the
  // sidebar count and this page's list/KPI stay in sync without falling
  // back to the unfiltered study list for any role.
  const loadStudies = useCallback(() => {
    const user = getCurrentUser();
    return getAccessibleStudies(user);
  }, []);

  const [studies, setStudies] = useState(() => loadStudies());
  const [sites, setSites] = useState(() => readSiteRecords());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sponsorFilter, setSponsorFilter] = useState("");
  // Task: Header Indication Link — the header's Indication dropdown now
  // routes here (see EnterpriseNavbarBase's updateFilter), so this page's
  // own Indication filter must open already scoped to whatever indication
  // was picked in the header, and stay in sync with it afterwards (see the
  // HEADER_FILTERS_EVENT listener below). The dropdown remains editable
  // locally same as before; it's simply re-synced whenever the header
  // filter changes.
  const [indicationFilter, setIndicationFilter] = useState(() =>
    getStoredIndicationFilter()
  );
  const [countryFilter, setCountryFilter] = useState("");
  const [sortBy, setSortBy] = useState("studyId");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Task 10 — Studies Page Header Filters: the header's Site Name / Site
  // Number dropdowns should scope this page's study list the same way
  // they scope the Dashboards, live, with no refresh required. Read the
  // current value on mount and stay in sync via the same events the
  // header itself dispatches when either dropdown changes.
  const [headerInstitutionFilter, setHeaderInstitutionFilter] = useState(() =>
    getStoredInstitutionFilter()
  );
  const [headerSiteNumberFilter, setHeaderSiteNumberFilter] = useState(() =>
    getStoredSiteNumberFilter()
  );

  useEffect(() => {
    const handleInstitutionEvent = (event) => {
      setHeaderInstitutionFilter(event?.detail || getStoredInstitutionFilter());
    };

    const handleHeaderFiltersEvent = () => {
      setHeaderInstitutionFilter(getStoredInstitutionFilter());
      setHeaderSiteNumberFilter(getStoredSiteNumberFilter());
      // Task: Header Indication Link — keep this page's Indication filter
      // in sync with the header's Indication dropdown too.
      setIndicationFilter(getStoredIndicationFilter());
    };

    window.addEventListener(INSTITUTION_FILTER_EVENT, handleInstitutionEvent);
    window.addEventListener(HEADER_FILTERS_EVENT, handleHeaderFiltersEvent);

    return () => {
      window.removeEventListener(
        INSTITUTION_FILTER_EVENT,
        handleInstitutionEvent
      );
      window.removeEventListener(
        HEADER_FILTERS_EVENT,
        handleHeaderFiltersEvent
      );
    };
  }, []);

  // Whichever of Site Name / Site Number is set (Site Number resolves to
  // its paired Site Name), narrowed the same way the Dashboards already do.
  const effectiveHeaderSite = useMemo(
    () =>
      headerInstitutionFilter ||
      getInstitutionForSiteNumber(headerSiteNumberFilter, currentUser),
    [headerInstitutionFilter, headerSiteNumberFilter, currentUser]
  );

  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem("studiesViewMode") || "grid";
  });

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [createError, setCreateError] = useState("");

  const canCreateStudy = canAddStudy(currentUser);

  const handleViewChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem("studiesViewMode", mode);
  };

  // Item 8: the study status filter always exposes the six canonical values,
  // regardless of what is currently present in the data set.
  const statusOptions = useMemo(() => STUDY_STATUS_OPTIONS, []);

  const sponsorOptions = useMemo(
    () => [...new Set<any>(studies.map((study) => study.sponsor).filter(Boolean))].sort(),
    [studies]
  );

  const indicationOptions = useMemo(
    () =>
      [...new Set<any>(studies.map((study) => study.indication).filter(Boolean))].sort(),
    [studies]
  );

  const countryOptions = useMemo(
    () => [...new Set<any>(studies.map((study) => study.country).filter(Boolean))].sort(),
    [studies]
  );

  const filteredStudies = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    const result = studies.filter((study) => {
      const searchableValues = [
        study.name,
        study.code,
        study.sponsor,
        study.cro,
        study.indication,
        study.principalInvestigator,
        study.location,
        study.country,
        study.status,
        study.protocol,
      ];

      const matchesSearch =
        !search ||
        searchableValues.some((value) =>
          String(value || "").toLowerCase().includes(search)
        );

      const matchesStatus = !statusFilter || study.status === statusFilter;
      const matchesSponsor = !sponsorFilter || study.sponsor === sponsorFilter;
      const matchesIndication =
        !indicationFilter || study.indication === indicationFilter;
      const matchesCountry = !countryFilter || study.country === countryFilter;

      // Task 10 — Studies Page Header Filters: narrow to studies at the
      // site selected via the header's Site Name / Site Number dropdown.
      const studySite = study.site || study.location || "";
      const matchesHeaderSite =
        !effectiveHeaderSite ||
        studySite === effectiveHeaderSite ||
        studySite.includes(effectiveHeaderSite) ||
        effectiveHeaderSite.includes(studySite);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSponsor &&
        matchesIndication &&
        matchesCountry &&
        matchesHeaderSite
      );
    });

    switch (sortBy) {
      case "studyId":
        return result.sort((a, b) => {
          const numA = Number(a.code);
          const numB = Number(b.code);

          if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
            return numA - numB;
          }

          return String(a.code || "").localeCompare(String(b.code || ""));
        });

      case "name":
        return result.sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""), undefined, {
            numeric: true,
            sensitivity: "base",
          })
        );

      case "startDate":
        return result.sort(
          (a, b) =>
            new Date(a.startDate || 0).getTime() -
            new Date(b.startDate || 0).getTime()
        );

      case "sponsor":
        return result.sort((a, b) =>
          String(a.sponsor || "").localeCompare(String(b.sponsor || ""))
        );

      default:
        return result.sort((a, b) => {
          const numA = Number(a.code);
          const numB = Number(b.code);

          if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
            return numA - numB;
          }

          return String(a.code || "").localeCompare(String(b.code || ""));
        });
    }
  }, [
    studies,
    searchTerm,
    statusFilter,
    sponsorFilter,
    indicationFilter,
    countryFilter,
    effectiveHeaderSite,
    sortBy,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStudies.length / pageSize)
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    statusFilter,
    sponsorFilter,
    indicationFilter,
    countryFilter,
    effectiveHeaderSite,
    sortBy,
    viewMode,
    pageSize,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const refreshStudies = () => {
      setStudies(loadStudies());
      setSites(readSiteRecords());
    };

    const refreshSubjects = () => {
      // Subject data now flows through subjectService — no local state refresh needed
    };

    window.addEventListener("studies-updated", refreshStudies);
    window.addEventListener("sponsor-data-updated", refreshStudies);
    window.addEventListener("admin-data-updated", refreshStudies);
    window.addEventListener("subjects-updated", refreshSubjects);
    window.addEventListener("storage", refreshSubjects);

    return () => {
      window.removeEventListener("studies-updated", refreshStudies);
      window.removeEventListener("sponsor-data-updated", refreshStudies);
      window.removeEventListener("admin-data-updated", refreshStudies);
      window.removeEventListener("subjects-updated", refreshSubjects);
      window.removeEventListener("storage", refreshSubjects);
    };
  }, [loadStudies]);

  const paginatedStudies = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;

    return filteredStudies.slice(
      startIndex,
      startIndex + pageSize
    );
  }, [filteredStudies, currentPage, pageSize]);

  const pageStart =
    filteredStudies.length === 0
      ? 0
      : (currentPage - 1) * pageSize + 1;

  const pageEnd = Math.min(
    currentPage * pageSize,
    filteredStudies.length
  );

  const pageNumbers = useMemo(() => {
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    let startPage = Math.max(
      1,
      currentPage - Math.floor(maxVisiblePages / 2)
    );

    let endPage = startPage + maxVisiblePages - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = totalPages - maxVisiblePages + 1;
    }

    return Array.from(
      { length: endPage - startPage + 1 },
      (_, index) => startPage + index
    );
  }, [currentPage, totalPages]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    let createdStudy;

    try {
      createdStudy = createStudy({
        ...form,
        site: form.site || form.location,
        protocol: form.protocol || form.name,
      });
    } catch (err) {
      // Subscription enforcement (subscriptionGuard.assertCanCreateStudy)
      // throws when the license isn't Active or the study limit is reached.
      setCreateError(err?.message || "Unable to create study.");
      return;
    }

    setCreateError("");

    // No need to pre-create an empty subjectsByStudy bucket.
    // The bucket is created automatically when the first subject is added
    // via studyService.createSubject().

    localStorage.setItem("sidebarStudiesOpen", JSON.stringify(true));
    localStorage.setItem("sidebarStudyBinderOpen", JSON.stringify(true));

    setStudies(loadStudies());
    setForm(initialForm);
    setFormOpen(false);
    setCurrentPage(1);

    navigate(`/study-dashboard/${createdStudy.code}?tab=Subjects`);
  };

  const handleStudyCardClick = (study) => {
    localStorage.setItem("sidebarStudiesOpen", JSON.stringify(true));
    localStorage.setItem("sidebarStudyBinderOpen", JSON.stringify(true));

    navigate(`/study-dashboard/${study.code}?tab=Subjects`);
  };

  const renderPagination = () => {
    if (filteredStudies.length === 0) {
      return null;
    }

    return (
      <div className="studies-pagination">
        <div className="studies-pagination-info">
          Showing {pageStart}-{pageEnd} of {filteredStudies.length} studies
        </div>

        <div className="studies-pagination-controls">
          <label className="studies-page-size">
            Rows
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              aria-label="Rows per page">

              {STUDIES_PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="pagination-btn"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            aria-label="Previous page">

            <FiChevronLeft />
          </button>

          {pageNumbers[0] > 1 && (
            <>
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setCurrentPage(1)}>

                1
              </button>

              {pageNumbers[0] > 2 && (
                <span className="pagination-ellipsis">...</span>
              )}
            </>
          )}

          {pageNumbers.map((page) => (
            <button
              key={page}
              type="button"
              className={`pagination-btn ${
                currentPage === page ? "active" : ""
              }`}
              onClick={() => setCurrentPage(page)}>

              {page}
            </button>
          ))}

          {pageNumbers[pageNumbers.length - 1] < totalPages && (
            <>
              {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                <span className="pagination-ellipsis">...</span>
              )}

              <button
                type="button"
                className="pagination-btn"
                onClick={() => setCurrentPage(totalPages)}>

                {totalPages}
              </button>
            </>
          )}

          <button
            type="button"
            className="pagination-btn"
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
            disabled={currentPage === totalPages}
            aria-label="Next page">

            <FiChevronRight />
          </button>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="studies-page tnxt-compact">
        <div className="studies-page-header page-section-highlight">
          <div>
            <h1>My Studies</h1>
            <p>Study Dashboard</p>
          </div>
          <div className="studies-toolbar">
            <div className="studies-search">
              <FiSearch />

              <input
                type="text"
                placeholder="Search studies..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="studies-filters">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}>

                <option value="">All Status</option>

                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <select
                value={sponsorFilter}
                onChange={(event) => setSponsorFilter(event.target.value)}>

                <option value="">All Sponsors</option>

                {sponsorOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={indicationFilter}
                onChange={(event) => setIndicationFilter(event.target.value)}>

                <option value="">All Indications</option>

                {indicationOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={countryFilter}
                onChange={(event) => setCountryFilter(event.target.value)}>

                <option value="">All Countries</option>

                {countryOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}>

                <option value="studyId">Sort By</option>
                <option value="studyId">Study ID</option>
                <option value="name">Study Name</option>
                <option value="sponsor">Sponsor</option>
                <option value="startDate">Start Date</option>
              </select>
            </div>
          </div>
        </div>

        <div className="studies-summary-kpi page-section-highlight">
          <KPICard
            title="Total Studies"
            value={studies.length}
            icon={<FiFolder />}
            layout="row"
          />

          <div className="studies-summary-actions">
            <div className="studies-view-toggle">
              <button
                type="button"
                className={viewMode === "grid" ? "active" : ""}
                onClick={() => handleViewChange("grid")}>

                <FiGrid />
                <span>Grid</span>
              </button>

              <button
                type="button"
                className={viewMode === "list" ? "active" : ""}
                onClick={() => handleViewChange("list")}>

                <FiList />
                <span>List</span>
              </button>

              <button
                type="button"
                className={viewMode === "table" ? "active" : ""}
                onClick={() => handleViewChange("table")}>

                <FiColumns />
                <span>Table</span>
              </button>
            </div>

            {canCreateStudy && (
              <button
                type="button"
                className="add-study-btn"
                onClick={() => setFormOpen(true)}>

                + Add Study
              </button>
            )}
          </div>
        </div>

        {createError && (
          <div className="studies-create-error">{createError}</div>
        )}

        {filteredStudies.length === 0 && (
          <div className="studies-empty-state">
            No studies found for the selected search and filters.
          </div>
        )}

        {viewMode === "grid" && filteredStudies.length > 0 && (
          <div className="studies-grid">
            {paginatedStudies.map((study) => (
              <div
                key={study.code}
                className="study-card"
                onClick={() => handleStudyCardClick(study)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleStudyCardClick(study);
                  }
                }}>

                <div className="study-card-content">
                  <div
                    className={`study-status ${getStudyStatusClass(
                      study.status || STUDY_STATUS_DEFAULT
                    )}`}>

                    {study.status || STUDY_STATUS_DEFAULT}
                  </div>

                  <h3>{study.name}</h3>

                  <div className="study-code">Study ID : {study.code}</div>

                  <div className="study-info">
                    <div>
                      <strong>PI:</strong>
                      {study.principalInvestigator || "N/A"}
                    </div>

                    <div>
                      <strong>Site:</strong>
                      {resolveSiteDisplay(study, { sources: sites }) || "N/A"}
                    </div>

                    <div>
                      <strong>Subjects:</strong>
                      {      getSubjectsForStudyFromService(study).length}
                      {" / "}
                      {study.targetSubjects || 0}
                    </div>

                    <div>
                      <strong>Start:</strong>
                      {study.startDate || "-"}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="open-study-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleStudyCardClick(study);
                    }}>

                    Open Workspace
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {viewMode === "list" && filteredStudies.length > 0 && (
          <div className="studies-list">
            {paginatedStudies.map((study) => (
              <div
                key={study.code}
                className="study-list-item"
                onClick={() => handleStudyCardClick(study)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleStudyCardClick(study);
                  }
                }}>

                <div className="study-list-name">
                  <h3>{study.name}</h3>
                  <span>{study.code}</span>
                </div>

                <div className="study-list-field">
                  <label>Sponsor</label>
                  <span>{study.sponsor || "-"}</span>
                </div>

                <div className="study-list-field">
                  <label>CRO</label>
                  <span>{study.cro || "-"}</span>
                </div>

                <div className="study-list-field">
                  <label>Indication</label>
                  <span>{study.indication || "-"}</span>
                </div>

                <div className="study-list-field">
                  <label>Country</label>
                  <span>{study.country || "-"}</span>
                </div>

                <div className="study-list-field">
                  <label>PI</label>
                  <span>{study.principalInvestigator || "-"}</span>
                </div>

                <div className="study-list-field">
                  <label>Site</label>
                  <span>{resolveSiteDisplay(study, { sources: sites }) || "-"}</span>
                </div>

                <div className="study-list-field">
                  <label>Subjects</label>
                  <span>
                    {      getSubjectsForStudyFromService(study).length}/{study.targetSubjects || 0}
                  </span>
                </div>

                <div className="study-list-field">
                  <label>Start Date</label>
                  <span>{study.startDate || "-"}</span>
                </div>

                <div className="study-list-status">
                  <span
                    className={`study-status ${getStudyStatusClass(
                      study.status || STUDY_STATUS_DEFAULT
                    )}`}>

                    {study.status || STUDY_STATUS_DEFAULT}
                  </span>

                  <button
                    type="button"
                    className="open-study-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleStudyCardClick(study);
                    }}>

                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {viewMode === "table" && filteredStudies.length > 0 && (
          <div className="studies-table-wrap">
            <table className="studies-table">
              <thead>
                <tr>
                  <th>Study ID</th>
                  <th>Name</th>
                  <th>Sponsor</th>
                  <th>CRO</th>
                  <th>Indication</th>
                  <th>Country</th>
                  <th>PI</th>
                  <th>Site Number</th>
                  <th>Site Name</th>
                  <th>Subjects</th>
                  <th>Study Status</th>
                  <th>Start Date</th>
                  <th>Completed Date</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {paginatedStudies.map((study) => (
                  <tr
                    key={study.code}
                    onClick={() => handleStudyCardClick(study)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleStudyCardClick(study);
                      }
                    }}>

                    <td>{study.code}</td>
                    <td>{study.name}</td>
                    <td>{study.sponsor || "-"}</td>
                    <td>{study.cro || "-"}</td>
                    <td>{study.indication || "-"}</td>
                    <td>{study.country || "-"}</td>
                    <td>{study.principalInvestigator || "-"}</td>
                    <td>{getStudySiteNumber(study, sites) || "-"}</td>
                    <td>{getStudySiteName(study, sites) || "-"}</td>
                    <td>
                      {      getSubjectsForStudyFromService(study).length}/{study.targetSubjects || 0}
                    </td>

                    <td>
                      <span
                        className={`study-status ${getStudyStatusClass(
                          study.status || STUDY_STATUS_DEFAULT
                        )}`}>

                        {study.status || STUDY_STATUS_DEFAULT}
                      </span>
                    </td>

                    <td>{study.startDate || "-"}</td>

                    <td>{getStoredCompletedDateDisplay(study) || "-"}</td>

                    <td>
                      <button
                        type="button"
                        className="open-study-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleStudyCardClick(study);
                        }}>

                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {renderPagination()}

        {formOpen && (
          <StudyModal
            mode="add"
            onClose={() => setFormOpen(false)}
            onSubmit={handleSubmit}>

            <div className="study-form-grid">
              <label>
                Study ID
                <input
                  name="code"
                  value={form.code}
                  onChange={handleChange}
                  required
                  placeholder="Example: ABC-101"
                />
              </label>

              <label>
                Study Name
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="Study name"
                />
              </label>

              <label>
                Protocol
                <input
                  name="protocol"
                  value={form.protocol}
                  onChange={handleChange}
                  placeholder="Protocol title"
                />
              </label>

              <label>
                Indication
                <input
                  name="indication"
                  value={form.indication}
                  onChange={handleChange}
                  required
                  placeholder="Example: Oncology"
                />
              </label>

              <label>
                Site Number
                <input
                  name="siteNumber"
                  value={form.siteNumber}
                  onChange={handleChange}
                  required
                  placeholder="Example: 001"
                />
              </label>

              <label>
                Site / Hospital
                <input
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  required
                  placeholder="Apollo Hospital"
                />
              </label>

              <label>
                Country
                <input
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  required
                  placeholder="India"
                />
              </label>

              <label>
                Subjects Enrolled
                <input
                  name="enrolled"
                  type="number"
                  min="0"
                  value={form.enrolled}
                  onChange={handleChange}
                  required
                  placeholder="0"
                />
              </label>

              <label>
                Target Subjects
                <input
                  name="targetSubjects"
                  type="number"
                  min="0"
                  value={form.targetSubjects}
                  onChange={handleChange}
                  required
                  placeholder="100"
                />
              </label>

              <label>
                Study Status
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  required>

                  {STUDY_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Principal Investigator
                <input
                  name="principalInvestigator"
                  value={form.principalInvestigator}
                  onChange={handleChange}
                  required
                  placeholder="PI name"
                />
              </label>

              <label>
                Sponsor
                <input
                  name="sponsor"
                  value={form.sponsor}
                  onChange={handleChange}
                  required
                  placeholder="Sponsor name"
                />
              </label>

              <label>
                CRO
                <input
                  name="cro"
                  value={form.cro}
                  onChange={handleChange}
                  placeholder="IQVIA"
                />
              </label>

              <label>
                Start Date
                <input
                  name="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Completed Date
                <input
                  name="completedDate"
                  type="date"
                  value={form.completedDate}
                  onChange={handleChange}
                />
              </label>

              <label className="study-form-wide">
                Study Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  required
                  rows={3}
                  placeholder="Brief study description"
                />
              </label>
            </div>
          </StudyModal>
        )}
      </div>
    </DashboardLayout>
  );
}

export default Studies;