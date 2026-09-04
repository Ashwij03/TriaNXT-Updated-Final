import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./DashboardHeader.css";

import TriaNXTLogo from "../../TriaNXTLogo";
import SearchableDropdown from "../../SearchableDropdown";
import RoleSwitcherDropdown from "../../RoleSwitcherDropdown";
import NavbarNotificationsDropdown from "../../NavbarNotificationsDropdown";
import {
  FiHome,
  FiMessageSquare,
  FiChevronDown,
  FiMenu,
  FiSliders,
  FiSettings,
} from "react-icons/fi";
import { useAdminNavbarNotifications } from "../../../hooks/useAdminNavbarNotifications";
import {
  FILTER_ORDERS,
  FILTER_LABELS,
  ROLE_BADGE_CLASSES,
} from "./enterpriseHeaderConfig";
import { getStudyByCode } from "../../../services/studyService";
import ROLES from "../../../constants/roles";
import {
  formatUserDisplayName,
  getCurrentUser,
  getDashboardPath,
  getEffectiveRole,
  isAdmin,
  ROLE_LABELS,
  setAdminPreviewRole,
} from "../../../services/roleService";
import { PROFILE_PHOTO_EVENT } from "../../../constants/profileEvents";
import {
  terminateCurrentSession,
  touchUserSession,
} from "../../../services/sessionService";
import {
  ADMIN_PREVIEW_ROLE_EVENT,
  clearDependentFilters,
  getDependentFilterKeys,
  HEADER_FILTERS_EVENT,
  SELECTED_CRO_KEY,
  SELECTED_INDICATION_KEY,
  SELECTED_INSTITUTION_KEY,
  SELECTED_SITE_NUMBER_KEY,
  SELECTED_SPONSOR_KEY,
  SELECTED_STUDY_FILTER_KEY,
  SELECTED_SUBJECT_KEY,
  getStoredCROFilter,
  getStoredIndicationFilter,
  getStoredInstitutionFilter,
  getStoredSiteNumberFilter,
  getStoredSponsorFilter,
  getStoredStudyFilter,
  getStoredSubjectFilter,
  setStoredCROFilter,
  setStoredIndicationFilter,
  setStoredInstitutionFilter,
  setStoredSiteNumberFilter,
  setStoredSponsorFilter,
  setStoredStudyFilter,
  setStoredSubjectFilter,
} from "../../../constants/headerFilters";
import {
  getCROOptions,
  getDefaultInstitution,
  getIndicationOptions,
  getInstitutionForSiteNumber,
  getInstitutionOptions,
  getRecruitedCROOptions,
  getSiteNumberForInstitution,
  getSiteNumberOptions,
  getSponsorOptions,
  getStudyOptions,
  getSubjectOptions,
} from "../../../services/filterService";
import useLiveChatNavigation from "../../../hooks/useLiveChatNavigation";

import { useAuth } from "../../../context/AuthContext";

// Task 8 (Dashboard Data Reset Bug) + Task 15 (Dashboard Must Show All
// Sites): every per-role Dashboard route. Used to detect "the Dashboard
// just opened" so leftover Study-page and Site-scoping filter context can
// be cleared (see the reset effect below).
const DASHBOARD_ROUTE_PATHS = [
  "/admin-dashboard",
  "/site-staff-dashboard",
  "/pi-dashboard",
  "/cro-dashboard",
  "/sponsor-dashboard",
];

