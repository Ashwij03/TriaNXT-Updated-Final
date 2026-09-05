# TriaNXT-Updated-Final — Local Setup & Run Guide

Everything needed to install, seed, and run this project locally (FastAPI
backend + React/Vite frontend), including every package/installation required,
how the two sides talk to each other, and the demo accounts + preloaded data.

> Written against the current tree: React 19 + TypeScript + **Vite** frontend
> (`TriaNXT-Frontend/`) and **FastAPI + SQLAlchemy** backend
> (`TriaNxtEngine-Backend/`). The frontend `README.md` is stale Create-React-App
> boilerplate — this file is the source of truth for running the app.

---

## 1. Repository layout

```
TriaNXT-Updated-Final/
├── SETUP.md                        <- this file
├── TriaNXT-Frontend/               React 19 + Vite + TypeScript SPA (API-mode)
│   ├── package.json                scripts: dev / build / test / typecheck
│   ├── vite.config.ts              dev server on port 3000
│   └── src/
│       ├── main.tsx, App.tsx       app boot + route table (/safety, /monitoring-access, /ai-review, ...)
│       ├── shared/services/        localStorage data layer + API-mode services
│       └── shared/auth, config, pages, components, hooks, utils
└── TriaNxtEngine-Backend/          FastAPI + SQLAlchemy + Alembic
    ├── db.sqlite3                  local SQLite dev DB (created on first run — git-ignored)
    ├── .env.example                copy to .env for overrides (optional in dev)
    ├── tria_engine/
    │   ├── main.py                 FastAPI app entry point (uvicorn target: tria_engine.main:app)
    │   ├── apps/
    │   │   ├── accounts/           users, login/session, RBAC (rbac.py, router.py)
    │   │   ├── ctms/               routers: subjects, visits, safety, monitoring, ai_review, sync
    │   │   ├── organizations/      Organization + Role models
    │   │   └── health/             /api/health endpoints
    │   ├── alembic/                migrations (baseline covers accounts/organizations/etc.)
    │   ├── core/                   config.py (env/settings), database.py (engine/Session),
    │   │                           security.py, schema_ensure.py (additive column repair)
    │   ├── requirements/           base.txt + dev.txt  (dev = base + pytest + httpx)
    │   └── tests/                  pytest suite
    ├── _e2e_seed.py                demo-data setup/seed script (org 5 demo world)  ⭐ run this
    ├── _cro_live_check.py          live RBAC check for the CRO role (needs running backend)
    ├── Dockerfile / docker-compose.yml / gunicorn_config.py   (optional prod-ish run)
    └── alembic.ini
```

---

## 2. Prerequisites (install once)

| Tool            | Version        | Notes                                             |
|-----------------|----------------|---------------------------------------------------|
| Python          | 3.12           | Tested with 3.12; 3.11+ likely works              |
| Node.js         | 20 LTS or 22   | `vite@6` + `typescript@5.8` toolchain             |
| npm             | 9+             | Ships with Node                                   |
| Git Bash        | —              | Commands below are POSIX (work in Git Bash on Windows) |

Verify:

```bash
python --version     # 3.12.x
node --version       # v20.x or v22.x
npm --version        # 9.x
```

No Docker is required for local dev (SQLite is used automatically); Docker +
Postgres is only for the optional containerized run (see §8).

---

## 3. Backend — install, database bootstrap, seed

All backend commands run from the **backend root** (`TriaNxtEngine-Backend/`).

### 3a. Create the virtual environment and install packages

```bash
cd TriaNxtEngine-Backend

# create the venv (one-time)
python -m venv .venv

# activate it (every new terminal)
#   Windows (Git Bash / PowerShell):   source .venv/Scripts/activate
#   macOS / Linux:                     source .venv/bin/activate

# install everything needed to run AND test
pip install -r tria_engine/requirements/dev.txt
```

