# RUNBOOK: run, deploy, operate, fix

## Environment variables
| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | prod | SQLite `backend/pragati.db` | Supabase **Session pooler** URI (port 5432). `postgres://` is auto-rewritten to psycopg3 |
| `JWT_SECRET` | prod | random per process | Signs login tokens; without it every restart logs everyone out |
| `GROQ_API_KEY` / `OPENROUTER_API_KEY` / `GEMINI_API_KEY` | any one | none | Enables the AI Copilot and briefs; without them, template fallbacks are used |
| `AI_PROVIDER_PRIORITY` | no | `groq,openrouter,gemini` | Fallback order |
| `GROQ_MODEL` / `OPENROUTER_MODEL` / `GEMINI_MODEL` | no | `openai/gpt-oss-120b` / `nvidia/nemotron-3-super-120b-a12b:free` / `gemini-3.8-flash` | Override when a free model is retired |
| `DEMO_PASSWORD` | no | `Prajna@2026` | Demo login password (the login page's one-click buttons assume the default) |
| `PORT` | Docker | 8000 | Uvicorn port in the container |

Local: put them in `.env` at the repo root (git-ignored; template `.env.example`). Prod: Render → service → Environment.

## Local development
```bash
python -m venv .venv && .venv/Scripts/pip install -r backend/requirements.txt
cd frontend && npm install && npm run build && cd ..
DATABASE_URL=sqlite:///backend/pragati.db .venv/Scripts/python -m uvicorn app.main:app --app-dir backend --port 8000
```
- The first start loads `data/raw/*.csv` → runs the pipeline → scores (~5 s on SQLite).
- The backend does **not** hot-reload in this command. Restart after Python changes, and rebuild the UI after frontend changes.
- Frontend live-dev alternative: `cd frontend && npm run dev` (Vite proxies `/api` to `:8000`).

## Deploy (Render + Supabase)
1. Supabase: create a project → Connect → **Session pooler** URI → that's `DATABASE_URL`.
2. Render: New → **Blueprint** → choose the repo (uses `render.yaml` + `Dockerfile`) → set `DATABASE_URL` and the AI keys → Apply.
3. The first boot creates and seeds the tables (~3 min over the network). Later boots re-score only if `PIPELINE_VERSION` changed.
4. Verify:
   ```bash
   curl https://<app>/api/v1/health      # {"status":"ok","ai_providers":[...]}
   ```
   Then sign in with the one-click Admin card.
5. Keep-alive: GitHub repo → Settings → Actions → Variables → `APP_URL=https://<app>`; Actions → keep-alive → Run once. Backup: cron-job.org pinging `/api/v1/health` every 10 min.

Render's free plan sleeps after 15 minutes idle, so the first hit takes ~30–50 s. The keep-alive prevents this.

## Routine operations
| Task | How |
|---|---|
| Ship a change | Test → build → commit → push to `main`. Render redeploys (~5–8 min, zero downtime: the old instance serves until the new one is healthy) |
| Force a re-score in prod | Bump `store.PIPELINE_VERSION` and push, or (admin) change weights on the Methodology page |
| Upload new source data | Admin → Data Integration → choose source → CSV. The schema must match `raw_<source>` columns; it rolls back on failure |
| Reset demo interventions (local) | `python -c "import sqlite3;c=sqlite3.connect('backend/pragati.db');c.execute('delete from app_interventions');c.commit()"` |
| Reset all prod data | Drop `raw_*`, `an_*`, `app_*` tables in Supabase → redeploy (the first boot reseeds) |
| Rotate an AI key | Change it in Render env → Save (redeploys) and in local `.env`. Never commit keys |
| Swap a retired AI model | List models: `python -c "from app import ai;[print(n,[m.id for m in c.models.list()][:20]) for n,c,_ in ai.providers()]"` (from `backend/`), then set `*_MODEL` |
| Sync the two repos | On `Natural-navya/Prajna`: GitHub → **Sync fork**. Or `git remote add upstream <other repo>` → `git pull upstream main` → push |

## Troubleshooting
| Symptom | Check / fix |
|---|---|
| `/api/v1/health` times out | Render sleeping (wait 60 s) or a failed deploy (Render → Logs). Look for a Python traceback at boot |
| Health OK but pages 401 after a restart | `JWT_SECRET` not set, so the token was signed by an older process. Set it; users log in again |
| Copilot: "All AI providers failed" | Retired model or rate limit; see "Swap a retired AI model". `ai_providers` in health shows which keys loaded |
| Wrong numbers on live vs local | Different data versions; check `app_pipeline_runs` (latest `summary.version`) on both |
| Boot very slow on Supabase | Normal on first seed (~3 min). Otherwise check that `store.table` uses plain `SELECT` |
| Local server shows live data | `.env` `DATABASE_URL` points at Supabase; override it to SQLite for local work |
| Build fails on Render at `npm ci` | `frontend/package-lock.json` must be committed and in sync with `package.json` |
