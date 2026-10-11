# DECISIONS: why Prajna is built this way

> Architecture decision log. Each entry: the decision, why, and what would make us revisit it.
> Before undoing any of these, read the "Revisit if" line and record a new entry.

### D1 · One deployable: FastAPI serves the React build (2026-10-11)
**Decision:** a React + Vite single-page app built into `frontend/dist`, served by the FastAPI app; one Docker image on Render.
**Why:** a 24-hour hackathon needs one URL and one deploy; there's no CORS or second service to break. Streamlit was too limited for multiple roles and custom UX; Next.js meant two services.
**Revisit if:** the frontend needs its own CDN or edge hosting, or separate teams own the UI and the API.

### D2 · Synthetic, deliberately messy data (2026-10-11)
**Decision:** generate 1,200 students from latent traits (ability, motivation, career focus, sociability), with ~8% hit by a mid-term "shock", plus injected messiness: ID variants, roll-number and email keys, duplicates, "82%", "4/5", "AB", out-of-range values, three date formats.
**Why:** no real data was provided; latent traits create real correlations for the models to find, and the messiness makes data integration (30% of the score) visible.
**Revisit if:** real institutional data arrives. Swap the CSV inputs and keep the pipeline.

### D3 · Transparent score, ML only for risk (2026-10-11)
**Decision:** the Success Score is a weighted formula (23 indicators scaled to fixed policy ranges → 6 domains → weighted sum). Machine learning is used only to predict risk.
**Why:** faculty must trust and audit the score; fixed ranges make 70 mean the same in every cohort; explainability is a bonus criterion.
**Revisit if:** there are real outcome data to calibrate the weights; do that by regression, not by replacing the formula with a black box.

### D4 · Logistic regression, not gradient boosting or deep learning (2026-10-11)
**Decision:** one logistic regression per risk on standardised features; per-student drivers = coefficient × standardised value; metrics from 5-fold stratified CV, with rows sorted by `student_id` for determinism.
**Why:** exact explanations, ideal for ~1–10k tabular rows, fast enough to retrain on every load, and a hold-out split proved noisy (0.87 → 0.92 just from the split).
**Revisit if:** real multi-year data exists and a challenger model beats it under the same CV. Swap inside `RiskModel`, keeping the interface.

### D5 · Hybrid rules + model; tiers High ≥ 0.70, Medium ≥ 0.40 (2026-10-11)
**Decision:** campus rules always flag High: attendance below 75% (detention), 3+ backlogs, final year with coding below 30. Otherwise use the model tier.
**Why:** policy facts shouldn't depend on a probability; the earlier thresholds (0.60/0.35, and 2+ backlogs) flagged too many students to act on.
**Revisit if:** the institution's rules or capacity differ. These are config-like constants in `scoring.py`.

### D6 · K-Means on standardised domains, named by relative prototypes (2026-10-11)
**Decision:** k = 6 on z-scored domain scores; centroids matched to prototype profiles (in z-units) with the Hungarian algorithm.
**Why:** raw-scale clustering was dominated by attendance variance, and absolute prototypes mis-named clusters ("All-rounders" went to the wrong group). Relative profiles give stable, truthful names.
**Revisit if:** the number or meaning of segments changes. Update `SEGMENTS`, then check every cluster's profile against its name.

### D7 · Free LLMs through one OpenAI-compatible client, fastest first (2026-10-11)
**Decision:** Groq → OpenRouter → Gemini via the `openai` SDK with per-provider base URLs; automatic fallback; models set by env vars.
**Why:** the owner had free keys for these three; one code path; measured latency was Groq ~1.5 s, OpenRouter ~4 s, Gemini ~15 s.
**Revisit if:** a paid provider is approved, or the models are retired (then change the env vars only).

### D8 · Tool calling, not RAG; no Jev/Laya (2026-10-11)
**Decision:** the Copilot calls read-only analytics tools (`search_students`, `group_summary`) inside the user's scope; no free-form SQL; no vector store.
**Why:** the data is structured, so tools give exact, permission-safe answers. RAG suits documents (future: college regulations). Jev and Laya were evaluated: they don't beat supervised models on labelled tabular outcomes, and Laya doesn't fit 512 MB of CPU.
**Revisit if:** unstructured documents or free-text feedback analysis are added.

### D9 · Layered storage + per-process cache + PIPELINE_VERSION (2026-10-11)
**Decision:** `raw_*` (as uploaded) → `an_*` (recomputable analytics) → `app_*` (transactional). Each process caches the `an_*` tables and re-checks the latest run every 10 s; boot re-scores when `PIPELINE_VERSION` changes; the cache warms before serving.
**Why:** idempotent re-runs and auditability; fast reads at 1,200–10k students; deployed data stays in step with the code.
**Revisit if:** past ~100k students. Query `an_*` tables directly with indexes and move scoring to a worker.

### D10 · SQLite local, Supabase in production; Render free tier with keep-alive (2026-10-11)
**Decision:** `DATABASE_URL` switches the engine; local dev always on SQLite; GitHub Actions pings every 10 min.
**Why:** zero-cost hosting; local experiments can't corrupt live data. GitHub's scheduler is unreliable for new repos, so an external pinger (cron-job.org) is recommended too.
**Revisit if:** a paid always-on plan is available.

### D11 · Demo auth: JWT with fixed demo users, server-side scoping (2026-10-11 → 10-12)
**Decision:** 5 hard-coded demo accounts with PBKDF2-hashed shared password; JWT; `scope()` filters; `staff_only` blocks students from institution views and writes.
**Why:** evaluators need one-click access; real SSO is out of scope for Round 1.
**Revisit if:** going to a real campus. Replace `USERS` with the college identity provider (SSO/OIDC) and keep the scoping model.

### D12 · Rebrand to Prajna; keep old URL and repo names (2026-10-12)
**Decision:** the product name, logo and logins changed to Prajna; `@pragati.demo` / `Pragati@2026` still accepted as aliases; the `pragati-9l3m` URL and `pragati-student-success` repo kept.
**Why:** renaming the URL or repo would break submitted links. Aliases avoid breaking anything already shared.

### D13 · Responsive: cards below 1280 px, tables above (2026-10-12)
**Decision:** student and intervention lists render as cards below `xl` (two columns on tablets); secondary table columns (Segment, CGPA, Attendance) appear only at `2xl`.
**Why:** the 1,180 px table scrolled sideways on phones, tablets and 1280 px laptops. Measured: no page scrolls sideways at 360/768/1024/1280.

### D14 · CGPA over cleared credits (2026-10-11)
**Decision:** CGPA = credit-weighted grade points over passed subjects; failed subjects count as active backlogs.
**Why:** including fails produced CGPA 0.00 for some students, which isn't credible; this matches common university practice.

### D15 · Reproducible media (2026-10-12)
**Decision:** the demo video is recorded by script (Playwright + Windows TTS); the promo is rendered frame by frame from an HTML timeline; the music is synthesised in code; the deck is generated with pptxgenjs. All in `tools/media/`.
**Why:** links, names or numbers change. Regenerating beats re-editing by hand, and there are no copyright issues.