`dev.txt` pulls in `base.txt` (fastapi, uvicorn[standard], pydantic(-settings),
sqlalchemy, alembic, python-multipart, psycopg2-binary, python-dotenv,
argon2-cffi, cryptography, pillow, boto3, redis) plus `pytest` and `httpx` for
the test suite.

### 3b. Environment file (optional in development)

```bash
cp .env.example .env
```

Every key is optional in development — sensible dev defaults exist in
`tria_engine/core/config.py`. The only ones you are likely to change:

```dotenv
# Development falls back to SQLite at <backend-root>/db.sqlite3 when
# DATABASE_URL is unset — that is what we want locally.
# DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/ctms

# Frontend origins allowed to call the API with credentials.
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 3c. Bootstrap the database (fresh checkout only)

The SQLite file is **git-ignored**, so a fresh clone has no DB. Two additive
steps create the full schema:

```bash
# 1) Alembic baseline migration (accounts, organizations, auth, etc.)
alembic upgrade head

# 2) Create the ctms_* module tables (safety, monitoring, subject/visit
#    mirrors, gap modules). The alembic baseline predates these routers, so
#    they are registered from the ORM metadata instead. Idempotent/additive:
#    on an already-migrated DB this creates only the missing tables.
python - <<'PY'
from tria_engine.core.database import Base, engine
import tria_engine.apps.accounts.models
import tria_engine.apps.organizations.models
import tria_engine.apps.ctms.models
import tria_engine.apps.eisf.models   # eISF documents + Part 11 signatures
Base.metadata.create_all(engine)
print("ctms + eisf tables ensured")
PY
```

(If `db.sqlite3` already exists in the folder — e.g. this working copy — both
steps are no-ops; skip straight to the seed.)

### 3d. Seed the demo environment (⭐ required for data-driven pages)

```bash
python _e2e_seed.py          # idempotent — safe to run any number of times
```

`_e2e_seed.py` provisions the whole **"Safety Demo Org" (organization 5)**
demo world and is the single setup entry point:

- **Users** with known passwords (also created in the backend `accounts_user`
  table so API login works):
  - Sponsor  → `sponsor.c787e7@demo.com` / `Sponsor@123`
  - Site Staff → `staff.9fb588@demo.com` / `SiteStaff@123`
  - CRO      → `cro.live@demo.com` / `CRO@1234`
- **3 AE/SAE cases** (Safety Center: `{total: 3, serious: 1, open: 2, reconciled: 1}`)
- **Monitoring-access requests** (pending + approved covering today)
- **6 subject mirror rows** spanning all six lifecycle statuses
  (Screened/Enrolled/Ongoing/Completed/Withdrawn/Dropout) for study
  `TNX-E2E-02`, plus **21 matching visit schedule rows**
  (Completed/Scheduled/Missed/Cancelled) so the aggregate endpoints below
  return real numbers.
- It converges rather than duplicates: on a DB already holding equivalent
  ad-hoc demo rows, totals stay stable.

### 3e. Run the backend

```bash
# from TriaNxtEngine-Backend, venv active
python -m uvicorn tria_engine.main:app --host 127.0.0.1 --port 8000
# dev niceties: --reload   docs: http://127.0.0.1:8000/docs
```

Verify:

```bash
curl -s http://127.0.0.1:8000/api/health
# {"status":"healthy","service":"trianxt-ctms-engine",...}
```

> **Why `127.0.0.1`, not `localhost`?** See §5 — the same rule applies to the
> frontend. Mixing `localhost` (frontend) with `127.0.0.1` (API) makes the
> session cookie cross-site and it is silently dropped on XHR → perpetual 401.

---

## 4. Frontend — install and run (API mode)

All frontend commands run from the **frontend root** (`TriaNXT-Frontend/`).

### 4a. Install packages

```bash
cd TriaNXT-Frontend
npm install        # (or: npm ci when package-lock.json is present)
```

### 4b. Start the dev server against the backend (API mode)

API mode is enabled simply by setting `VITE_API_URL` — the frontend data layer
(`src/shared/services/api/client.ts`) checks it and routes reads/writes to the
FastAPI mirror instead of localStorage alone.

```bash
# PowerShell:
$env:VITE_API_URL="http://127.0.0.1:8000"; npm run dev
# Git Bash / macOS / Linux:
VITE_API_URL=http://127.0.0.1:8000 npm run dev
```

- The app opens at **http://127.0.0.1:3000** (Vite is configured for port 3000,
  matching the backend CORS allow-list).
- **Do not open `http://localhost:3000`.** The frontend and the API must share
  the same host name (`127.0.0.1`) so the backend's `SameSite` session cookie
  is accepted on cross-origin XHR. `localhost` → `127.0.0.1` is treated as
  cross-site by the browser and the session silently never attaches (you will
  see 401s on every API call).
