import ROLES from "../constants/roles";
import { getComments, saveComments } from "./adminService";
import {
  getCurrentUser,
  getEffectiveRole,
  hasPermission,
  getAccessibleStudies
} from "./roleService";
import PERMISSIONS from "../constants/permissions";
import { notifyCommentAdded } from "./notificationService";

// Two different features share this one comment store:
// 1. Document/subject-level QC comments (DocumentFolderManager, StudyComments)
//    — these carry a documentId/subjectId and, for Sponsor, stay hidden
//    until the document/study reaches a final stage. This is pre-existing
//    behavior and is preserved as-is.
// 2. Top-level per-study Comments (RoleCommentsView, used by the Sponsor
//    and Admin "Comments" tab) — these never carry a documentId/subjectId
//    and must be visible to every permitted role immediately, scoped only
//    by study (B7). They were incorrectly falling through to the same
//    Sponsor stage-gate below, which hid a Sponsor's own comment from
//    them and from every other role right after posting it.
const FINAL_STAGES = ["Final", "Closeout", "Completed"];
const RESTRICTED_ROLES = [ROLES.CRO, ROLES.SPONSOR];

export function isOpenComment(comment) {
  const status = String(comment?.status || "").toLowerCase();
  return status === "open" || status === "unresolved";
}

// Phase 7 — IMP-4.12 (Comments Dashboard Counts).
// Canonical status predicates and count builder. Every dashboard KPI,
// summary widget, and navigation counter derives Open / Pending /
// Resolved from these rules — the same rules RoleCommentsView filters
// on — so a status transition (add / edit / resolve / reopen /
// updateStatus) reflects in every count in the same tick.
export function isResolvedComment(comment) {
  return String(comment?.status || "").toLowerCase() === "resolved";
}

// "Pending Review" is a distinct workflow state used by RoleCommentsView
// (see the status filter dropdown). Accept every variant spelling so
// dashboard counts match the workflow view exactly.
export function isPendingReviewComment(comment) {
  const status = String(comment?.status || "").toLowerCase();
  return (
    status === "pending-review" ||
    status === "pending review" ||
    status === "pending"
  );
}

// Central count builder — returns the full status breakdown for any
// comment array (already scoped by caller: study, subject, activity, or
// role-authorized full list). Consumers should never re-implement the
// individual status filters; call this and read the fields they need.
export function buildCommentCounts(list) {
  const comments = Array.isArray(list) ? list : [];
  const open = comments.filter(isOpenComment).length;
  const resolved = comments.filter(isResolvedComment).length;
  const pendingReview = comments.filter(isPendingReviewComment).length;
  const total = comments.length;
  const other = Math.max(0, total - open - resolved - pendingReview);

  return {
    total,
    open,
    // "pending" is the Phase 7 dashboard label: everything still awaiting
    // resolution — open + pending-review. Callers that only want the
    // pending-review bucket read `pendingReview` directly.
    pending: open + pendingReview,
    pendingReview,
    resolved,
    other,
  };
}

function isDocumentScopedComment(comment) {
  return Boolean(comment.documentId || comment.subjectId);
}

function accessibleStudyCodeSet(user) {
  return new Set<any>(
    getAccessibleStudies(user)
      .map((study) => String(study?.code || ""))
      .filter(Boolean)
  );
}

export function canWriteComments(user = getCurrentUser()) {
  return hasPermission(PERMISSIONS.CREATE_COMMENT, user);
}

export function canResolveComments(user = getCurrentUser()) {
  const role = getEffectiveRole(user);
  return (
    hasPermission(PERMISSIONS.RESOLVE_COMMENT, user) &&
    [ROLES.ADMIN, ROLES.SITE_STAFF, ROLES.PI].includes(role)
  );
}

