import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getComments } from "../services/adminService";
import {
  addCommentRecord,
  deleteCommentRecord,
  buildCommentCounts,
  editCommentRecord,
  isOpenComment,
  isPendingReviewComment,
  isResolvedComment,
  reopenCommentRecord,
  resolveCommentRecord,
  updateCommentRecord,
} from "../services/commentService";
import { getCurrentUser } from "../services/roleService";

export interface CommentsContextValue {
  comments: any[];
  pendingCount: number;
  openCount: number;
  resolvedCount: number;
  pendingReviewCount: number;
  totalCount: number;
  commentCounts: { open: number; resolved: number; pendingReview: number; total: number };
  getCommentCounts: (filter?: (comment: any) => boolean) => { open: number; resolved: number; pendingReview: number; total: number };
  addComment: (visitId: any, data?: any) => any;
  editComment: (id: any, updates?: any) => any;
  resolveComment: (id: any) => void;
  reopenComment: (id: any) => void;
  updateComment: (id: any, updates?: any) => any;
  deleteComment: (id: any) => any;
  refreshComments: () => void;
}

const CommentsContext = createContext<CommentsContextValue | undefined>(undefined);

// Re-export the canonical predicates and builder so Comments consumers
// have one import path for both the live counts (useComments) and the
// pure helpers (for callers that already have an array in hand, e.g.
// unit tests or contextual widgets outside a Provider tree).
export {
  isOpenComment,
  isResolvedComment,
  isPendingReviewComment,
  buildCommentCounts,
};

// Single source of truth for every Comments consumer in the app. Phase 7
// (Cross-View Comments Synchronization) requires that Study Comments,
// Subject Comments, Activity Comments, Open Comments, Pending Comments,
// dashboard widgets, and comment counters all read/write the same store.
// This provider:
//   - Reads once from the shared comment store (adminService.getComments).
//   - Rebuilds on comments-updated / sponsor-data-updated (dispatched by
//     every mutation entry point in commentService.js).
//   - Exposes add / edit / resolve / reopen / updateStatus so consumers
//     never have to import commentService directly and never keep their
//     own duplicated state or their own window listeners.
export function CommentsProvider({ children }: any) {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [comments, setComments] = useState(() => getComments(currentUser));

  const refreshComments = useCallback(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    setComments(getComments(user));
  }, []);

  useEffect(() => {
    refreshComments();

    window.addEventListener("comments-updated", refreshComments);
    window.addEventListener("sponsor-data-updated", refreshComments);

    return () => {
      window.removeEventListener("comments-updated", refreshComments);
      window.removeEventListener("sponsor-data-updated", refreshComments);
    };
  }, [refreshComments]);

  // Phase 7 — IMP-4.12: authoritative Open/Pending/Resolved/total counts
  // for every dashboard KPI, summary widget, and navigation counter.
  // Everything is derived from the same `comments` array that Study/
  // Subject/Activity/Open/Pending views already render, so a status
  // transition (add / edit / resolve / reopen / updateStatus) refreshes
  // this snapshot in the same tick and every subscribed KPI re-renders
  // with no extra listeners or duplicate localStorage reads.
  const commentCounts = useMemo(
    () => buildCommentCounts(comments),
    [comments]
  );

  // Contextual counts — Study/Subject/Activity dashboards need Open/
  // Pending/Resolved *scoped to that entity*. Consumers pass a predicate
  // (e.g. `(c) => c.study === studyCode`) and get back the same shape as
  // commentCounts, computed from the canonical authorized array. This
  // replaces per-view `filter(...).length` copies that used to drift
  // whenever a comment was resolved/reopened in another tab.
  const getCommentCounts = useCallback(
    (filter) => {
      if (typeof filter !== "function") {
        return commentCounts;
      }

      return buildCommentCounts(comments.filter(filter));
    },
    [comments, commentCounts]
  );

  // Pre-existing API — kept as an alias so every current consumer keeps
  // working (Admin/SiteStaff/CRO/PI dashboards). `pendingCount` in the
  // legacy sense was "Open Comments" — mirror that exactly.
  const pendingCount = commentCounts.open;
  const openCount = commentCounts.open;
  const resolvedCount = commentCounts.resolved;
  const pendingReviewCount = commentCounts.pendingReview;
  const totalCount = commentCounts.total;

  const addComment = useCallback(
    (visitId, data: any = {}) => {
      const record = addCommentRecord(
        {
          visitId,
          description: data.text || data.description || "",
          subjectId: data.subjectId || data.subject || "",
          study: data.study || data.studyCode || "",
          site: data.site || currentUser?.assignedSite || "",
          stage: data.visitName || data.stage || "General",
          activity: data.activity || "",
          module: data.module || "",
          sourceView: data.sourceView || "",
        },
        currentUser
      );

      // commentService already dispatches comments-updated /
      // sponsor-data-updated, which triggers refreshComments via the
      // useEffect above. The explicit call here keeps the local state
      // fresh on the same tick for callers that read `comments` right
      // after addComment resolves.
      refreshComments();
      return record;
    },
    [currentUser, refreshComments]
  );

  const editComment = useCallback(
    (id, updates: any = {}) => {
      const record = editCommentRecord(id, updates, currentUser);
      refreshComments();
      return record;
    },
    [currentUser, refreshComments]
  );

  const resolveComment = useCallback(
    (id) => {
      resolveCommentRecord(id, currentUser);
      refreshComments();
    },
    [currentUser, refreshComments]
  );

  const reopenComment = useCallback(
    (id) => {
      reopenCommentRecord(id, currentUser);
      refreshComments();
    },
    [currentUser, refreshComments]
  );

  // Phase-7 Subject Comments: expose edit/delete on the shared context so
  // the SubjectComments modal doesn't have to reach into commentService
  // directly and can reuse the same refresh flow every other consumer
  // subscribes to.
  const updateComment = useCallback(
    (id, updates) => {
      const record = updateCommentRecord(id, updates, currentUser);
      refreshComments();
      return record;
    },
    [currentUser, refreshComments]
  );

  const deleteComment = useCallback(
    (id) => {
      const ok = deleteCommentRecord(id, currentUser);
      refreshComments();
      return ok;
    },
    [currentUser, refreshComments]
  );

  return (
    <CommentsContext.Provider
      value={{
        comments,
        // Legacy alias — same value as openCount / commentCounts.open.
        pendingCount,
        // Phase 7 — IMP-4.12 canonical count exports.
        openCount,
        resolvedCount,
        pendingReviewCount,
        totalCount,
        commentCounts,
        getCommentCounts,
        addComment,
        editComment,
        resolveComment,
        reopenComment,
        updateComment,
        deleteComment,
        refreshComments,
      }}
    >
      {children}
    </CommentsContext.Provider>
  );
}

export const useComments = () => useContext(CommentsContext);