function EnterpriseNavbarBase({
  onToggleSidebar,
  sidebarOpen,
  layoutRole,
  liveChatPath,
  navbarClassName = "",
  setSelectedPage,
}: any) {
  const navigate = useNavigate();
  const location = useLocation();
  const profileSectionRef = useRef(null);
  const filtersWrapRef = useRef(null);
  const { logout } = useAuth();

  const currentUser = getCurrentUser();
  const userEmail = currentUser?.email || "";
  const { openLiveChat } = useLiveChatNavigation(liveChatPath);

  const userIsAdmin = isAdmin(currentUser);
  const effectiveRole =
    getEffectiveRole(currentUser) || layoutRole || ROLES.ADMIN;

  const [profileOpen, setProfileOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterVersion, setFilterVersion] = useState(0);

  const { notifications, unreadCount, handleToggleRead, handleMarkAllRead } =
    useAdminNavbarNotifications();

  const [previewRole, setPreviewRoleState] = useState(
    () => effectiveRole || ROLES.ADMIN,
  );

  const [profilePhoto, setProfilePhoto] = useState(
    currentUser?.profilePhoto || "",
  );

  const [selectedIndication, setSelectedIndication] = useState(
    getStoredIndicationFilter,
  );

  const [selectedSponsor, setSelectedSponsor] = useState(
    getStoredSponsorFilter,
  );

  const [selectedCRO, setSelectedCRO] = useState(getStoredCROFilter);

  const [selectedInstitution, setSelectedInstitution] = useState(
    () => getStoredInstitutionFilter() || getDefaultInstitution(currentUser),
  );

  const [selectedSiteNumber, setSelectedSiteNumber] = useState(
    getStoredSiteNumberFilter,
  );

  const [selectedStudyCode, setSelectedStudyCode] =
    useState(getStoredStudyFilter);

  const [selectedSubject, setSelectedSubject] = useState(
    getStoredSubjectFilter,
  );

  const indicationOptions = useMemo(() => {
    void filterVersion;
    return getIndicationOptions(currentUser);
  }, [filterVersion, currentUser]);

  const sponsorOptions = useMemo(() => {
    void filterVersion;
    return getSponsorOptions(currentUser);
  }, [filterVersion, currentUser]);

  const croOptions = useMemo(() => {
    void filterVersion;

    if (effectiveRole === ROLES.SPONSOR) {
      return getRecruitedCROOptions(currentUser);
    }

    return getCROOptions(currentUser);
  }, [effectiveRole, filterVersion, currentUser]);

  const institutionOptions = useMemo(() => {
    void filterVersion;
    return getInstitutionOptions(currentUser);
  }, [filterVersion, currentUser]);

  const siteNumberOptions = useMemo(() => {
    void filterVersion;
    return getSiteNumberOptions(currentUser);
  }, [filterVersion, currentUser]);

  const studyOptions = useMemo(() => {
    void filterVersion;
    return getStudyOptions(currentUser);
  }, [filterVersion, currentUser]);

  const subjectOptions = useMemo(() => {
    void filterVersion;
    return getSubjectOptions(currentUser);
  }, [filterVersion, currentUser]);

  const filterOrder = useMemo(() => {
    let base;

    if (userIsAdmin) {
      if (effectiveRole === ROLES.ADMIN) {
        base = FILTER_ORDERS[ROLES.ADMIN];
      } else {
        const previewFilters = FILTER_ORDERS[effectiveRole] || [];
        base = ["role", ...previewFilters.filter((key) => key !== "role")];
      }
    } else {
      base = FILTER_ORDERS[effectiveRole] || FILTER_ORDERS[ROLES.ADMIN];
    }

    if (effectiveRole === ROLES.SPONSOR && croOptions.length === 0) {
      return base.filter((key) => key !== "cro");
    }

    return base;
  }, [userIsAdmin, effectiveRole, croOptions.length]);

  // ---------------------------------------------------------------------
  // A9 — Study Context Header
  //
  // The header's own Study dropdown (selectedStudyCode/SELECTED_STUDY_FILTER_KEY)
  // is only one way a Study gets selected. Sidebar links, Quick Actions, and
  // deep links all navigate straight to /study-dashboard/:code without ever
  // touching that dropdown. Without this, the header could show one Study
  // while the page underneath was showing another. Reading the code out of
  // the route keeps every module — Admin, PI, CRO, Sponsor, Site Staff —
  // showing the same Study context, since they all render this same header.
  // ---------------------------------------------------------------------

  const routeStudyCode = useMemo(() => {
    const match = location.pathname.match(/^\/study-dashboard\/([^/?]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }, [location.pathname]);

  useEffect(() => {
    if (!routeStudyCode) {
      return;
    }

    if (routeStudyCode !== selectedStudyCode) {
      setSelectedStudyCode(routeStudyCode);
      setStoredStudyFilter(routeStudyCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeStudyCode]);

  // Task 8 (Dashboard Data Reset Bug): opening a Study Details page (the
  // effect above) sets a persistent "selectedStudyFilter" that every
  // per-role Dashboard reads to scope its data. Nothing was clearing that
  // filter again on the way back out, so a Dashboard opened right after
  // viewing "Study A" stayed silently narrowed to Study A's single site
  // instead of showing all studies/sites. A Dashboard route must always
  // start fresh, so clear the leftover Study (and dependent Subject)
  // context every time one of the Dashboard routes is opened.
  //
  // Task 15 (Dashboard Must Show All Sites): the same leak applied to the
  // Institution / Site Number filters — picking a Site Name/Number on the
  // Studies page (or via the header itself) left that value stored, and
  // every per-role Dashboard reads it to scope its "Sites"/data widgets
  // (see getAdminDashboardData). Opening a Dashboard route must always
  // show every site the user has access to, not whatever single site was
  // last selected elsewhere, so clear Institution and Site Number here too.
  //
  // Task 18 (Dashboard Opens Filter-Free): every remaining header filter —
  // Indication, Sponsor, and CRO — is cleared here as well. The Dashboard
  // is meant to open showing the complete, unfiltered picture every time;
  // any narrowing (by indication, a specific site, a specific study, etc.)
  // should be something the user opts back into deliberately from the
  // header, not something left over from wherever they were before.
  useEffect(() => {
    if (!DASHBOARD_ROUTE_PATHS.includes(location.pathname)) {
      return;
    }

    if (getStoredStudyFilter()) {
      setSelectedStudyCode("");
      setStoredStudyFilter("");
    }

    if (getStoredSubjectFilter()) {
      setSelectedSubject("");
      setStoredSubjectFilter("");
    }

    if (getStoredInstitutionFilter()) {
      setSelectedInstitution("");
      setStoredInstitutionFilter("");
    }

    if (getStoredSiteNumberFilter()) {
      setSelectedSiteNumber("");
      setStoredSiteNumberFilter("");
    }

    if (getStoredIndicationFilter()) {
      setSelectedIndication("");
      setStoredIndicationFilter("");
    }

    if (getStoredSponsorFilter()) {
      setSelectedSponsor("");
      setStoredSponsorFilter("");
    }

    if (getStoredCROFilter()) {
      setSelectedCRO("");
      setStoredCROFilter("");
    }

    setFilterVersion((current) => current + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Resolve the full Study record for whatever code the header currently
  // holds (from its dropdown, the route, or a refreshed page). filterVersion
  // is included so an edit made elsewhere (rename, status change) or a
  // "studies-updated" event refreshes what's displayed here.
  const selectedStudyDetails = useMemo(() => {
    void filterVersion;

    if (!selectedStudyCode) {
      return null;
    }

    return getStudyByCode(selectedStudyCode) || null;
  }, [selectedStudyCode, filterVersion]);

  // Handle invalid Study context: a stored/route code that no longer
  // resolves to a real Study (deleted elsewhere, corrupted storage, a
  // stale link, or a code that isn't visible under the current role/preview
  // role) must not be left displayed as if it were still valid. Clear it so
  // the header falls back to its empty state instead of showing stale or
  // incorrect details.
  useEffect(() => {
    if (!selectedStudyCode || selectedStudyDetails) {
      return;
    }

    setSelectedStudyCode("");
    setStoredStudyFilter("");
    setSelectedSubject("");
    setStoredSubjectFilter("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudyCode, selectedStudyDetails]);

  useEffect(() => {
    touchUserSession(getCurrentUser());
  }, [userEmail]);

  useEffect(() => {
    const refreshProfilePhoto = () => {
      const current = getCurrentUser();
      setProfilePhoto(current?.profilePhoto || "");
    };

    window.addEventListener(PROFILE_PHOTO_EVENT, refreshProfilePhoto);

    return () => {
      window.removeEventListener(PROFILE_PHOTO_EVENT, refreshProfilePhoto);
    };
  }, []);

  useEffect(() => {
    const bumpFilters = () => setFilterVersion((value) => value + 1);

    // "studies-updated" (dispatched by studyService on create/update/delete)
    // is included here so the Study Context Header picks up name/status
    // edits, or a deletion, immediately — without this the header could
    // keep showing stale study details until something else forced a
    // re-render.
    window.addEventListener(HEADER_FILTERS_EVENT, bumpFilters);
    window.addEventListener(ADMIN_PREVIEW_ROLE_EVENT, bumpFilters);
    window.addEventListener("studies-updated", bumpFilters);

    return () => {
      window.removeEventListener(HEADER_FILTERS_EVENT, bumpFilters);
      window.removeEventListener(ADMIN_PREVIEW_ROLE_EVENT, bumpFilters);
      window.removeEventListener("studies-updated", bumpFilters);
    };
  }, []);

  useEffect(() => {
    const handlePreviewRoleChange = () => {
      setPreviewRoleState(getEffectiveRole(getCurrentUser()) || ROLES.ADMIN);
    };

    window.addEventListener(ADMIN_PREVIEW_ROLE_EVENT, handlePreviewRoleChange);

    return () => {
      window.removeEventListener(
        ADMIN_PREVIEW_ROLE_EVENT,
        handlePreviewRoleChange,
      );
    };
  }, [userEmail]);

  useEffect(() => {
    const handleOutsideProfileClick = (event) => {
      if (
        profileOpen &&
        profileSectionRef.current &&
        !profileSectionRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideProfileClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideProfileClick);
    };
  }, [profileOpen]);

  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setFiltersOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, []);

  // The Filters dropdown (toggle button + panel) now behaves consistently
  // at every viewport size and browser zoom level: it always opens as a
  // floating panel anchored under the toggle button, and closes on an
  // outside click so it never gets stuck open and overlapping the page.
  useEffect(() => {
    const handleOutsideFiltersClick = (event) => {
      if (
        filtersOpen &&
        filtersWrapRef.current &&
        !filtersWrapRef.current.contains(event.target)
      ) {
        setFiltersOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideFiltersClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideFiltersClick);
    };
  }, [filtersOpen]);

  const handleLogout = () => {
    terminateCurrentSession();

    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("adminPreviewRole");
    localStorage.removeItem("currentUser");

    // Sync AuthContext state so useAuth() resolves to null immediately.
    logout();

    setAdminPreviewRole(null);

    setProfileOpen(false);
    navigate("/login");
  };

  const handleHomeNavigation = () => {
    setProfileOpen(false);
    setFiltersOpen(false);

    const currentRole =
      getEffectiveRole(getCurrentUser()) || layoutRole || ROLES.ADMIN;

    const dashboardPath = getDashboardPath(currentRole);

    if (typeof setSelectedPage === "function") {
      setSelectedPage("dashboard");
    }

    navigate(dashboardPath);
  };

  const navigateToSettingsSection = (section) => {
    const role = getEffectiveRole(getCurrentUser());

    let path = "/settings";

    if (role === ROLES.CRO) {
      path = "/cro-settings";
    }

    if (role === ROLES.PI) {
      path = "/pi-settings";
    }

    setProfileOpen(false);

    navigate(path, {
      state: { section },
    });
  };

  const openStudy = (study) => {
    if (!study) {
      return;
    }

    navigate(`/study-dashboard/${study.code}?tab=Subjects`);
  };

  const handleStudyChange = (code) => {
    setSelectedStudyCode(code);
    setStoredStudyFilter(code);
    clearDependentFilters(SELECTED_STUDY_FILTER_KEY);
    setSelectedSubject("");
    openStudy(getStudyByCode(code));
  };

  const handleSubjectChange = (subjectId) => {
    setSelectedSubject(subjectId);

    if (!subjectId) {
      setStoredSubjectFilter("");
      return;
    }

    // Subject options carry a "studyKey" (the study code they belong to) —
    // see getSubjectOptions in filterService.js. Fall back to whatever study
    // is currently selected in the header if a match isn't found.
    const matchedOption = subjectOptions.find(
      (option) => String(option.value) === String(subjectId),
    );

    const studyCode = matchedOption?.studyKey || selectedStudyCode;

    if (!studyCode) {
      // No study context to navigate into — just remember the raw id.
      setStoredSubjectFilter(subjectId);
      return;
    }

    // Store the same { id, studyId } shape that StudySubjects.js,
    // DashboardSidebar.js and the PI/CRO subject pages already read from
    // the "selectedSubject" key so the destination page opens directly
    // on this subject.
    localStorage.setItem(
      SELECTED_SUBJECT_KEY,
      JSON.stringify({ id: subjectId, studyId: studyCode }),
    );

    navigate(
      `/study-dashboard/${encodeURIComponent(
        studyCode,
      )}?tab=Subjects&subject=${encodeURIComponent(subjectId)}`,
    );
  };

  // Task: Filter Cascade Consistency — maps each cascade-clearable storage
  // key to the React state setter that drives its dropdown, so clearing a
  // parent filter (e.g. Indication) can also reset every dependent
  // dropdown's *displayed* value, not just what's in storage.
  const dependentFilterSetters = {
    [SELECTED_SPONSOR_KEY]: setSelectedSponsor,
    [SELECTED_CRO_KEY]: setSelectedCRO,
    [SELECTED_INSTITUTION_KEY]: setSelectedInstitution,
    [SELECTED_SITE_NUMBER_KEY]: setSelectedSiteNumber,
    [SELECTED_STUDY_FILTER_KEY]: setSelectedStudyCode,
    [SELECTED_SUBJECT_KEY]: setSelectedSubject,
  };

  const updateFilter = (key, value, setter) => {
    setter(value);

    const storageMap = {
      indication: [SELECTED_INDICATION_KEY, setStoredIndicationFilter],
      sponsor: [SELECTED_SPONSOR_KEY, setStoredSponsorFilter],
      cro: [SELECTED_CRO_KEY, setStoredCROFilter],
      siteName: [SELECTED_INSTITUTION_KEY, setStoredInstitutionFilter],
      siteNumber: [SELECTED_SITE_NUMBER_KEY, setStoredSiteNumberFilter],
    };

    const entry = storageMap[key];

    if (entry) {
      // Clear every dependent filter — in storage AND in this header's own
      // dropdown state — *before* writing/dispatching the changed filter
      // itself. Dispatching first (the old order) meant any page listening
      // for HEADER_FILTERS_EVENT (e.g. the Admin Dashboard) would read the
      // still-stale downstream values, since the cascade clear happened a
      // moment later with no event of its own to announce it.
      const dependentKeys = getDependentFilterKeys(entry[0]);
      clearDependentFilters(entry[0]);
      dependentKeys.forEach((dependentKey) => {
        dependentFilterSetters[dependentKey]?.("");
      });

      entry[1](value);
      setFilterVersion((current) => current + 1);
    }

    // Note: the generic cascade reset above already clears
    // selectedSponsor/selectedCRO/selectedInstitution/selectedSiteNumber/
    // selectedStudyCode/selectedSubject (in storage and in this header's own
    // dropdown state) for whichever of those are downstream of the filter
    // that just changed — including Indication resetting *everything*
    // beneath it. The two blocks below only need to run afterward for
    // "siteName"/"siteNumber" because they re-populate a *matched* value
    // (not just clear it) to keep Site Name and Site Number mutually in
    // sync.
    if (key === "siteName") {
      // Reflect the matching Site Number for the institution just picked
      // (or leave it cleared if Site Name was reset to "All Institutions").
      const matchedSiteNumber = value
        ? getSiteNumberForInstitution(value, currentUser)
        : "";

      if (matchedSiteNumber) {
        setSelectedSiteNumber(matchedSiteNumber);
        setStoredSiteNumberFilter(matchedSiteNumber);
      }
    }

    if (key === "siteNumber") {
      // Reflect the matching Site Name for the number just picked (or
      // leave it cleared if Site Number was reset to "All Site Numbers"),
      // mirroring what the "siteName" branch above does in reverse so both
      // filters always stay in sync.
      const matchedInstitution = value
        ? getInstitutionForSiteNumber(value, currentUser)
        : "";

      if (matchedInstitution) {
        setSelectedInstitution(matchedInstitution);
        setStoredInstitutionFilter(matchedInstitution);
      }
    }

    // Task: Header Indication Link — picking an Indication from the header
    // is now a navigation shortcut into the Studies page, which reads the
    // same stored Indication filter (see Studies.js) and narrows its list
    // down to studies matching it. Clearing back to "All Indications"
    // stays wherever the user currently is instead of forcing a redirect.
    if (key === "indication" && value) {
      navigate("/studies");
    }
  };

  const renderFilterControl = (filterKey) => {
    switch (filterKey) {
      case "role":
        return (
          <div className="header-role-control">
            <RoleSwitcherDropdown />

            {userIsAdmin && previewRole !== ROLES.ADMIN && (
              <span className="header-preview-indicator">
                Viewing: {ROLE_LABELS[previewRole] || previewRole}
              </span>
            )}
          </div>
        );

      case "indication":
        return (
          <SearchableDropdown
            value={selectedIndication}
            onChange={(value) =>
              updateFilter("indication", value, setSelectedIndication)
            }
            options={[
              { value: "", label: "All Indications" },
              ...indicationOptions,
            ]}
            placeholder="All Indications"
            searchPlaceholder="Search Indication"
            className="header-dropdown"
          />
        );

      case "sponsor":
        return (
          <SearchableDropdown
            value={selectedSponsor}
            onChange={(value) =>
              updateFilter("sponsor", value, setSelectedSponsor)
            }
            options={[{ value: "", label: "All Sponsors" }, ...sponsorOptions]}
            placeholder="All Sponsors"
            searchPlaceholder="Search Sponsor"
            className="header-dropdown"
          />
        );

      case "cro":
        if (effectiveRole === ROLES.SPONSOR && croOptions.length === 0) {
          return (
            <span className="header-static-value header-static-value--muted">
              No CROs recruited
            </span>
          );
        }

        return (
          <SearchableDropdown
            value={selectedCRO}
            onChange={(value) => updateFilter("cro", value, setSelectedCRO)}
            options={[{ value: "", label: "All CROs" }, ...croOptions]}
            placeholder="All CROs"
            searchPlaceholder="Search CRO"
            className="header-dropdown"
          />
        );

      case "study":
        return (
          <SearchableDropdown
            value={selectedStudyCode}
            onChange={handleStudyChange}
            options={studyOptions}
            placeholder={
              // Task: Study Filter Site-Only Gating — the Study dropdown's
              // options (see getStudyOptions in filterService.js) only
              // populate once a Site Number or Site Name is selected, so
              // the placeholder should say so until one is.
              selectedInstitution || selectedSiteNumber
                ? "Select Study"
                : "Select Study"
            }
            searchPlaceholder="Search Study Number"
            className="header-dropdown"
          />
        );

      case "siteName":
        return (
          <SearchableDropdown
            value={selectedInstitution}
            onChange={(value) =>
              updateFilter("siteName", value, setSelectedInstitution)
            }
            options={institutionOptions}
            placeholder="All Institutions"
            searchPlaceholder="Search Institution"
            className="header-dropdown"
          />
        );

      case "siteNumber":
        return (
          <SearchableDropdown
            value={selectedSiteNumber}
            onChange={(value) =>
              updateFilter("siteNumber", value, setSelectedSiteNumber)
            }
            options={siteNumberOptions}
            placeholder="All Site Numbers"
            searchPlaceholder="Search Site Number"
            className="header-dropdown"
          />
        );

      case "subject":
        return (
          <SearchableDropdown
            value={selectedSubject}
            onChange={handleSubjectChange}
            options={subjectOptions}
            placeholder={
              // Task: Subject Filter Site+Study Gating — the Subject
              // dropdown's options (see getSubjectOptions in
              // filterService.js) only populate once both a Site
              // Number/Site Name and a specific Study are selected.
              (selectedInstitution || selectedSiteNumber) && selectedStudyCode
                ? "Select Subject"
                : "Select Subject"
            }
            searchPlaceholder="Search Subject"
            className="header-dropdown"
          />
        );

      default:
        return null;
    }
  };

  // Task: Filters follow screen size, not just a manual toggle — at 100%
  // browser zoom (or zoomed further out, i.e. a wide effective viewport)
  // every filter control sits directly in the header row. Only once the
  // effective viewport narrows past the breakpoint below (zoomed in
  // beyond 100%, or a genuinely narrow window) does the row collapse
  // into the "Filters" toggle button + dropdown panel. Both markups are
  // built from this single list so they never drift out of sync; CSS
  // (see .header-filters-inline / .header-filters-wrap) decides which
  // one is actually shown.
  const filterColumns = filterOrder.map((filterKey) => (
    <div className="header-filter-column" key={filterKey}>
      <div className="header-filter-heading">
        {FILTER_LABELS[filterKey] || filterKey}
      </div>

      <div className="header-filter-control">
        {renderFilterControl(filterKey)}
      </div>
    </div>
  ));

  const badgeRole = userIsAdmin ? ROLES.ADMIN : currentUser?.role;
  const badgeLabel = ROLE_LABELS[badgeRole] || badgeRole || "User";
  const badgeClass = ROLE_BADGE_CLASSES[badgeRole] || "role-badge--default";

  const profileRoleLabel = userIsAdmin
    ? ROLE_LABELS[ROLES.ADMIN]
    : ROLE_LABELS[currentUser?.role] || currentUser?.role || "User";
  const currentUserDisplayName = formatUserDisplayName(currentUser);

  return (
    <div className={`enterprise-header ${navbarClassName}`.trim()}>
      <div className="header-unified-row">
        <button
          type="button"
          className="header-menu-toggle"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          aria-expanded={sidebarOpen}>

          <FiMenu />
        </button>

        {/* Only shown once the sidebar is collapsed/closed via the hamburger,
            so the brand stays visible even though the sidebar's own logo is
            hidden while collapsed. Clicking it goes to the current role's
            dashboard, same destination as the sidebar logo normally uses. */}
        {!sidebarOpen && (
          <TriaNXTLogo
            size="navbar"
            className="header-collapsed-logo"
            onClick={handleHomeNavigation}
          />
        )}

        <div className="header-identity-inline">
          <span className="header-welcome-text">Welcome</span>
          <span className={`role-badge ${badgeClass}`}>{badgeLabel}</span>
          <span className="header-username-inline">
            {currentUserDisplayName || "User"}
          </span>
        </div>

        <div className="header-filters-inline">{filterColumns}</div>

        <div className="header-filters-wrap" ref={filtersWrapRef}>
          <button
            type="button"
            className={`header-filter-toggle${filtersOpen ? " is-open" : ""}`}
            onClick={() => setFiltersOpen((previousValue) => !previousValue)}
            aria-label="Toggle filters"
            aria-expanded={filtersOpen}>

            <FiSliders />
            <span>Filters</span>
            <FiChevronDown className="header-filter-toggle-chevron" />
          </button>

          <div
            className={`header-filters-grid${filtersOpen ? " is-open" : ""}`}>

            <div className="header-filters-grid-heading">
              <span>Filters</span>
              <button
                type="button"
                className="header-filters-grid-close"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters">

                &times;
              </button>
            </div>

            <div className="header-filters-grid-body">{filterColumns}</div>
          </div>
        </div>

        <div className="header-right">
          <div className="header-menu">
            <button
              type="button"
              className="header-action-btn header-action-btn--outline"
              onClick={handleHomeNavigation}>

              <FiHome />
              <span>Home</span>
            </button>

            <button
              type="button"
              className="header-action-btn header-action-btn--outline"
              onClick={openLiveChat}>

              <FiMessageSquare />
              <span>Live Chat</span>
            </button>

            <NavbarNotificationsDropdown
              notifications={notifications}
              unreadCount={unreadCount}
              onToggleRead={handleToggleRead}
              onMarkAllRead={handleMarkAllRead}
              onViewAll={() => navigate("/notifications")}
              buttonClassName="header-icon-btn"
            />

            <button
              type="button"
              className="header-icon-btn"
              aria-label="Settings"
              onClick={() => navigateToSettingsSection("profile")}>

              <FiSettings />
            </button>
          </div>

          <div
            ref={profileSectionRef}
            className="profile-section"
            onClick={() => setProfileOpen((previousValue) => !previousValue)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setProfileOpen((previousValue) => !previousValue);
              }
            }}>

            <div className="profile-avatar">
              {profilePhoto ? (
                <img src={profilePhoto} alt="" className="profile-avatar-img" />
              ) : (
                currentUser?.name?.charAt(0)?.toUpperCase()
              )}
            </div>

            <div>
              <div className="profile-name">
                {currentUserDisplayName || "User"}
              </div>
              <div className="profile-role">{profileRoleLabel}</div>
            </div>

            <FiChevronDown />

            {profileOpen && (
              <div
                className="profile-dropdown"
                onClick={(event) => event.stopPropagation()}>

                <button
                  type="button"
                  onClick={() => navigateToSettingsSection("profile")}>

                  Profile
                </button>

                <button
                  type="button"
                  onClick={() => navigateToSettingsSection("account")}>

                  Account Settings
                </button>

                <button
                  type="button"
                  onClick={() => navigateToSettingsSection("security")}>

                  Security
                </button>

                <button type="button" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnterpriseNavbarBase;