// Only the original author (or Admin/PI/Site Staff who can already resolve)
// may edit a comment body. CRO/Sponsor stay create-only per B7.
export function canEditComment(comment, user = getCurrentUser()) {
  if (!comment) {
    return false;
  }

  const role = getEffectiveRole(user);

  if (RESTRICTED_ROLES.includes(role)) {
    return false;
  }

  if ([ROLES.ADMIN, ROLES.SITE_STAFF, ROLES.PI].includes(role)) {
    return true;
  }

  return comment.createdBy && user?.name && comment.createdBy === user.name;
}

// CRO/Sponsor may only ever post a top-level comment — they can never
// reply to an existing one.
export function canReplyToComments(user = getCurrentUser()) {
  const role = getEffectiveRole(user);
  return !RESTRICTED_ROLES.includes(role);
}

export function canViewComment(comment, user = getCurrentUser(), studyStage?) {
  if (!hasPermission(PERMISSIONS.VIEW_COMMENTS, user)) {
    return false;
  }

  const role = getEffectiveRole(user);

  if (role === ROLES.SPONSOR && isDocumentScopedComment(comment)) {
    const stage = comment.stage || studyStage || "";
    return FINAL_STAGES.includes(stage);
  }

  // CRO/Sponsor must never see comments from a study they don't have
  // access to (applies to both document-scoped and top-level comments).
  if (RESTRICTED_ROLES.includes(role)) {
    const studyCode = String(comment.study || comment.studyCode || "");
    return studyCode ? accessibleStudyCodeSet(user).has(studyCode) : false;
  }

  return true;
}

export function getVisibleComments(options: any = {}, user = getCurrentUser()) {
  const { studyCode, subjectId, documentId, studyStage } = options;
  let comments = getComments(user);

  if (studyCode) {
    comments = comments.filter(
      (item) => String(item.study) === String(studyCode)
    );
  }

  if (subjectId) {
    comments = comments.filter(
      (item) => String(item.subjectId) === String(subjectId)
    );
  }

  if (documentId) {
    comments = comments.filter(
      (item) =>
        String(item.documentId) === String(documentId) ||
        String(item.document) === String(documentId)
    );
  }

  return comments.filter((comment) =>
    canViewComment(comment, user, studyStage)
  );
}

// Every mutation entry point in this module funnels through this helper so
// every consumer that listens on either event stays in sync. Phase 7
// (Cross-View Comments Synchronization) requires that Add / Edit / Resolve
// / Reopen / Status Update trigger the exact same broadcast — do not add
// side-specific event names here.
function notifyCommentsUpdated() {
  window.dispatchEvent(new Event("comments-updated"));
  window.dispatchEvent(new Event("sponsor-data-updated"));
  // "notifications-updated" is dispatched separately, only when
  // notifyCommentAdded below actually creates a notification record
  // (see B10) — never fired unconditionally from here.
}

export function addCommentRecord(payload, user = getCurrentUser()) {
  if (!canWriteComments(user)) {
    return null;
  }

  const role = getEffectiveRole(user);
  const requestedParentId = payload.parentId || null;

  // CRO/Sponsor can only ever create a top-level comment — silently force
  // parentId to null instead of trusting a caller-supplied value.
  const parentId = RESTRICTED_ROLES.includes(role) ? null : requestedParentId;

  const comments = getComments(user);
  const newComment = {
    id: `C-${Date.now()}`,
    visitId: payload.visitId || "",
    activityId: payload.activityId || "",
    activityName: payload.activityName || "",
    activityType: payload.activityType || "",
    module: payload.module || "",
    sourceView: payload.sourceView || "",
    parentId,
    subjectId: payload.subjectId || "",
    document: payload.document || payload.documentName || "",
    documentId: payload.documentId || "",
    documentDeleted: false,
    study: payload.study || payload.studyCode || "",
    site: payload.site || user?.assignedSite || "",
    activity: payload.activity || "",
    status: "Open",
    priority: payload.priority || "Medium",
    stage: payload.stage || "Monitoring",
    createdAt: new Date().toISOString().slice(0, 10),
    createdBy: user?.name || "Unknown",
    description: payload.description || payload.text || "",
    createdRole: role
  };

  saveComments([newComment, ...comments]);
  notifyCommentsUpdated();
  // notifyCommentAdded expects { studyCode, authorRole }, while this
  // record's own schema (shared with the document-scoped QC comment
  // feature above) uses { study, createdRole } — adapt the field names
  // here rather than renaming the stored record shape everywhere else.
  notifyCommentAdded({module: payload.module || "",
    sourceView: payload.sourceView || "",
    studyCode: newComment.study,
    authorRole: newComment.createdRole,
  });
  return newComment;
}

