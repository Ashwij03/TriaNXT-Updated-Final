// CTMS governance evaluation accounts — the canonical demo directory.
// Consumed by seedDemoDirectoryUsers() in adminService.ts: missing accounts
// are appended to the local "users" store, existing ones are kept in sync
// (password / role / approval). Roles match the frontend's canonical role
// strings (Login.tsx / roleService.ts): Admin, SiteStaff, PI, CRO, Sponsor.
export const DEMO_USER_PASSWORD = "TriaNXT@2026";

export interface DemoUser {
  email: string;
  name: string;
  username: string;
  role: "Admin" | "SiteStaff" | "PI" | "CRO" | "Sponsor";
}

export const DEMO_USERS: DemoUser[] = [
  {
    email: "admin@demo.com",
    name: "Demo Admin",
    username: "admin.demo",
    role: "Admin",
  },
  {
    email: "staff1@demo.com",
    name: "Demo Site Staff",
    username: "staff1.demo",
    role: "SiteStaff",
  },
  {
    email: "pi@demo.com",
    name: "Demo PI",
    username: "pi.demo",
    role: "PI",
  },
  {
    email: "cro@demo.com",
    name: "Demo CRO",
    username: "cro.demo",
    role: "CRO",
  },
  {
    email: "sponsor@demo.com",
    name: "Demo Sponsor",
    username: "sponsor.demo",
    role: "Sponsor",
  },
];