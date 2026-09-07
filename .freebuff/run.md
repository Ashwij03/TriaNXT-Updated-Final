# TriaNXT — local run doc (dev servers)

FastAPI backend (`TriaNxtEngine-Backend/`) + React/Vite frontend
(`TriaNXT-Frontend/`). See `SETUP.md` at the repo root for full detail;
this file records the exact reproduction + run procedure used by dev tooling.

## How to reproduce uncommitted artifacts

The frontend needs **no env file** for local dev: there is no `.env*` in
`TriaNXT-Frontend/`. API calls work through the Vite `/api` proxy defined in
`TriaNXT-Frontend/vite.config.ts` (target `http://127.0.0.1:8000`), so a plain
`npm run dev` is enough. Optionally, for direct (non-proxied) API mode, export
`VITE_API_URL=http://127.0.0.1:8000` before starting Vite.

The backend reads optional overrides from `TriaNxtEngine-Backend/.env`
(copy from `.env.example` if you need custom `CORS_ALLOWED_ORIGINS` /
`DATABASE_URL`); sensible dev defaults exist without it, and the committed
`db.sqlite3`-adjacent artifacts (`logs/`, `*.log`, `.pytest_cache/`) are
git-ignored runtime files — regenerate or ignore, do not commit.

Frontend dependencies:

```bash
cd TriaNXT-Frontend
npm install        # or: npm ci (package-lock.json present)
```

## How to run the servers

Backend (terminal 1, from `TriaNxtEngine-Backend/`, venv active):

```bash
source .venv/Scripts/activate        # Windows Git Bash
python -m uvicorn tria_engine.main:app --host 127.0.0.1 --port 8000
# optional: python _e2e_seed.py  (idempotent demo-data seed)
```

Frontend (terminal 2, from `TriaNXT-Frontend/`):

```bash
npm run dev         # Vite dev server on port 3000 (host: true → 127.0.0.1:3000)
```

Open http://127.0.0.1:3000 — use **127.0.0.1**, not `localhost`, so the
FastAPI session cookie (SameSite=Lax) is accepted on API calls.

Demo login (localStorage directory, seeded automatically for Admin):

- Admin: `admin1@trianxt.com` / `Admin@123`
- Sponsor: `sponsor.c787e7@demo.com` / `Sponsor@123` (add to the directory
  via User Management or the console snippet in SETUP.md §4c)
- CRO: `cro.live@demo.com` / `CRO@1234` · Site Staff: `staff.9fb588@demo.com` / `SiteStaff@123`

Key routes: `/reports` (Report Center), `/reports/builder` (Custom Report
Builder), `/finance`, `/milestones`.
