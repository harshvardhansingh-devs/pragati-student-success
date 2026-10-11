# AI HANDOFF: how to continue building Prajna

> For any AI coding agent (Claude Code, Codex, Cursor, Copilot, Gemini…) or a new developer taking over.
> Follow this and you can change the agent mid-project without losing context.

## 0. Read in this order (about 10 minutes)
1. `handbook/CONTEXT.md`: what, why, where, current state.
2. **This file**: how to work, rules that must not break, recipes.
3. `handbook/DECISIONS.md`: why things are the way they are. Don't undo a decision without reading it.
4. `handbook/ROADMAP.md`: what's open and its priority.
5. Then, as the task needs: `ARCHITECTURE.md`, `API.md`, `DATA_MODEL.md`, `SUCCESS_SCORE.md`, `RUNBOOK.md`.

## 1. Repo map (what lives where)
```
backend/app/
  __init__.py   loads .env BEFORE any module reads env vars (keep it first)
  db.py         SQLAlchemy engine from DATABASE_URL (SQLite default; postgres:// rewritten to psycopg3); app_* tables DDL
  pipeline.py   raw_* tables → clean → integrate → weekly features. Key funcs: norm_id, to_num, resolve, run()
  scoring.py    INDICATORS (23: domain, lo, hi, direction, label), DEFAULT_WEIGHTS, BANDS, RISK_FEATURES, HIGH/MEDIUM,
                SEGMENTS (relative z-profiles + playbooks), RiskModel (LR, 5-fold CV metrics, exact contributions),
                score_all(), explain_score(), simulate(), insights(), fairness()
  store.py      run_pipeline() persists an_* tables; bootstrap() seeds/re-scores on boot (PIPELINE_VERSION);
                state() per-process cache refreshed when a newer run exists
  auth.py       USERS (5 demo roles, scope dict), JWT, login() with @pragati.demo aliases, staff_only, require_admin, scope()
  ai.py         PROVIDERS (Groq/OpenRouter/Gemini via the openai SDK), copilot() tool loop (search_students, group_summary),
                brief(audience="mentor"|"student"), template fallbacks
  main.py       all /api/v1 routes + SPA serving; apply_filters(); recommendations(); clean() for JSON-safety
backend/scripts/generate_data.py   synthetic messy CSVs → data/raw (seed 42, latent traits, shocks)
backend/tests/test_pipeline.py     the end-to-end test (run it after every change)
frontend/src/
  App.tsx       routes, role-aware nav (NAV vs STUDENT_NAV), Layout, GlobalSearch, theme toggle
  api.ts        fetch wrapper (JWT in localStorage 'prajna.session'), User type with roles
  ui.tsx        UI kit: Card, Kpi, badges, ScoreRing, Avatar, Sparkline, Logo/Wordmark/Loading, Skeleton, Empty, toast, RichText
  charts.tsx    ECharts wrappers that read CSS tokens (LineChart, StackedBar, Heatmap, Radar, Diverging)
  index.css     design tokens (light/dark), hero gradient, loader + mobile CSS
  pages/        Overview, Students (also At-Risk tabs), Student360 (also the student "My Progress" via selfId),
                Segments, Interventions, Copilot, DataHub, Methodology, Login, AssignPanel
data/raw/       8 source CSVs + outcome_labels.csv (inputs; committed)
tools/media/    demo video, promo video and pitch deck generators (see its README)
handbook/       all docs
```

## 2. Commands
```bash
# setup (once)
python -m venv .venv && .venv/Scripts/pip install -r backend/requirements.txt     # macOS/Linux: .venv/bin/...
cd frontend && npm install && cd ..

# build the UI (FastAPI serves frontend/dist; rebuild after ANY frontend change)
cd frontend && npm run build && cd ..

# run locally on SQLite (never point local dev at the live DB while experimenting)
DATABASE_URL=sqlite:///backend/pragati.db .venv/Scripts/python -m uvicorn app.main:app --app-dir backend --port 8000
# open http://localhost:8000 · API docs at /api/docs

# test (must print "ok")
.venv/Scripts/python backend/tests/test_pipeline.py

# type-check the frontend
cd frontend && npx tsc -b
```
Deploy = push to `main`; Render rebuilds the Docker image (~5–8 min). Verify with `curl https://<app>/api/v1/health`.

