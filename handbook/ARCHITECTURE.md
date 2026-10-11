# Architecture

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React 19 + TypeScript (Vite)**, Tailwind CSS v4, React Router | Fast build; a static SPA served by the API, so it ships as one deployable. Responsive: card layouts below 1280px, tables above; 16px inputs and 40px tap targets on phones |
| Charts | **Apache ECharts** (SVG renderer) | Line, stacked bar, heatmap, radar and diverging charts with tooltips; light and dark themes |
| API | **FastAPI (Python)** + Pydantic | Same language as the ML; typed validation; OpenAPI docs at `/api/docs` |
| Database | **PostgreSQL** (Supabase in production) · SQLite for local dev | One `DATABASE_URL` switch; SQLAlchemy keeps the code DB-agnostic |
| Data / ML | pandas, scikit-learn (logistic regression, K-Means), SciPy (Hungarian matching) | Industry-standard and interpretable. See [ML_APPROACH.md](ML_APPROACH.md) |
| AI | **Groq (gpt-oss-120b) → OpenRouter (Nemotron 3 Super) → Gemini (3.8 Flash)** free tiers via their OpenAI-compatible APIs (`openai` SDK), automatic fallback on rate limit or outage | Copilot (natural language → analytics tools) and mentor briefs; zero AI cost |
| Auth | JWT (PyJWT), PBKDF2 password hashing, role-based scoping | Admin / HoD / Mentor / Placement Officer / Student |
| Deploy | Docker (multi-stage: Node build → Python runtime) on Render; Supabase Postgres | One container, stateless, horizontally scalable |

## 2. System diagram

```
 ┌──────────────────────────── Sources (CSV exports / future connectors) ────────────────────────────┐
 │ ERP students · Academic/exams · Attendance · LMS · Clubs/events · Placement cell · Skills · Feedback │
 └──────────────┬───────────────────────────────────────────────────────────────────────────────────┘
                ▼  POST /ingest/upload (admin) or seed on first boot
 ┌──────────────────────── raw_* tables (append-as-uploaded, never edited) ─────────────────────────┐
                ▼  app/pipeline.py
   Validate types & ranges → quarantine · Normalise IDs (ID variants / roll no / email) · De-duplicate
   → Integrate into one Student 360 row · Weekly snapshots (weeks 4–12, rolling 4-week windows)
                ▼  app/scoring.py
   Success Score (weights, versioned) · Risk models ×2 (retrained each run) + rules · Drivers
   · K-Means segments · Insight generator · Fairness · What-if
                ▼
 ┌──────── an_* analytics tables (recomputable) ────────┐   ┌──── app_* tables ─────────────────────┐
 │ an_scores · an_weekly_scores · an_data_quality · …   │   │ interventions · weight_configs ·       │
 └───────────────────────┬──────────────────────────────┘   │ pipeline_runs · audit_log              │
                         ▼  app/store.py (per-process cache, refreshed when a new run lands)        │
 ┌────────────────── FastAPI /api/v1 (JWT + role scoping) ──────────────────┐  ────► LLM (Gemini/Groq/OpenRouter)     │
 │ overview · students · simulate · brief · segments · interventions ·      │  (IDs + numbers only)  │
 │ data-quality · upload · weights · model · fairness · copilot             │                        │
 └──────────────────────────┬───────────────────────────────────────────────┘
                            ▼  same origin
 ┌──────────── React SPA (frontend/dist, served by FastAPI) ────────────┐
 │ Staff: Overview · At-Risk · Students · Student 360 · Segments ·      │
 │ Interventions · AI Copilot · Data Integration · Score Methodology    │
 │ Student: My Progress (own Student 360) · How my score works          │
 └──────────────────────────────────────────────────────────────────────┘
```

## 3. Data layers

| Prefix | Holds | Rule |
|---|---|---|
| `raw_` | Source files as uploaded (all columns as text) | Replaced only by an explicit upload; previous data restored if the pipeline fails |
| `an_` | Cleaned, integrated and scored analytics | Fully recomputable from `raw_` + weights |
| `app_` | Interventions, weight versions, pipeline runs, audit log | Transactional, never recomputed |

## 4. Scalability path

| Now | At scale (multi-campus, 100k+ students) |
|---|---|
| CSV upload | Connectors: Moodle REST, ERP DB via CDC, Google Forms |
| Pipeline runs inside the API request | Background worker (Celery/RQ) or scheduled job; incremental scoring |
| Per-process pandas cache (re-checked every 10 s) | Query `an_*` tables directly with indexes; partition by `institution_id` and week |
| One container | N stateless containers behind a load balancer; shared Postgres |
| Models retrained each run | Model registry, drift monitoring, champion/challenger |

## 5. Security & privacy
- JWT auth; server-side scoping: an HoD sees only their department, a mentor only their mentees, a student only themselves. Every endpoint, including the Copilot's tools, runs inside that scope.
- Students are further limited by a `staff_only` guard: institution-wide views (overview, lists, segments, data quality, Copilot) and all write actions return 403 for them.
- `app_audit_log` records student-profile views, uploads and weight changes.
- The LLM receives student IDs and numeric indicators only, never names, emails or protected attributes.
- Uploads: admin only, 20 MB cap, schema check, automatic rollback on failure.
- Aligned with India's **DPDP Act 2023** principles (purpose limitation, minimisation, access logging).

## 6. Repository layout

```
backend/
  app/main.py        FastAPI app + routes, serves the built SPA
  app/pipeline.py    ingest, validate, clean, integrate, weekly features
  app/scoring.py     score, risk models, explanations, segments, insights, what-if, fairness
  app/store.py       pipeline runs, persistence, cache
  app/ai.py          LLM Copilot (tool use, multi-provider fallback) + mentor briefs
  app/auth.py        demo users, JWT, role scoping
  app/db.py          engine (SQLite / Postgres / Supabase), app tables
  scripts/generate_data.py   synthetic messy dataset generator
  tests/test_pipeline.py     end-to-end check
frontend/src/        React pages, charts, UI kit
data/raw/            the 8 source CSVs + outcome labels
handbook/            all project docs (start at handbook/README.md)
tools/media/         scripts that regenerate the demo video, promo video and pitch deck
Dockerfile, render.yaml
```
