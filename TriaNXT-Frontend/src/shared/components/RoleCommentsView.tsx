import { normalizeStatus } from "../utils/normalizeStatus";
import React, { useEffect, useMemo, useState } from "react";
import "../../PI/styles/PIComments.css";
import {
  canResolveComments,
  canViewComment,
  canWriteComments,
} from "../services/commentService";
import { getAssignedSite, getCurrentUser } from "../services/roleService";
import { useComments } from "../comments/CommentsContext";
import CommentModal from "../comments/CommentModal";

const SORT_FIELDS = {
  id: "id",
  subjectId: "subjectId",
  visit: "visit",
  type: "type",
  date: "date",
  status: "status",
};

function toDisplayStatus(status) {
  if (status === "resolved") {
    return "Resolved";
  }

  if (status === "unresolved") {
    return "Open";
  }

  return "Pending Review";
}

function mapCommentRecord(comment) {
  return {
    id: comment.id,
    subjectId: comment.subjectId || "—",
    visit: comment.document || comment.stage || "—",
    type: comment.stage || "General",
    comment: comment.description || "—",
    createdBy: comment.createdBy || "—",
    date: comment.createdAt || "—",
    status: normalizeStatus(comment.status, { type: "comment" }),
    study: comment.study || "",
    site: comment.site || "",
    rawStatus: comment.status,
  };
}

