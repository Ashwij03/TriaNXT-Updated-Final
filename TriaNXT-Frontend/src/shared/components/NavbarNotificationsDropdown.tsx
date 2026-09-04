import { useEffect, useRef, useState } from "react";
import { FiBell } from "react-icons/fi";
import "./NavbarNotificationsDropdown.css";

function NavbarNotificationsDropdown({
  notifications = [],
  unreadCount = 0,
  onToggleRead,
  onMarkAllRead,
  onViewAll,
  onItemNavigate,
  className = "",
  buttonClassName = "",
}: any) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      className={`navbar-notifications ${className}`.trim()}
      ref={containerRef}
    >
      <button
        type="button"
        className={`navbar-notifications-btn ${buttonClassName}`.trim()}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <FiBell />
        {unreadCount > 0 && (
          <span className="navbar-notifications-badge">{unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="navbar-notifications-menu">
          <div className="navbar-notifications-header">
            <span>
              Notifications ({notifications.length})
              {unreadCount > 0 && (
                <span className="navbar-notifications-unread-label">
                  {" "}
                  · {unreadCount} unread
                </span>
              )}
            </span>
            {unreadCount > 0 && onMarkAllRead && (
              <button
                type="button"
                className="navbar-notifications-mark-all"
                onClick={(event) => {
                  event.stopPropagation();
                  onMarkAllRead();
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="navbar-notifications-empty">No notifications</div>
          ) : (
            notifications.slice(0, 5).map((notification, index) => {
              const isRead =
                notification.read === true ||
                notification.status === "Read";

              return (
                <div
                  key={notification.id || `${notification.title}-${index}`}
                  className={`navbar-notifications-item ${
                    isRead ? "read" : "unread"
                  }`}
                >
                  <div
                    className="navbar-notifications-item-body"
                    onClick={() => {
                      setOpen(false);
                      if (onItemNavigate) {
                        onItemNavigate(notification);
                      } else if (onViewAll) {
                        onViewAll();
                      }
                    }}
                  >
                    <strong>{notification.title || notification.message}</strong>
                    {notification.message && notification.title && (
                      <p>{notification.message}</p>
                    )}
                    <small>
                      {notification.date ||
                        notification.createdAt ||
                        notification.timestamp ||
                        ""}
                    </small>
                  </div>
                  {onToggleRead && (
                    <button
                      type="button"
                      className="navbar-notifications-toggle-read"
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleRead(notification, index);
                      }}
                    >
                      {isRead ? "Unread" : "Read"}
                    </button>
                  )}
                </div>
              );
            })
          )}

          {onViewAll && (
            <div
              className="navbar-notifications-view-all"
              onClick={() => {
                setOpen(false);
                onViewAll();
              }}
            >
              View All Notifications
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NavbarNotificationsDropdown;
