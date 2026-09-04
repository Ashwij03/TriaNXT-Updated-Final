import { readJson } from "../utils/storageHelpers";
import ROLES from "../constants/roles";
import { formatUserDisplayName, getCurrentUser } from "./roleService";

const SESSION_KEY = "userSessionMeta";
const SESSION_HISTORY_KEY = "userSessionHistory";
const ACTIVE_SESSIONS_REGISTRY_KEY = "activeSessionsRegistry";
export const SESSIONS_CHANGE_EVENT = "activeSessionsChange";

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function dispatchSessionsChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(SESSIONS_CHANGE_EVENT));
}

function createSessionId() {
  return `SES-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readActiveSessionsRegistry() {
  return readJson(ACTIVE_SESSIONS_REGISTRY_KEY, []);
}

function writeActiveSessionsRegistry(sessions) {
  writeJson(ACTIVE_SESSIONS_REGISTRY_KEY, sessions);
  dispatchSessionsChange();
}

function upsertActiveSessionRegistry(session) {
  if (!session?.sessionId) {
    return;
  }

  const registry = readActiveSessionsRegistry();
  const index = registry.findIndex(
    (entry) => entry.sessionId === session.sessionId,
  );
  const nextEntry = {
    ...registry[index],
    ...session,
  };

  if (index >= 0) {
    registry[index] = nextEntry;
  } else {
    registry.unshift(nextEntry);
  }

  writeActiveSessionsRegistry(registry.slice(0, 50));
}

function markRegistrySessionEnded(sessionId, endedAt) {
  const registry = readActiveSessionsRegistry();
  const index = registry.findIndex((entry) => entry.sessionId === sessionId);

  if (index < 0) {
    return;
  }

  registry[index] = {
    ...registry[index],
    active: false,
    endedAt,
  };
  writeActiveSessionsRegistry(registry);
}

function readKnownUsers() {
  return readJson("users", []);
}

function buildRoleSessionSnapshot(user, offsetHours = 1) {
  const startedAt = new Date(
    Date.now() - offsetHours * 60 * 60 * 1000,
  ).toISOString();

  const displayName = formatUserDisplayName(user);

  return {
    sessionId: `SES-ROLE-${String(user.role).replace(/\s+/g, "")}-${String(
      user.id || user.email,
    ).replace(/[^a-zA-Z0-9]/g, "")}`,
    userEmail: user.email,
    userName: user.name,
    displayName,
    role: user.role,
    startedAt,
    lastActivityAt: startedAt,
    ipAddress: "127.0.0.1",
    device: offsetHours % 2 ? "Mobile Browser" : "Desktop Browser",
    browser: "Chrome",
    active: true,
    isRoleSnapshot: true,
  };
}

function ensureSessionsForAllRoles(sessions) {
  const users = readKnownUsers();
  const activeByRole = new Map();

  sessions.forEach((session) => {
    if (session.active && session.role) {
      activeByRole.set(session.role, session);
    }
  });

  const merged = [...sessions];
  let offset = 2;

  users.forEach((user) => {
    if (!user?.role || activeByRole.has(user.role)) {
      return;
    }

    const snapshot = buildRoleSessionSnapshot(user, offset);
    activeByRole.set(user.role, snapshot);
    merged.push(snapshot);
    offset += 1;
  });

  Object.values(ROLES).forEach((role) => {
    if (activeByRole.has(role)) {
      return;
    }

    const snapshot = buildRoleSessionSnapshot(
      {
        email: `${String(role).toLowerCase()}@trianxt.local`,
        name: role,
        role,
      },
      offset,
    );
    activeByRole.set(role, snapshot);
    merged.push(snapshot);
    offset += 1;
  });

  return merged
    .filter((session) => session.active)
    .sort(
      (a, b) =>
        new Date(b.lastActivityAt || b.startedAt).getTime() -
        new Date(a.lastActivityAt || a.startedAt).getTime(),
    );
}

export function initializeUserSession(user = getCurrentUser()) {
  if (!user || typeof window === "undefined") {
    return null;
  }

  const existing = readJson(SESSION_KEY, null);

  if (existing?.userEmail === user.email && existing?.active) {
    return touchUserSession(user);
  }

  const session = {
    sessionId: createSessionId(),
    userEmail: user.email,
    userName: user.name,
    displayName: formatUserDisplayName(user),
    role: user.role,
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    ipAddress: "127.0.0.1",
    device: navigator.userAgent.includes("Mobile")
      ? "Mobile Browser"
      : "Desktop Browser",
    browser: navigator.userAgent.split(" ").slice(-2).join(" ") || "Unknown",
    active: true,
  };

  writeJson(SESSION_KEY, session);
  upsertActiveSessionRegistry(session);

  const history = readJson(SESSION_HISTORY_KEY, []);
  history.unshift({
    sessionId: session.sessionId,
    userEmail: session.userEmail,
    userName: session.userName,
    role: session.role,
    startedAt: session.startedAt,
    endedAt: null,
    device: session.device,
    ipAddress: session.ipAddress,
  });
  writeJson(SESSION_HISTORY_KEY, history.slice(0, 20));

  return session;
}

export function touchUserSession(user = getCurrentUser()) {
  const session = readJson(SESSION_KEY, null);

  if (!session || session.userEmail !== user?.email) {
    return initializeUserSession(user);
  }

  const now = Date.now();
  const lastTouchedAt = new Date(
    session.lastActivityAt || session.startedAt || 0,
  ).getTime();

  const nextUserName = user?.name || session.userName;
  const nextRole = user?.role || session.role;
  const nextDisplayName = formatUserDisplayName({
    ...user,
    role: nextRole,
    name: nextUserName,
  });

  const identityChanged =
    nextUserName !== session.userName ||
    nextRole !== session.role ||
    nextDisplayName !== session.displayName;

  if (!identityChanged && now - lastTouchedAt < 30000) {
    return session;
  }

  const updated = {
    ...session,
    userName: nextUserName,
    displayName: nextDisplayName,
    role: nextRole,
    lastActivityAt: new Date(now).toISOString(),
    active: true,
  };

  writeJson(SESSION_KEY, updated);
  upsertActiveSessionRegistry(updated);
  return updated;
}

export function getCurrentSession(user = getCurrentUser()) {
  const session = readJson(SESSION_KEY, null);

  if (!session || session.userEmail !== user?.email) {
    return initializeUserSession(user);
  }

  return session;
}

export function getSessionHistory(user = getCurrentUser()) {
  return readJson(SESSION_HISTORY_KEY, []).filter(
    (entry) =>
      !user?.email || entry.userEmail === user.email || !entry.userEmail,
  );
}

export function getAllActiveSessions() {
  const registry = readActiveSessionsRegistry().filter(
    (session) => session.active,
  );
  const current = readJson(SESSION_KEY, null);
  const withCurrent = [...registry];

  if (current?.active) {
    const index = withCurrent.findIndex(
      (session) => session.sessionId === current.sessionId,
    );

    if (index >= 0) {
      withCurrent[index] = { ...withCurrent[index], ...current };
    } else {
      withCurrent.unshift(current);
    }
  }

  return ensureSessionsForAllRoles(withCurrent);
}

export function getSessionDurationMinutes(session = getCurrentSession()) {
  if (!session?.startedAt) {
    return 0;
  }

  const started = new Date(session.startedAt).getTime();
  const last = new Date(session.lastActivityAt || session.startedAt).getTime();
  return Math.max(1, Math.round((last - started) / 60000));
}

export function terminateCurrentSession() {
  const session = readJson(SESSION_KEY, null);

  if (!session) {
    return null;
  }

  const ended = {
    ...session,
    active: false,
    endedAt: new Date().toISOString(),
  };

  writeJson(SESSION_KEY, ended);
  markRegistrySessionEnded(session.sessionId, ended.endedAt);

  const history = readJson(SESSION_HISTORY_KEY, []);
  const index = history.findIndex(
    (item) => item.sessionId === session.sessionId,
  );

  if (index >= 0) {
    history[index] = {
      ...history[index],
      endedAt: ended.endedAt,
    };
    writeJson(SESSION_HISTORY_KEY, history);
  }

  return ended;
}

export function formatSessionTimestamp(value) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}