- If you must use another port/host, restart the backend with the matching
  `CORS_ALLOWED_ORIGINS` (see §7).

Frontend scripts (`npm run ...` in `TriaNXT-Frontend/`):

| Script       | What it does                                   |
|--------------|------------------------------------------------|
| `dev`        | Vite dev server (port 3000)                    |
| `typecheck`  | `tsc --noEmit` (types only)                    |
| `test`       | `vitest run` (jsdom)                           |
| `build`      | `tsc --noEmit && vite build` (outputs `dist/`) |
| `preview`    | serve the production build                     |

### 4c. Log in — the login directory (important detail)

The login form is **localStorage-driven**: it validates typed email/password
against records in `localStorage["users"]`. The app always guarantees one
**Admin** account exists (auto-seeded by `initializeAdminData()` on first
load):

- **Admin**: `admin1@trianxt.com` / `Admin@123`

To sign in as the Sponsor / Site Staff / CRO demo roles (credentials match the
backend seed from §3d), the directory must also contain them. Two options:

**Option A — via the UI:** log in as Admin, open **User Management**, and add
the three users with the emails/passwords from §3d.

**Option B — paste this into the browser console once (fastest):**

```js
const demoUsers = [
  { email: "sponsor.c787e7@demo.com", password: "Sponsor@123",   name: "Sponsor Demo",  username: "sponsor.c787e7", role: "Sponsor",   organization: "Safety Demo Org", orgType: "Sponsor" },
  { email: "staff.9fb588@demo.com",   password: "SiteStaff@123", name: "Site Staff Demo", username: "staff.9fb588",  role: "SiteStaff", organization: "Safety Demo Org", orgType: "Site" },
  { email: "cro.live@demo.com",       password: "CRO@1234",      name: "CRO Demo",      username: "cro.live",       role: "CRO",       organization: "Safety Demo Org", orgType: "CRO" }
];
const users = JSON.parse(localStorage.getItem("users") || "[]");
demoUsers.forEach((u) => {
  if (!users.some((x) => x.email === u.email)) {
    users.push({ id: Date.now() + Math.random(), approvalStatus: "Approved",
                 accountStatus: "Active", permissions: [], assignedSite: "",
                 ...u });
  }
});
localStorage.setItem("users", JSON.stringify(users));
location.reload();
```

Notes:
- The directory role token for Site Staff is **`SiteStaff`** (one word) —
  that is what the login flow matches. The backend DB role name is
  `"Site Staff"`; server-side authorization comes from the backend
  `accounts_user` record, not the directory.
- In API mode, login also POSTs to `/api/accounts/login/` to open a backend
  session; the **backend account password is authoritative** there, so the
  directory password must match the seed password above.

---

## 5. Run order (TL;DR)

```bash
# Terminal 1 — backend (TriaNxtEngine-Backend, venv active)
python _e2e_seed.py                                  # first time / after DB reset
python -m uvicorn tria_engine.main:app --host 127.0.0.1 --port 8000

# Terminal 2 — frontend (TriaNXT-Frontend)
VITE_API_URL=http://127.0.0.1:8000 npm run dev       # open http://127.0.0.1:3000
```

