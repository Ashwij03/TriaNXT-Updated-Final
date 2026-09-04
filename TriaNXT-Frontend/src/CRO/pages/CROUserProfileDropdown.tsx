import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaChevronDown,
  FaUser,
  FaCog,
  FaShieldAlt,
  FaBell,
  FaQuestionCircle,
  FaSignOutAlt,
} from "react-icons/fa";
import CROModal from "./CROModal";
import { getCROUserProfile } from "./croUser";
import "../styles/CROUserProfileDropdown.css";

const MENU_ITEMS = [
  { id: "profile", label: "My Profile", icon: FaUser, path: "/profile" },
  {
    id: "account",
    label: "Account Settings",
    icon: FaCog,
    path: "/cro-settings?section=account",
  },
  {
    id: "security",
    label: "Security Settings",
    icon: FaShieldAlt,
    path: "/cro-settings?section=security",
  },
  {
    id: "notifications",
    label: "Notifications Preferences",
    icon: FaBell,
    path: "/cro-settings?section=notifications",
  },
  {
    id: "help",
    label: "Help & Support",
    icon: FaQuestionCircle,
    action: "help",
  },
  {
    id: "logout",
    label: "Logout",
    icon: FaSignOutAlt,
    action: "logout",
    danger: true,
  },
];

function CROUserProfileDropdown() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const profile = getCROUserProfile();

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
    triggerRef.current?.focus();
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("userFullName");
    closeDropdown();
    navigate("/login", { replace: true });
  }, [closeDropdown, navigate]);

  const handleMenuAction = useCallback(
    (item) => {
      if (item.action === "logout") {
        handleLogout();
        return;
      }

      if (item.action === "help") {
        closeDropdown();
        setHelpOpen(true);
        return;
      }

      if (item.path) {
        closeDropdown();
        navigate(item.path);
      }
    },
    [closeDropdown, handleLogout, navigate]
  );

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        closeDropdown();
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeDropdown, open]);

  useEffect(() => {
    if (open && menuRef.current) {
      const firstItem = menuRef.current.querySelector('[role="menuitem"]');
      firstItem?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open || focusedIndex < 0 || !menuRef.current) return;
    const items = menuRef.current.querySelectorAll('[role="menuitem"]');
    items[focusedIndex]?.focus();
  }, [focusedIndex, open]);

  const handleTriggerKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((prev) => !prev);
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setFocusedIndex(0);
    }
  };

  const handleMenuKeyDown = (event) => {
    const itemCount = MENU_ITEMS.length;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % itemCount);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + itemCount) % itemCount);
    }

    if (event.key === "Home") {
      event.preventDefault();
      setFocusedIndex(0);
    }

    if (event.key === "End") {
      event.preventDefault();
      setFocusedIndex(itemCount - 1);
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const index = focusedIndex >= 0 ? focusedIndex : 0;
      handleMenuAction(MENU_ITEMS[index]);
    }
  };

  return (
    <>
      <div
        className={`cro-user-dropdown${open ? " cro-user-dropdown--open" : ""}`}
        ref={containerRef}
      >
        <button
          type="button"
          ref={triggerRef}
          className="cro-user-dropdown-trigger"
          onClick={() => setOpen((prev) => !prev)}
          onKeyDown={handleTriggerKeyDown}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="User profile menu"
        >
          {profile.profileImage ? (
            <img
              src={profile.profileImage}
              alt=""
              className="cro-user-dropdown-avatar cro-user-dropdown-avatar--image"
            />
          ) : (
            <div className="cro-user-dropdown-avatar">{profile.initials}</div>
          )}

          <div className="cro-user-dropdown-summary">
            <div className="cro-user-dropdown-name">{profile.name}</div>
            <div className="cro-user-dropdown-org">{profile.organization}</div>
          </div>

          <FaChevronDown
            className={`cro-user-dropdown-chevron${open ? " cro-user-dropdown-chevron--open" : ""}`}
            aria-hidden="true"
          />
        </button>

        {open && (
          <>
            <div
              className="cro-user-dropdown-backdrop"
              onClick={closeDropdown}
              role="presentation"
              aria-hidden="true"
            />
            <div
            ref={menuRef}
            className="cro-user-dropdown-panel"
            role="menu"
            aria-label="User account menu"
            onKeyDown={handleMenuKeyDown}
          >
            <div className="cro-user-dropdown-profile">
              {profile.profileImage ? (
                <img
                  src={profile.profileImage}
                  alt=""
                  className="cro-user-dropdown-profile-avatar cro-user-dropdown-avatar--image"
                />
              ) : (
                <div className="cro-user-dropdown-profile-avatar">
                  {profile.initials}
                </div>
              )}

              <div className="cro-user-dropdown-profile-info">
                <div className="cro-user-dropdown-profile-name">
                  {profile.name}
                </div>
                <div className="cro-user-dropdown-profile-role">
                  {profile.role}
                </div>
                <div className="cro-user-dropdown-status">
                  🟢 Online
                </div>
              </div>
            </div>

            <div className="cro-user-dropdown-meta">
              <div className="cro-user-dropdown-meta-row">
                <span className="cro-user-dropdown-meta-label">Name</span>
                <span className="cro-user-dropdown-meta-value">
                  {profile.name}
                </span>
              </div>
              <div className="cro-user-dropdown-meta-row">
                <span className="cro-user-dropdown-meta-label">Role</span>
                <span className="cro-user-dropdown-meta-value">
                  {profile.role}
                </span>
              </div>
              <div className="cro-user-dropdown-meta-row">
                <span className="cro-user-dropdown-meta-label">Organization</span>
                <span className="cro-user-dropdown-meta-value">
                  {profile.organization}
                </span>
              </div>
              <div className="cro-user-dropdown-meta-row">
                <span className="cro-user-dropdown-meta-label">Email</span>
                <span className="cro-user-dropdown-meta-value">
                  {profile.email}
                </span>
              </div>
              <div className="cro-user-dropdown-meta-row">
                <span className="cro-user-dropdown-meta-label">Last Login</span>
                <span className="cro-user-dropdown-meta-value">
                  {profile.lastLogin}
                </span>
              </div>
            </div>

            <div className="cro-user-dropdown-divider" role="separator" />

            <div className="cro-user-dropdown-actions">
              {MENU_ITEMS.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className={`cro-user-dropdown-action${
                      item.danger ? " cro-user-dropdown-action--danger" : ""
                    }${focusedIndex === index ? " cro-user-dropdown-action--focused" : ""}`}
                    onClick={() => handleMenuAction(item)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    tabIndex={focusedIndex === index ? 0 : -1}
                  >
                    <Icon className="cro-user-dropdown-action-icon" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          </>
        )}
      </div>

      <CROModal
        open={helpOpen}
        title="Help & Support"
        onClose={() => setHelpOpen(false)}
        footer={
          <button
            type="button"
            className="cro-modal-btn-primary"
            onClick={() => setHelpOpen(false)}
          >
            Close
          </button>
        }
      >
        <div className="cro-user-help-content">
          <p>
            Need assistance with the CRO Portal? Our enterprise support team is
            available to help with study monitoring, regulatory documents, and
            account management.
          </p>
          <ul>
            <li>
              <strong>Email:</strong> support@trialnxt.com
            </li>
            <li>
              <strong>Phone:</strong> +91 1800-TRIANXT (24/7)
            </li>
            <li>
              <strong>Documentation:</strong> Visit the Knowledge Base from
              Account Settings
            </li>
          </ul>
        </div>
      </CROModal>
    </>
  );
}

export default CROUserProfileDropdown;
