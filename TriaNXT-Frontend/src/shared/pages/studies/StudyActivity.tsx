import RecentActivity from "../../components/dashboard/shared/RecentActivity";
import StudyComments from "./StudyComments";
import CommentModal from "../../comments/CommentModal";
import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { getStudyLogs } from "../../services/adminService";
import "./StudyActivity.css";

const overdueActivities = [
  {
    id: 1,
    activity: "Protocol Review",
    owner: "Quality Team",
    dueDate: "05-Jul-2026",
    status: "Overdue",
  },
];

const upcomingActivities = [
  {
    id: 1,
    activity: "Site Monitoring Visit",
    owner: "Dr. Smith",
    dueDate: "20-Jul-2026",
    status: "Scheduled",
  },
  {
    id: 2,
    activity: "Investigator Meeting",
    owner: "Clinical Team",
    dueDate: "22-Jul-2026",
    status: "Planned",
  },
];

function StudyActivity() {
    const { id: studyCode } = useParams();
    const [showComposeModal, setShowComposeModal] = useState(false);
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState(null);

    // D2 (Activity Access Control): Recent Activity is sourced from the
    // shared, already role/site-scoped getStudyLogs() service (same source
    // used by the Logs tab) instead of a static, unscoped array. This
    // guarantees Admin retains broad authorized visibility while Site
    // Staff/PI only see activity for their authorized site — no Site A →
    // Site B leakage, and nothing is shown outside the current study.
    const loadRecentActivities = useCallback(() => {
        if (!studyCode) {
            return [];
        }

        return getStudyLogs(studyCode)
            .filter((log) => log.type === "Audit")
            .map((log) => ({
                id: log.id,
                title: log.action,
                site: log.site || "—",
                time: log.timestamp,
            }));
    }, [studyCode]);

    const [recentActivities, setRecentActivities] = useState(loadRecentActivities);

    useEffect(() => {
        setRecentActivities(loadRecentActivities());
    }, [loadRecentActivities]);

    useEffect(() => {
        // Event-driven sync (no polling): refresh whenever an activity is
        // recorded or underlying study/subject data changes elsewhere.
        const refresh = () => setRecentActivities(loadRecentActivities());

        window.addEventListener("activity-log-updated", refresh);
        window.addEventListener("studies-updated", refresh);
        window.addEventListener("subjects-updated", refresh);
        window.addEventListener("storage", refresh);

        return () => {
            window.removeEventListener("activity-log-updated", refresh);
            window.removeEventListener("studies-updated", refresh);
            window.removeEventListener("subjects-updated", refresh);
            window.removeEventListener("storage", refresh);
        };
    }, [loadRecentActivities]);

    const handleRefresh = () => {
        window.location.reload();
    };

  return (
    <div className="workspace-content tnxt-compact">

      <div className="activity-header">
        <h2>Study Activity</h2>

        <div className="activity-actions">
          <button onClick={() => setShowComposeModal(true)}>Compose Email</button>
          <button onClick={handleRefresh}>Refresh</button>
          <select>
            <option value="all">All Activities</option>
            <option value="email">Email</option>
            <option value="event">Events</option>
            <option value="task">Tasks</option>
            <option value="call">Log Calls</option>
          </select>
        </div>
      </div>

      <div className="activity-grid">

        <div className="activity-card">
          <h3>Upcoming Activities</h3>
          <table className="activity-table ctms-standard-table">
            <thead>
                <tr>
                    <th>Activity</th>
                    <th>Owner</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Comment</th>
                </tr>
            </thead>

            <tbody>
                {upcomingActivities.map((item) => (
                  <tr key={item.id}>
    <td>{item.activity}</td>
    <td>{item.owner}</td>
    <td>{item.dueDate}</td>
    <td>{item.status}</td>

    <td>
        <button
            onClick={() => {
                setSelectedActivity(item);
                setShowCommentModal(true);
            }}>

            Comment
        </button>
    </td>
</tr>
                ))}
            </tbody>
        </table>
    </div>

        <div className="activity-card">
          <h3>Overdue Activities</h3>
          <table className="activity-table ctms-standard-table">
            <thead>
                <tr>
                    <th>Activity</th>
                    <th>Owner</th>
                    <th>Due Date</th>
                  <th>Status</th>
                  <th>Comment</th>
                </tr>
            </thead>

            <tbody>
                {overdueActivities.map((item) => (
                    <tr key={item.id}>
    <td>{item.activity}</td>
    <td>{item.owner}</td>
    <td>{item.dueDate}</td>
    <td>{item.status}</td>

    <td>
        <button
            onClick={() => {
                setSelectedActivity(item);
                setShowCommentModal(true);
            }}>

            Comment
        </button>
    </td>
</tr>
                ))}
            </tbody>
        </table>
        </div>

        <div className="activity-card">
          <h3>Timeline</h3>
          <RecentActivity activities={recentActivities} />
        </div>

        <div className="activity-card">
            <h3>Activity History</h3>

            <StudyComments />

        </div>

      </div>

      {showComposeModal && (
        <div className="email-modal-overlay">

          <div className="email-modal">

            <h3>Compose Email</h3>

            <input
              type="email"
              placeholder="Recipient"
            />

            <input
              type="text"
              placeholder="Subject"
            />

            <textarea
              rows={5}
              placeholder="Message"
            />

            <div className="modal-actions">

              <button
                onClick={() => {
                  alert("Email Sent");
                  setShowComposeModal(false);
                }}>

                Send
              </button>

              <button
                onClick={() => setShowComposeModal(false)}>

                Cancel
              </button>

            </div>

          </div>

        </div>
      )}
      {showCommentModal && selectedActivity && (
  <CommentModal
    onClose={() => {
      setShowCommentModal(false);
      setSelectedActivity(null);
    }}
    visitId={selectedActivity.id}
    subject="Study Activity"
    visit={selectedActivity.activity}
    study={studyCode}
    activityId={selectedActivity.id}
    activityName={selectedActivity.activity}
    activityType={selectedActivity.status}
    module="Study Activity"
    sourceView="StudyActivity"
  />
)}

    </div>
    
  );
}

export default StudyActivity;