export default function RoleCommentsView({ embedded = false }: any) {
  const currentUser = getCurrentUser();
  const assignedSite = getAssignedSite() || "All Sites";
  const {
    comments: authoritativeComments,
    resolveComment,
    reopenComment,
    addComment: createComment,
  } = useComments();

  const sourceComments = useMemo(() => {
    return authoritativeComments
      .filter((comment) => canViewComment(comment, currentUser))
      .map(mapCommentRecord);
  }, [authoritativeComments, currentUser]);

  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSite, setSelectedSite] = useState(assignedSite);
  const [selectedStudy, setSelectedStudy] = useState("All Studies");
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [selectedVisit, setSelectedVisit] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedComment, setSelectedComment] = useState(null);
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [showAddCommentModal, setShowAddCommentModal] = useState(false);

  const availableStudies = useMemo(() => {
    const studies = [
      ...new Set<any>(sourceComments.map((item) => item.study).filter(Boolean)),
    ];
    return studies.length ? studies : ["All Studies"];
  }, [sourceComments]);

  useEffect(() => {
    const defaultStudy = availableStudies.find((study) => study !== "All Studies");

    if (selectedStudy === "All Studies" && defaultStudy) {
      setSelectedStudy(defaultStudy);
    }
  }, [availableStudies, selectedStudy]);

  const searchSuggestions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q || q.length < 2) {
      return [];
    }

    const matches = new Set<any>();
    sourceComments.forEach((comment) => {
      if (comment.subjectId?.toLowerCase().includes(q)) {
        matches.add(comment.subjectId);
      }
      if (comment.visit?.toLowerCase().includes(q)) {
        matches.add(comment.visit);
      }
      if (comment.comment?.toLowerCase().includes(q)) {
        matches.add(
          comment.comment.slice(0, 48) +
            (comment.comment.length > 48 ? "…" : "")
        );
      }
    });

    return Array.from(matches).slice(0, 5);
  }, [sourceComments, searchQuery]);

  const filteredComments = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    let result = sourceComments.filter((comment) => {
      const statusMatch =
        filter === "all" ||
        comment.status === filter ||
        (filter === "unresolved" && comment.status === "unresolved");
      const studyMatch =
        selectedStudy === "All Studies" || comment.study === selectedStudy;
      const subjectMatch =
        selectedSubject === "All" || comment.subjectId === selectedSubject;
      const visitMatch = selectedVisit === "All" || comment.visit === selectedVisit;
      const typeMatch = selectedType === "All" || comment.type === selectedType;
      const searchMatch =
        !q ||
        comment.subjectId?.toLowerCase().includes(q) ||
        comment.visit?.toLowerCase().includes(q) ||
        comment.comment?.toLowerCase().includes(q) ||
        comment.type?.toLowerCase().includes(q) ||
        comment.createdBy?.toLowerCase().includes(q);

      return (
        statusMatch &&
        studyMatch &&
        subjectMatch &&
        visitMatch &&
        typeMatch &&
        searchMatch
      );
    });

    result = [...result].sort((a, b) => {
      const field = SORT_FIELDS[sortField] || sortField;
      const av = (a[field] || "").toString().toLowerCase();
      const bv = (b[field] || "").toString().toLowerCase();
      if (av < bv) {
        return sortDir === "asc" ? -1 : 1;
      }
      if (av > bv) {
        return sortDir === "asc" ? 1 : -1;
      }
      return 0;
    });

    return result;
  }, [
    sourceComments,
    filter,
    searchQuery,
    selectedStudy,
    selectedSubject,
    selectedVisit,
    selectedType,
    sortField,
    sortDir,
  ]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const toggleStatus = (comment) => {
    if (comment.status === "resolved") {
      // Reopen goes through the canonical commentService entry point so it
      // fires the same comments-updated / sponsor-data-updated events every
      // other consumer subscribes to (Study/Subject/Operations Comments,
      // dashboard KPI widgets, PendingCommentsWidget). Previously this
      // wrote via saveComments directly, which only dispatched
      // admin-data-updated and left other views stale until reload.
      reopenComment(comment.id);
      return;
    }

    resolveComment(comment.id);
  };

  const addComment = () => {
    if (!canWriteComments(currentUser)) {
      return;
    }
    setShowAddCommentModal(true);
  };

  const totalComments = sourceComments.length;
  const openComments = sourceComments.filter(
    (comment) => comment.status === "unresolved"
  ).length;
  const resolvedComments = sourceComments.filter(
    (comment) => comment.status === "resolved"
  ).length;
  const pendingReviewComments = sourceComments.filter(
    (comment) => comment.status === "pending-review"
  ).length;

  const sortIndicator = (field) =>
    sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div
      className={`pi-page-content comments-content tnxt-compact${
        embedded ? " embedded" : ""
      }`}
    >
      <div className="comments-header page-section-highlight">
        <div>
          <h2>Comments</h2>
          <p className="comments-subtitle">
            View and manage all comments for subjects and visits.
          </p>
        </div>
        <div className="header-actions">
          <button type="button">Copy</button>
          <button type="button">Excel</button>
          <button type="button">CSV</button>
          <button type="button">PDF</button>
        </div>
      </div>

      <div className="top-filters">
        <div className="assigned-info">
          <label>Assigned Site</label>
          <select
            value={selectedSite}
            onChange={(event) => setSelectedSite(event.target.value)}
          >
            <option value={assignedSite}>{assignedSite}</option>
          </select>
        </div>
        <div>
          <label>Study</label>
          <select
            value={selectedStudy}
            onChange={(event) => setSelectedStudy(event.target.value)}
          >
            <option value="All Studies">All Studies</option>
            {availableStudies.map((study) => (
              <option key={study} value={study}>
                {study}
              </option>
            ))}
          </select>
        </div>
        <div className="global-search pi-comments-search-wrap">
          <input
            type="text"
            placeholder="Search by Subject ID, Visit, Type, or Comment..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Search comments"
          />
          {searchSuggestions.length > 0 && (
            <ul className="pi-search-suggestions">
              {searchSuggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() =>
                      setSearchQuery(suggestion.replace("…", ""))
                    }
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="pi-kpi-cards-grid comments-kpi-grid">
        <div className="pi-enterprise-kpi blue">
          <span className="pi-enterprise-kpi-label">Total Comments</span>
          <span className="pi-enterprise-kpi-value">{totalComments}</span>
        </div>
        <div className="pi-enterprise-kpi orange">
          <span className="pi-enterprise-kpi-label">Open Comments</span>
          <span className="pi-enterprise-kpi-value">{openComments}</span>
        </div>
        <div className="pi-enterprise-kpi green">
          <span className="pi-enterprise-kpi-label">Resolved Comments</span>
          <span className="pi-enterprise-kpi-value">{resolvedComments}</span>
        </div>
        <div className="pi-enterprise-kpi purple">
          <span className="pi-enterprise-kpi-label">Pending Review</span>
          <span className="pi-enterprise-kpi-value">
            {openComments + pendingReviewComments}
          </span>
        </div>
      </div>

      {canWriteComments(currentUser) && (
        <button type="button" className="add-comment-btn" onClick={addComment}>
          ➕ Add Comment
        </button>
      )}

      <div className="comments-filters">
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All Statuses</option>
          <option value="unresolved">Open</option>
          <option value="resolved">Resolved</option>
          <option value="pending-review">Pending Review</option>
        </select>
        <select
          value={selectedSubject}
          onChange={(event) => setSelectedSubject(event.target.value)}
        >
          <option value="All">All Subjects</option>
          {[...new Set<any>(sourceComments.map((comment) => comment.subjectId))].map(
            (subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            )
          )}
        </select>
        <select
          value={selectedType}
          onChange={(event) => setSelectedType(event.target.value)}
        >
          <option value="All">All Types</option>
          {[...new Set<any>(sourceComments.map((comment) => comment.type))].map(
            (type) => (
              <option key={type} value={type}>
                {type}
              </option>
            )
          )}
        </select>
        <select
          value={selectedVisit}
          onChange={(event) => setSelectedVisit(event.target.value)}
        >
          <option value="All">All Visits</option>
          {[...new Set<any>(sourceComments.map((comment) => comment.visit))].map(
            (visit) => (
              <option key={visit} value={visit}>
                {visit}
              </option>
            )
          )}
        </select>
      </div>

      <div className="table-container">
        <table className="pi-table comments-table ctms-standard-table">
          <thead>
            <tr>
              <th onClick={() => handleSort("id")} className="pi-sortable-th">
                Comment ID{sortIndicator("id")}
              </th>
              <th
                onClick={() => handleSort("subjectId")}
                className="pi-sortable-th">

                Subject ID{sortIndicator("subjectId")}
              </th>
              <th onClick={() => handleSort("visit")} className="pi-sortable-th">
                Visit{sortIndicator("visit")}
              </th>
              <th onClick={() => handleSort("type")} className="pi-sortable-th">
                Type{sortIndicator("type")}
              </th>
              <th>Comment</th>
              <th>Created By</th>
              <th onClick={() => handleSort("date")} className="pi-sortable-th">
                Date{sortIndicator("date")}
              </th>
              <th
                onClick={() => handleSort("status")}
                className="pi-sortable-th">

                Status{sortIndicator("status")}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredComments.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center" }}>
                  No Comments Found
                </td>
              </tr>
            ) : (
              filteredComments.map((comment) => (
                <tr key={comment.id}>
                  <td>{comment.id}</td>
                  <td>{comment.subjectId}</td>
                  <td>{comment.visit}</td>
                  <td>{comment.type}</td>
                  <td>{comment.comment}</td>
                  <td>{comment.createdBy}</td>
                  <td>{comment.date}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => toggleStatus(comment)}
                      className={`status-badge status-${
                        comment.status === "resolved"
                          ? "resolved"
                          : comment.status === "pending-review"
                          ? "pending"
                          : "open"
                      }`}>

                      {toDisplayStatus(comment.status)}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="view-btn"
                      onClick={() => setSelectedComment(comment)}>

                      View
                    </button>
                    {canResolveComments(currentUser) && (
                      <button
                        type="button"
                        className="resolve-btn"
                        onClick={() => toggleStatus(comment)}>

                        {comment.status === "resolved" ? "Reopen" : "Resolve"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddCommentModal && (
        <CommentModal
          onClose={() => setShowAddCommentModal(false)}
          context={{
            study: selectedStudy,
            site: selectedSite,
            module: "RoleComments",
            sourceView: "comments-view",
          }}
          onSubmit={(commentData) => {
            createComment("", {
              text: commentData.comment,
              study: selectedStudy === "All Studies" ? "" : selectedStudy,
              site: selectedSite,
              module: "RoleComments",
              sourceView: "comments-view",
              stage: "Monitoring",
            });
            setShowAddCommentModal(false);
          }}
        />
      )}

      {selectedComment && (
        <div className="modal-overlay">
          <div className="comment-modal">
            <h2>Comment Details</h2>
            <p>
              <strong>Comment ID:</strong> {selectedComment.id}
            </p>
            <p>
              <strong>Subject ID:</strong> {selectedComment.subjectId}
            </p>
            <p>
              <strong>Visit:</strong> {selectedComment.visit}
            </p>
            <p>
              <strong>Type:</strong> {selectedComment.type}
            </p>
            <p>
              <strong>Comment:</strong> {selectedComment.comment}
            </p>
            <p>
              <strong>Created By:</strong> {selectedComment.createdBy}
            </p>
            <p>
              <strong>Date:</strong> {selectedComment.date}
            </p>
            <button
              type="button"
              className="close-btn"
              onClick={() => setSelectedComment(null)}>

              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}