export function resolveCommentRecord(commentId, user = getCurrentUser()) {
  if (!canResolveComments(user)) {
    return false;
  }

  const comments = getComments(user).map((item) =>
    item.id === commentId
      ? {
          ...item,
          status: "Resolved",
          resolvedAt: new Date().toISOString(),
          resolvedBy: user?.name || "Unknown"
        }
      : item
  );

  saveComments(comments);
  notifyCommentsUpdated();
  return true;
}

// Canonical reopen: mirrors resolveCommentRecord so a "Reopen" action from
// any consumer flows through the same access checks and fires the same
// comments-updated / sponsor-data-updated events every other view listens
// for. Previously reopens were performed by writing via saveComments
// directly, which only dispatched admin-data-updated — CommentsContext
// (and every consumer that subscribes to it) would not refresh until the
// next reload.
export function reopenCommentRecord(commentId, user = getCurrentUser()) {
  if (!canResolveComments(user)) {
    return false;
  }

  const comments = getComments(user).map((item) => {
    if (item.id !== commentId) {
      return item;
    }

    // Preserve the rest of the record; just clear resolution metadata and
    // restore canonical Open status.
    const { resolvedAt, resolvedBy, ...rest } = item;
    void resolvedAt;
    void resolvedBy;
    return {
      ...rest,
      status: "Open"
    };
  });

  saveComments(comments);
  notifyCommentsUpdated();
  return true;
}

// Phase-7: Subject Comments edit. Allows the author (or a role that can
// resolve comments) to update the description text on an existing comment
// without going through the resolve/reopen path. Fires the shared
// comments-updated events so every subscriber (Subject Comments modal,
// dashboard widgets, RoleCommentsView) refreshes automatically.
export function updateCommentRecord(commentId,updates: any = {}, user = getCurrentUser()) {
  if (!commentId || !updates || typeof updates !== "object") {
    return null;
  }

  const comments = getComments(user);
  const target = comments.find((item) => item.id === commentId);

  if (!target) {
    return null;
  }

  // Only the original author or a resolver-capable role may edit the text.
  const role = getEffectiveRole(user);
  const isAuthor = target.createdBy && user?.name && target.createdBy === user.name;
  const isResolver =
    hasPermission(PERMISSIONS.RESOLVE_COMMENT, user) &&
    [ROLES.ADMIN, ROLES.SITE_STAFF, ROLES.PI].includes(role);

  if (!isAuthor && !isResolver) {
    return null;
  }

  const nextComments = comments.map((item) =>
    item.id === commentId
      ? {
          ...item,
          description:
            typeof updates.description === "string"
              ? updates.description
              : typeof updates.text === "string"
              ? updates.text
              : item.description,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.name || item.createdBy,
        }
      : item
  );

  saveComments(nextComments);
  notifyCommentsUpdated();
  return nextComments.find((item) => item.id === commentId) || null;
}

