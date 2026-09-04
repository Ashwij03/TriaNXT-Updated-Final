import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./shared/context/AuthContext";
import "./Admin/pages/Dashboard.js";
import "./Navbar.css";

function Navbar({ name, setSelectedPage, searchText, setSearchText }: any) {

  const navigate = useNavigate();
  const { logout } = useAuth();

  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const currentUser =
    JSON.parse(
      localStorage.getItem(
        "currentUser"
      )
    );

  const institutions = [
    "Hospital A",
    "Clinic B",
    "City Hospital",
    "Apollo",
    "Global Care"
  ];

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("adminPreviewRole");
    localStorage.removeItem("currentUser");
    logout();
    navigate("/login");
  };

  // ✅ NEW FUNCTION ADDED
  const handleHomeClick = () => {

    if (setSelectedPage) {
      setSelectedPage("home");
    }
  };
  // ✅ NEW FUNCTION ADDED
  const handleDashboardClick = () => {

    if (setSelectedPage) {
      setSelectedPage("dashboard");
    }

    navigate("/dashboard");
  };

  return (
    <div className="navbar">

      {/* LEFT SIDE */}
      <div className="nav-left">

        {/* LOGO */}
        <div
          className="logo"
          onClick={handleHomeClick}>

          TriaNXT
        </div>

        {/* FILTERS */}
        <div className="nav-filters">

          {/* Institution */}
          <div className="search-dropdown">
            <input
              type="text"
              placeholder="Institution"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            />

            {showDropdown && (
              <div className="dropdown-list">
                {institutions
                  .filter((item) =>
                    item.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((item, index) => (
                    <div
                      key={index}
                      className="dropdown-item"
                      onClick={() => {
                        setSearchTerm(item);
                        setShowDropdown(false);
                      }}>

                      {item}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* PI */}
          <select className="nav-dropdown">
            <option>PI</option>
          </select>

          {/* Studies */}
          <select className="nav-dropdown">
            <option>Studies</option>
          </select>

        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="nav-right">

        {/* 🔍 MODERN SEARCH BAR */}
        <div className="search-pill">
          <i className="search-icon"></i>

          <input
            type="text"
            placeholder="Describe your issue"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

          {/* // newly added */}
        {
          currentUser?.role === "Admin" && (
            <>
              <span onClick={() => navigate("/admin-dashboard")}>
                Dashboard
              </span>

              <span onClick={() => navigate("/studies")}>
                Studies
              </span>

              <span onClick={() => navigate("/subjects")}>
                Subjects
              </span>

              <span onClick={() => navigate("/visits")}>
                Visits
              </span>

              <span onClick={() => navigate("/monitoring")}>
                Monitoring
              </span>

              <span onClick={() => navigate("/reports")}>
                Reports
              </span>

              <span onClick={() => navigate("/ereg-documents")}>
                Regulatory Docs
              </span>

              <span onClick={() => navigate("/user-management")}>
                Users
              </span>

              <span onClick={() => navigate("/permission-approval")}>
                Permissions
              </span>

              <span onClick={() => navigate("/amendments")}>
                Amendments
              </span>

              <span onClick={() => navigate("/site-feasibility")}>
                Feasibility
              </span>

              <span onClick={() => navigate("/ip-accountability")}>
                IP Accountability
              </span>

              <span onClick={() => navigate("/irb-submissions")}>
                IRB / IEC
              </span>

              <span onClick={() => navigate("/icf-consent")}>
                ICF / eConsent
              </span>

              <span onClick={() => navigate("/vendor-management")}>
                Vendors
              </span>
            </>
          )
        }

        {
          currentUser?.role ===
            "SiteStaff" && (
            <>
              <span
                onClick={() =>
                  navigate("/site-staff-dashboard")
                }>

                Dashboard
              </span>
              
              <span
                onClick={() =>
                  navigate("/subjects")
                }>

                Subjects
              </span>
              
              <span
                onClick={() =>
                  navigate("/visits")
                }>

                Visits
              </span>
              
              <span
                onClick={() =>
                  navigate("/screening")
                }>

                Screening
              </span>
              
              <span
                onClick={() =>
                  navigate("/enrollment")
                }>

                Enrollment
              </span>
              
              <span
                onClick={() =>
                  navigate("/comments")
                }>

                Comments
              </span>
              
              <span
                onClick={() =>
                  navigate("/site-activities")
                }>

                Site Activities
              </span>
              
              <span
                onClick={() =>
                  navigate("/access-request")
                }>

                Access Request
              </span>
            </>
          )
        }

        {
          currentUser?.role ===
            "PI" && (
            <>
              <span
                onClick={() =>
                  navigate(
                    "/pi-dashboard"
                  )
                }>

                PI Dashboard
              </span>
            </>
          )
        }

        {/* newly added till here */}

        {/* ✅ UPDATED */}
        <span onClick={handleHomeClick}>Home</span>

        {/* ✅ UPDATED */}
        <span onClick={handleDashboardClick}>eSource</span>
        <span onClick={() => setSelectedPage("progress-notes")}>
  Progress Notes
</span>

<span
  onClick={() => {
    if (setSelectedPage) {
      setSelectedPage("comments");
    }
  }}>

  Comments
</span>

<span onClick={() => setSelectedPage("files")}>
  Files
</span>

        {/* Global Logs nav entry removed — Training/Delegation logs live
        inside each study's Logs tab now. */}

        <span onClick={() => navigate("/about")}>About</span>

        <span>Live Chat Now</span>

        <div className="user-menu">

          <span
            className="welcome"
            onClick={() => setOpen(!open)}>

            Welcome {name || "User"} ▾
          </span>

          {open && (
            <div className="dropdown">

              <div onClick={() => navigate("/profile")}>
                Account Profile
              </div>

              <div>
                Account Security
              </div>

              <div onClick={handleLogout}>
                Logout
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default Navbar;