Then log in as any demo account from §4c. Safety Center, Monitoring Access
and AI Review render from the live API; the study workspace + subject/visit
dashboard hydrate their local stores from the subject/visit mirrors when those
stores are empty.

---

## 6. Verify the seeded data over the API

```bash
# Login keeps a session cookie for the following calls (Git Bash example):
JAR=/tmp/trix.jar
curl -s -c "$JAR" -X POST http://127.0.0.1:8000/api/accounts/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"sponsor.c787e7@demo.com","password":"Sponsor@123"}'

# Safety Center KPIs -> {total: 3, serious: 1, open: 2, reconciled: 1}
curl -s -b "$JAR" http://127.0.0.1:8000/safety/ae-cases/summary/

# Monitoring Access rows (list + per-site access-check)
curl -s -b "$JAR" http://127.0.0.1:8000/monitoring/requests/
curl -s -b "$JAR" "http://127.0.0.1:8000/monitoring/access-check/?site=3"

# Subject mirror totals -> {total: 7, byStatus: {Screened:1, Enrolled:2,
#   Ongoing:1, Completed:1, Withdrawn:1, Dropout:1}, enrolled: 4}
curl -s -b "$JAR" "http://127.0.0.1:8000/api/site/subjects/summary/?studyId=TNX-E2E-02"

# Visit schedule totals -> {total: 21, scheduled: 5, completed: 14, upcoming: 5}
curl -s -b "$JAR" "http://127.0.0.1:8000/api/site/visits/summary/?studyId=TNX-E2E-02"
```

OpenAPI docs (interactive): http://127.0.0.1:8000/docs

---

## 7. Configuration reference (backend environment)

Backend settings live in `tria_engine/core/config.py` and `.env.example`.
Relevant for local runs:

| Variable                 | Default                                   | Purpose                                            |
|--------------------------|-------------------------------------------|----------------------------------------------------|
| `DATABASE_URL`           | *(unset → SQLite `<backend>/db.sqlite3`)* | DB URL; set for Postgres                           |
| `CORS_ALLOWED_ORIGINS`   | `http://localhost:3000,http://127.0.0.1:3000` | Frontend origins allowed (with credentials)   |
| `CORS_ALLOW_CREDENTIALS` | `true`                                    | Required for the session cookie                    |
| `SECRET_KEY`             | dev fallback                              | Session signing; required outside development      |
| `ALLOWED_HOSTS`          | `localhost,127.0.0.1`                     | Host allow-list                                    |
| `LOG_LEVEL`              | DEBUG in dev / INFO in prod               | Log verbosity                                      |
| `APP_ENV` / `DJANGO_ENV` | `development`                             | `development \| uat \| production`                 |

---

## 8. Tests & live checks

```bash
# Backend full suite (runs from TriaNxtEngine-Backend, venv active)
python -m pytest tria_engine/tests -q          # 89 tests, all green (verified)

# CRO RBAC live check — hits the RUNNING backend (:8000) as a real CRO user
# over HTTP and asserts Safety read-only + Monitoring request rights.
python _cro_live_check.py                      # expect "14/14 live checks passed"

# Frontend
cd ../TriaNXT-Frontend
npm run typecheck
npm test
npm run build
```

Coverage areas in `tria_engine/tests/`: `test_rbac.py` (role matrix),
`test_safety_monitoring_ai.py` (Safety + Monitoring + AI Review,
incl. CRO read-only/request-rights tests), `test_subject_visit_sync.py`
(sync + the `/summary` aggregate endpoints), `test_scope_filters.py`.

---

## 9. Other relevant files (what lives where)

**Backend entry/config**
- `tria_engine/main.py` — FastAPI app; router mounting + CORS; startup schema
  repair. Uvicorn target `tria_engine.main:app`.
- `tria_engine/core/config.py` / `.env.example` — settings + env reference.
- `tria_engine/core/database.py` — engine + `SessionLocal` (SQLite dev fallback).
- `tria_engine/core/schema_ensure.py` — additive column repair at startup
  (SQLite only; no-op elsewhere).
