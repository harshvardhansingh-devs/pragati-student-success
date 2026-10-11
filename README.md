<p align="center"><img src="frontend/public/favicon.svg" width="88" alt="Prajna logo"></p>

# Prajna: Student Success Intelligence Platform

> *Prajna* (प्रज्ञा) means wisdom and insight: the clarity to see which student needs help, and why.

AI-powered platform that brings scattered student data together into one Student 360 view, scores every student, predicts **academic** and **placement** risk, explains *why*, and turns each insight into a tracked intervention.

> **Integrate → Score → Predict → Explain → Act → Measure**

Built for the KPMG × byteXL **HacXlerate** problem statement: *AI-Powered Student Analytics and Success Platform*.

**Live demo:** https://pragati-9l3m.onrender.com  ·  **API docs:** https://pragati-9l3m.onrender.com/api/docs  ·  logins below

## Highlights
- **7-source data integration** with ID reconciliation, cleaning and a data-quality report
- **Student Success Score (0–100)** across 6 domains, banded and explainable ([methodology](docs/SUCCESS_SCORE.md))
- **Dual risk prediction** (academic + placement): hard rules + logistic-regression models retrained on every data load, with exact per-student drivers ([ML approach](docs/ML_APPROACH.md))
- **Sliding alerts** for students who are declining fast, even while their score still looks fine
- **Segmentation** into 6 named personas, each with an intervention playbook
- **What-if simulator**, **intervention tracker** (single, bulk or whole segment), auto-generated **insight feed**
- **AI Copilot** (natural-language questions → tool calls on the analytics API) and **AI mentor briefs**, on free-tier LLMs (Groq → OpenRouter → Gemini, fastest first, with automatic fallback)
- Role-based scoping (Admin / HoD / Mentor / Placement Officer), audit log, fairness check, configurable versioned weights, CSV upload with rollback

## Docs
| Doc | Contents |
|---|---|
| [PRD](docs/PRD.md) | Problem, personas, prioritised features, flows, NFRs |
| [Architecture](docs/ARCHITECTURE.md) | Stack, system diagram, pipeline, scalability, security |
| [Data Model](docs/DATA_MODEL.md) | Sources, schemas, synthetic data design |
| [API](docs/API.md) | REST endpoints with examples |
| [Success Score](docs/SUCCESS_SCORE.md) | **Submission note:** indicators, weights, risk, explainability, segments |
| [ML Approach](docs/ML_APPROACH.md) | What is ML, how it adapts, why not deep learning or RAG |
| [Demo Plan](docs/DEMO_PLAN.md) | 5-minute script, slide outline, rubric checklist |
| [Rules Compliance](docs/RULES_COMPLIANCE.md) | Rulebook checklist, submission package, mandatory-feature map |
| [Submission](docs/SUBMISSION.md) | Ready-to-paste text for the byteXL submission form |
| [Handover](docs/HANDOVER.md) | Run your own copy: fork, Supabase, Render, your own AI keys |

## Tech stack
React 19 · TypeScript · Vite · Tailwind CSS v4 · ECharts │ FastAPI · Pydantic · SQLAlchemy │ PostgreSQL (Supabase) / SQLite │ pandas · scikit-learn · SciPy │ Gemini · Groq · OpenRouter (OpenAI-compatible) │ Docker · Render

## Run locally (Windows / macOS / Linux)
Needs Python 3.12+ and Node 20+.
```bash
python -m venv .venv
.venv/Scripts/pip install -r backend/requirements.txt      # macOS/Linux: .venv/bin/pip
cd frontend && npm install && npm run build && cd ..
.venv/Scripts/python -m uvicorn app.main:app --app-dir backend --port 8000
```
Open http://localhost:8000. API docs are at http://localhost:8000/api/docs.
On first start the app loads `data/raw/*.csv`, runs the pipeline and scores every student (about 5 s). It uses SQLite by default; set `DATABASE_URL` to a Postgres or Supabase connection string for production. Copy `.env.example` to `.env` and add any of `GEMINI_API_KEY`, `GROQ_API_KEY` or `OPENROUTER_API_KEY` to enable the AI Copilot and AI mentor briefs. Providers are tried in order with automatic fallback; everything else works without any key.

To regenerate the synthetic data: `python backend/scripts/generate_data.py`, then delete `backend/pragati.db`.

## Deploy (Render + Supabase)
1. **Supabase:** create a project → Connect → copy the **Session pooler** URI (port 5432).
2. **Render:** New → Blueprint → pick this repo (uses `render.yaml` + `Dockerfile`). Set `DATABASE_URL` to the Supabase URI and at least one of the AI keys.
3. First boot seeds the data and scores everyone. Health check: `/api/v1/health`.

Docker locally: `docker build -t pragati . && docker run -p 8000:8000 pragati`

## Tests
`python backend/tests/test_pipeline.py` runs an end-to-end check (ID reconciliation, scoring bounds, the 75% rule, model AUC, what-if direction).

## For evaluators: demo logins
All accounts use the password **`Prajna@2026`**. The login page also has one-click buttons.
| Role | Email | Sees |
|---|---|---|
| Principal / Admin | admin@prajna.demo | Whole institution; can edit score weights and upload data |
| HoD, CSE | hod.cse@prajna.demo | CSE department only |
| Faculty Mentor | mentor@prajna.demo | Own mentees only |
| Placement Officer | tpo@prajna.demo | Whole institution |

## Repo layout
```
backend/   FastAPI app, pipeline, ML, AI
frontend/  React + Vite dashboard (built into frontend/dist, served by FastAPI)
data/raw/  synthetic source CSVs
docs/      product & technical docs
```
