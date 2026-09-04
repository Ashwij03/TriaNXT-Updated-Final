import { readStorage } from "../utils/storageHelpers";
import ROLES from "../constants/roles";
import { getEffectiveRole } from "./roleService";

const STORAGE_KEYS = {
  [ROLES.ADMIN]: "adminLiveChatData",
  [ROLES.SITE_STAFF]: "siteStaffLiveChatData",
  [ROLES.CRO]: "croLiveChatData",
  [ROLES.SPONSOR]: "sponsorLiveChatData",
  [ROLES.PI]: "piLiveChatData",
};

const DEFAULT_CONVERSATIONS = [
  {
    id: 1,
    name: "Site Coordinator",
    unread: 2,
    messages: [
      { sender: "them", text: "Need help with Subject 101", time: "10:24 AM" },
      { sender: "me", text: "Sure, what is the issue?", time: "10:25 AM" },
    ],
  },
  {
    id: 2,
    name: "Clinical Monitor",
    unread: 1,
    messages: [{ sender: "them", text: "Visit completed successfully", time: "11:00 AM" }],
  },
  {
    id: 3,
    name: "Data Manager",
    unread: 0,
    messages: [{ sender: "them", text: "Database lock scheduled", time: "9:15 AM" }],
  },
];

function writeStorage(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
  return data;
}

export function getLiveChatStorageKey(role = getEffectiveRole()) {
  return STORAGE_KEYS[role] || STORAGE_KEYS[ROLES.ADMIN];
}

export function getRoleLiveChatData(role = getEffectiveRole()) {
  const data = readStorage(getLiveChatStorageKey(role), {
    conversations: DEFAULT_CONVERSATIONS,
  });

  return data?.conversations?.length
    ? data
    : { conversations: DEFAULT_CONVERSATIONS };
}

export function saveRoleLiveChatData(data, role = getEffectiveRole()) {
  return writeStorage(getLiveChatStorageKey(role), data);
}
