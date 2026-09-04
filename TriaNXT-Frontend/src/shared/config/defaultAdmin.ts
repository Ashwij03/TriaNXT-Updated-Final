// Task 7 — Registration Changes: default Admin account configuration.
//
// Admin is no longer a selectable role on the Registration page, so the
// application must always have exactly one Admin account available to
// log in with. This file defines that account's credentials. Every value
// can be overridden at build time via a CRA environment variable (e.g. in
// a .env / .env.production file) without touching any code:
//
//   VITE_DEFAULT_ADMIN_EMAIL=admin@yourcompany.com
//   VITE_DEFAULT_ADMIN_PASSWORD=YourStrongPassword1!
//   VITE_DEFAULT_ADMIN_NAME=System Administrator
//   VITE_DEFAULT_ADMIN_USERNAME=sysadmin01
//
// If a variable isn't set, the fallback below is used instead so the app
// always has a working default admin out of the box.
export const DEFAULT_ADMIN_CONFIG = {
  email: import.meta.env.VITE_DEFAULT_ADMIN_EMAIL || "admin1@trianxt.com",
  password: import.meta.env.VITE_DEFAULT_ADMIN_PASSWORD || "Admin@123",
  name: import.meta.env.VITE_DEFAULT_ADMIN_NAME || "System Administrator",
  username: import.meta.env.VITE_DEFAULT_ADMIN_USERNAME || "sysadmin01",
};