// Phase-7: Subject Comments delete. Same gating as updateCommentRecord above.
// The consumer (Subject Comments modal) is expected to present a proper
// DeleteConfirmationModal beforehand — this function itself does not
// prompt.
export function deleteCommentRecord(commentId, user = getCurrentUser()) {
  if (!commentId) {
    return false;
  }

  const comments = getComments(user);
  const target = comments.find((item) => item.id === commentId);

  if (!target) {
    return false;
  }

  const role = getEffectiveRole(user);
  const isAuthor = target.createdBy && user?.name && target.createdBy === user.name;
  const isResolver =
    hasPermission(PERMISSIONS.RESOLVE_COMMENT, user) &&
    [ROLES.ADMIN, ROLES.SITE_STAFF, ROLES.PI].includes(role);

  if (!isAuthor && !isResolver) {
    return false;
  }

  const nextComments = comments.filter((item) => item.id !== commentId);
  saveComments(nextComments);
  notifyCommentsUpdated();
  return true;
}

// Phase 7: canonical body/metadata edit. Any consumer that lets a user
// change a comment's text, priority, or stage must funnel through this
// entry point so the same comments-updated / sponsor-data-updated events
// fire and every subscribed view (Study/Subject/Activity/Open/Pending,
// dashboard widgets, counters) refreshes off the shared store — no
// duplicate localStorage writes, no per-view state to keep in sync.
export function editCommentRecord(commentId,updates: any = {}, user = getCurrentUser()) {
  const existing = getComments(user).find((item) => item.id === commentId);

  if (!existing || !canEditComment(existing, user)) {
    return null;
  }

  // Whitelist editable fields — never let a caller flip status, resolvedBy,
  // createdBy, id or timestamps from here. Status changes go through
  // resolveCommentRecord / reopenCommentRecord / updateCommentStatusRecord.
  const editable: Record<string, any> = {};;
  if (typeof updates.description === "string") {
    editable.description = updates.description;
  }
  if (typeof updates.text === "string" && updates.description === undefined) {
    editable.description = updates.text;
  }
  if (typeof updates.priority === "string") {
    editable.priority = updates.priority;
  }
  if (typeof updates.stage === "string") {
    editable.stage = updates.stage;
  }

  if (Object.keys(editable).length === 0) {
    return existing;
  }

  let updatedRecord = existing;
  const comments = getComments(user).map((item) => {
    if (item.id !== commentId) {
      return item;
    }
    updatedRecord = {
      ...item,
      ...editable,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.name || "Unknown",
    };
    return updatedRecord;
  });

  saveComments(comments);
  notifyCommentsUpdated();
  return updatedRecord;
}

// Phase 7: generic status-update entry point. Consumers that previously
// wrote `{ status: "resolved" }` via ad-hoc saveComments calls (PI
// dashboard service, CRO context) must go through here so the single
// source of truth (CommentsContext) refreshes across every view.
export function updateCommentStatusRecord(commentId, nextStatus, user = getCurrentUser()) {
  const normalized = String(nextStatus || "").toLowerCase();

  if (normalized === "resolved") {
    return resolveCommentRecord(commentId, user);
  }

  if (normalized === "open" || normalized === "unresolved" || normalized === "reopen") {
    return reopenCommentRecord(commentId, user);
  }

  // Fall-through: for any other status transition (e.g. "pending-review")
  // require resolve-level permission and route through the same broadcast
  // so counters/widgets pick it up. This preserves the existing custom
  // statuses used by RoleCommentsView (`pending-review`).
  if (!canResolveComments(user)) {
    return false;
  }

  const comments = getComments(user).map((item) =>
    item.id === commentId
      ? {
          ...item,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.name || "Unknown",
        }
      : item
  );

  saveComments(comments);
  notifyCommentsUpdated();
  return true;
}

export function markCommentsDocumentDeleted(documentId, documentName) {
  const comments = getComments().map((item) => {
    const matches =
      String(item.documentId) === String(documentId) ||
      (documentName && item.document === documentName);

    if (!matches) {
      return item;
    }

    return {
      ...item,
      documentDeleted: true,
      document: documentName || item.document
    };
  });

  saveComments(comments);
  notifyCommentsUpdated();
}