- `alembic.ini` + `tria_engine/alembic/` — migrations (baseline revision
  `70f65d974cc7` covers accounts/organizations; ctms tables come from ORM
  `create_all`, see §3c).

**Backend routers (API surface)**
- `apps/accounts/` — `router.py` (login/session), `rbac.py` (permission
  matrix), `models.py`, `services.py`.
- `apps/ctms/router_subjects.py` — `GET /api/site/subjects[/summary|/{code}]`.
- `apps/ctms/router_visits.py` — `GET /api/site/visits[/summary|/{code}]`.
- `apps/ctms/router_sync.py` — `POST /api/site/{subjects,visits,...}/sync`.
- `apps/ctms/router_safety.py` — `/safety/ae-cases*` (list/summary/reconcile).
- `apps/ctms/router_monitoring.py` — `/monitoring/requests*` +
  `/monitoring/access-check/` + `/api/site/organizations`.
- `apps/ctms/router_ai.py` — AI Review surfaces (`/ai-review/...`).

**Scripts & tooling**
- `_e2e_seed.py` — demo setup/seed (§3d). *This is the "setup file" for the
  demo environment* — idempotent, converges on pre-seeded DBs.
- `_cro_live_check.py` — live RBAC check for the CRO role (§8).
- `tria_engine/tools/rbac_wiring.py` — RBAC matrix wiring helper.
- `Dockerfile`, `docker-compose.yml` (Postgres + engine), `gunicorn_config.py`
  — optional containerized/prod-style run (`docker compose up --build -d`;
  engine container runs `alembic upgrade head` on start).
- `db.sqlite3`, `_e2e_*.log`, `_live_backend*.log`, `logs/` — local runtime
  artifacts (git-ignored), safe to delete when you want a clean slate.

**Frontend (where to look)**
- `src/shared/services/api/client.ts` — API base from `VITE_API_URL`,
  `credentials: "include"` (cookie session), `isApiEnabled()` gate.
- `src/shared/services/backendSession.ts` — backend login/check-session.
- `src/shared/services/{subjectService,visitScheduleService,roleService,
  adminService,studyService}.ts` — localStorage stores + API write-through.
- `src/shared/auth/Login.tsx` — login form (validates against
  `localStorage["users"]`).
- `src/App.tsx` — route table.
- `src/shared/pages/safety|monitoring|aiReview/` — the API-driven pages.
- `src/test/setup.ts` — vitest setup (jsdom, testing-library).

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Every API call returns 401 in API mode | Browser URL or `VITE_API_URL` uses `localhost` while the other side uses `127.0.0.1` — the session cookie is dropped (cross-site). Use `127.0.0.1` for **both** (see §4b). |
| CORS error in console | Backend `CORS_ALLOWED_ORIGINS` does not include the frontend origin. Add it (e.g. `http://localhost:5173`) and restart the backend. |
| `no such table: ctms_subject` / `ctms_visit` / `ctms_safetyaecase` | The ctms tables were never created. Run the `create_all` snippet from §3c (and `alembic upgrade head` first if accounts tables are also missing). |
| Login says "Invalid email or password" | The account is not in `localStorage["users"]` (or password differs). Seed via §4c; remember directory role tokens are `Sponsor` / `CRO` / `SiteStaff` / `Admin`. |
| Seed aborts with FK/metadata errors | Run `alembic upgrade head` + the §3c `create_all` snippet before `_e2e_seed.py`. |
| Port 8000/3000 already in use | `netstat -ano | grep LISTENING` to find the PID, or run the backend/frontend on a different port (and align CORS for the frontend). |
| Logs go quiet / API writes don't appear in the DB | Confirm the backend you hit is the one whose `db.sqlite3` you seeded (run `python _e2e_seed.py` again — it is idempotent) and that `VITE_API_URL` points at it. |
