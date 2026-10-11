# CONTEXT: Prajna in one page

> Read this first. It's the shortest path from "never seen this repo" to "productive".
> Last updated: 2026-10-12.

## What it is
**Prajna** (प्रज्ञा, "wisdom, insight"; formerly named *Pragati*) is an AI-powered **Student Success Intelligence** web app for colleges. It:
1. **Integrates** 7 messy campus data sources into one **Student 360** record per student.
2. **Scores** every student with an explainable **Student Success Score** (0–100, 6 weighted domains, 23 indicators).
3. **Predicts** academic risk and placement risk (logistic regression plus campus rules), always showing the top reasons.
4. **Segments** students into 6 named groups (K-Means), each with an action playbook.
5. **Acts:** recommendations become tracked interventions (single, bulk or whole segment), with a what-if simulator.
6. Adds an **AI Copilot** (natural language → read-only analytics tools) and **AI briefs** (mentor briefs, student study tips).

## Why it exists
Built for **KPMG × byteXL HacXLerate 2026, Round 1**, problem statement *"AI-Powered Student Analytics and Success Platform"*. The full brief and judging rubric are in `PRD.md` and `RULES_COMPLIANCE.md`.
- **Judging:** an automated functionality check first, then humans. Weights: Data Integration 30 · Score & Risk 25 · Dashboard 25 · Problem understanding 10 · Presentation 10. Bonuses for segmentation and explainability.
- **Round 1 deadline:** 2026-10-12 10:00 IST. The same problem statement carries into Round 2 and the Finale.

## Who uses it (5 roles; demo password for all: `Prajna@2026`)
| Role | Login | Scope |
|---|---|---|
| Principal / Admin | admin@prajna.demo | Everything; edits score weights; uploads data |
| HoD (CSE) | hod.cse@prajna.demo | CSE department only |
| Faculty Mentor | mentor@prajna.demo | Own mentees only (`mentor_id = M-CS-31`) |
| Placement Officer | tpo@prajna.demo | Everything (placement focus) |
| Student | student@prajna.demo | Own record only (`CS23-0115`, Neha Deshpande); staff endpoints return 403 |

The old `@pragati.demo` logins with password `Pragati@2026` still work as aliases.

## Where things live
| Thing | Location |
|---|---|
| Live app, **submission copy** | https://prajna-w5i3.onrender.com (repo **github.com/Natural-navya/Prajna**) |
| Live app, original | https://pragati-9l3m.onrender.com (repo **github.com/harshvardhansingh-devs/pragati-student-success**) |
| Database | Supabase Postgres (Mumbai), one per deployment. Local dev uses SQLite `backend/pragati.db` |
| Hosting | Render free tier, Docker (`Dockerfile` + `render.yaml` Blueprint). Auto-deploys on push to `main` |
| Keep-alive | `.github/workflows/keep-alive.yml` pings `/api/v1/health` every 10 min (set repo variable `APP_URL`) |
| AI providers | Groq `openai/gpt-oss-120b` → OpenRouter `nvidia/nemotron-3-super-120b-a12b:free` → Gemini `gemini-3.8-flash` (free tiers, auto-fallback) |
| Submission media | `submission/` (git-ignored): demo video, promo video, pitch deck. Generators in `tools/media/` |
| Slide deck (web) | Claude artifact `claude.ai/artifact/1uhMmtNaTWTJkAKyeXnpbn` (private to the owner) |

> **Two repos exist.** `harshvardhansingh-devs/pragati-student-success` is where development happened. `Natural-navya/Prajna` is the team's submission copy (a fork, or a copy of it) with its own Render and Supabase. Fixes made in one must be synced to the other ("Sync fork" on GitHub).

## Stack
React 19 + TypeScript + Vite + Tailwind v4 + ECharts (frontend, built into `frontend/dist`, served by FastAPI) · FastAPI + Pydantic + SQLAlchemy · pandas + scikit-learn + SciPy · PostgreSQL / SQLite · OpenAI-compatible SDK for the LLM providers · Docker.

## Current state (2026-10-12)
- ✅ All brief requirements and both bonuses built, deployed and verified live (see `CHANGELOG.md`).
- ✅ Rebranded to Prajna (logo, favicon, animated loader). Student login added. Fully responsive (phone, tablet, laptop).
- ✅ One end-to-end test (`backend/tests/test_pipeline.py`) covering the pipeline, scoring, the rules, the filters, the auth aliases, the student permissions and the what-if.
- ⏳ Open items are in `ROADMAP.md`. Biggest: team names on the deck and videos, the Round-1 form submission, a reliable keep-alive (cron-job.org).

## Key numbers (demo dataset, deterministic, seed 42)
1,200 students · 118,692 raw rows · 6,126 IDs reconciled · 1,021 duplicates removed · 2,536 values repaired · 404 high-risk · 61 sliding · 127 below 75% attendance · AUC 0.87 ± 0.06 (academic), 0.81 ± 0.03 (placement), 5-fold CV · segments 280/250/206/170/160/134.

The data is **synthetic** (`backend/scripts/generate_data.py`); no real student data is used anywhere.