## 3. Invariants: never break these
1. **Role scoping is server-side.** Every data endpoint goes through `scope(df, user)`. Institution-wide views and **all write endpoints** use `Depends(staff_only)`; admin-only actions use `require_admin`. Hiding something in the UI is not security.
2. **Protected attributes** (`gender`, `admission_category`, `home_state`) are never model, score or segmentation inputs. They're used only in `fairness()`.
3. **The LLM never receives names, emails or protected attributes.** Only IDs and numbers (see `ai.COLS`, `brief` `keep`).
4. **Bump `store.PIPELINE_VERSION`** whenever scoring, pipeline or segmentation logic changes. Deployed instances only re-score on boot when the version changes.
5. **Explainability:** no score or flag without its drivers. If you add a risk input, it must flow into the drivers.
6. **Never commit `.env`** or secrets. Keys live in `.env` (local) and Render env vars (prod).
7. **UI labels keep the brief's wording** ("Student Success Score", "At-Risk: Academic/Placement", "Key trends", "Segments"), so the automated evaluator can find each requirement.
8. **The test must pass** before you commit. Add an assertion for any bug you fix.
9. **Commit authorship:** commit as the repo owner's git identity. **Don't add AI co-author or attribution trailers** (owner's explicit preference).

## 4. Gotchas (each one cost time already)
| Symptom | Cause | Fix / rule |
|---|---|---|
| Stray "0" next to badges | SQLite returns booleans as 0/1, and React renders `0 && …` as "0" | `store._load` casts `sliding`/`low_confidence` to bool. Cast any new boolean columns there too |
| Segment filter returns nothing | Segment names contain commas, and the list filters split on commas | Segment uses exact match in `apply_filters`; never `split(',')` a segment |
| Copilot falls back to the template, or "all providers failed" | Free LLM models get **retired** | List models (`client.models.list()`), set `GROQ_MODEL` / `OPENROUTER_MODEL` / `GEMINI_MODEL` env vars |
| Gemini 400 "missing thought_signature" | Gemini needs its tool-call message echoed back unchanged | Keep `messages.append(msg.model_dump(exclude_none=True))` in `_copilot_once` |
| Raw `**bold**` in AI text | LLM markdown | Render AI text through `<RichText>` |
| First request after deploy is slow | Cache cold; Render free tier sleeps after 15 min | Cache warms in lifespan; keep-alive ping; prefer cron-job.org as backup |
| Every restart logs you out | `JWT_SECRET` missing (random per process) | Set `JWT_SECRET` in `.env` and on Render |
| Local server logs in but shows live data | `.env` has the Supabase `DATABASE_URL` | Override with `DATABASE_URL=sqlite:///…` for local work |
| `read_sql_table` slow on Supabase | Reflection round-trips (Render is in the US, DB in Mumbai) | Use `pd.read_sql(text('SELECT * FROM "t"'))` (see `store.table`) |
| AUC changes between DBs | Row order changed the CV split | `RiskModel` sorts by `student_id` first |
| Wide tables overflow on laptops | min-width tables | Card lists below `xl` (1280 px); hide secondary columns below `2xl` |
| iPhone zooms into inputs | Font smaller than 16 px | Global mobile CSS forces 16 px; keep it |
| Python 3.14: `psycopg[binary]` won't resolve | No wheel for 3.14 | Requirements marker `python_version < "3.14"`; Docker uses 3.12 |

## 5. Recipes
**Add an indicator:** generate or derive it in `pipeline.run()` (static or weekly) → add it to `scoring.INDICATORS` (domain, lo, hi, direction, label) → optionally to `RISK_FEATURES` → `main.SOURCE_OF` (Student 360 grouping) → bump `PIPELINE_VERSION` → run the test → update `SUCCESS_SCORE.md` and the indicator count in the docs.

**Add an API endpoint:** in `main.py` use `user=Depends(current_user | staff_only | require_admin)`, pass data through `scores(user)` so scoping applies, and return via `clean(...)` → document it in `API.md` → add a test assertion.

**Add a page:** `frontend/src/pages/X.tsx` using the `ui.tsx` kit → route in `App.tsx` (staff `Routes` block) → nav item in `NAV` → mobile check at 360 / 768 / 1280 px (cards below `xl` if tabular) → `npm run build`.

**Add a role:** `auth.USERS` (role, title, scope) → decide which endpoints it may call (`staff_only`?) → `api.ts` `User.role` union → `App.tsx` nav and routes → `Login.tsx` `DEMO` card → test assertions → `CONTEXT.md` roles table.

**Change weights or thresholds:** `scoring.DEFAULT_WEIGHTS` / `HIGH` / `MEDIUM` / `rules()` → bump `PIPELINE_VERSION` → update `SUCCESS_SCORE.md`, deck and docs numbers.

**Switch AI model or provider:** env vars `GROQ_MODEL`, `OPENROUTER_MODEL`, `GEMINI_MODEL`, `AI_PROVIDER_PRIORITY`. A new OpenAI-compatible provider is one row in `ai.PROVIDERS`.

**Regenerate data:** `python backend/scripts/generate_data.py`, then for local delete `backend/pragati.db`; for prod drop the `raw_*`, `an_*` and `app_pipeline_runs` tables in Supabase and redeploy. ⚠️ This changes every number in the docs, slides and videos.

## 6. Definition of done (for every change)
- [ ] `backend/tests/test_pipeline.py` prints `ok`; the new behaviour has an assertion.
- [ ] `npx tsc -b` is clean and `npm run build` succeeds.
- [ ] Checked in the browser (desktop and a 360 px phone width) for UI changes.
- [ ] `PIPELINE_VERSION` bumped if scoring or pipeline logic changed.
- [ ] Docs updated (`CHANGELOG.md`, plus any affected numbers or docs); no stale claims.
- [ ] Committed without secrets or AI co-author trailers; pushed; live `/api/v1/health` OK after deploy.

## 7. Kick-off prompt for a new agent
> You are continuing work on **Prajna**, a FastAPI + React student-analytics app. Read `handbook/CONTEXT.md`, `handbook/AI_HANDOFF.md`, `handbook/DECISIONS.md` and `handbook/ROADMAP.md` before changing anything. Follow the invariants in AI_HANDOFF §3 and the definition of done in §6. Work locally on SQLite, run `backend/tests/test_pipeline.py` after each change, and update `handbook/CHANGELOG.md`. Task: <describe the task>.
