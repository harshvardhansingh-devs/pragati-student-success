# ROADMAP: open items, by priority

> Pick from the top. When you finish an item, move it to `CHANGELOG.md`.

## P0 · Round-1 submission (deadline 2026-10-12 10:00 IST)
- [ ] Fill in team and member names: deck slide 1 (`tools/media/deck/build.js` cover), the demo and promo title cards (`tools/media/demo_video.py` title scene, `promo.html`), and the web deck artifact.
- [ ] Submit the byteXL form (text in `SUBMISSION.md`, links in `CONTEXT.md`), with the demo video uploaded as **unlisted**.
- [ ] Make sure the submission repo (`Natural-navya/Prajna`) is synced with the latest `main` and has no `.env`.
- [ ] External keep-alive (cron-job.org → `/api/v1/health` every 10 min) on the submission URL.

## P1 · Quality (the form says the repo is auto-reviewed for security, maintainability and test coverage)
- [ ] **More tests:** split `test_pipeline.py` into pytest modules (pipeline, scoring, auth/permissions, API routes via `TestClient`, AI tool filters); add a coverage report (`pytest --cov`).
- [ ] Frontend tests (Vitest + React Testing Library) for login, the role-based nav and the student cards.
- [ ] CI workflow: run the tests, `tsc` and lint on every push (`.github/workflows/ci.yml`).
- [ ] Security hardening:
  - rate-limit `/auth/login`
  - tighten CORS (currently `*`)
  - add security headers
  - fail fast if `JWT_SECRET` is unset in production
- [ ] Pin dependency versions (`requirements.txt` uses `>=`).
- [ ] Linting: `ruff` (backend), `eslint` is configured (frontend); fix the warnings.

## P2 · Product (from the PRD roadmap)
- [ ] Intervention effectiveness: score before vs after, by action type, once weekly snapshots continue over time.
- [ ] Export the at-risk list (CSV/PDF) for HoD meetings.
- [ ] Installable app (PWA manifest + icons).
- [ ] Guided "judge tour" overlay.
- [ ] Student nudges (weekly goal reminders); mentor weekly digest (email/WhatsApp).
- [ ] NAAC / NBA student-progression exports.
- [ ] Live connectors (Moodle REST, ERP database) replacing CSV upload.
- [ ] RAG over college regulations and free-text feedback analysis (sentiment, distress flags).
- [ ] Real SSO (college identity provider) replacing the demo users.

## P3 · Scale
- [ ] Scoring in a background worker; incremental re-scoring.
- [ ] Query `an_*` tables directly (indexes, `institution_id` partitioning) instead of the per-process cache at 100k+ students.
- [ ] Model registry and drift monitoring once real outcome data exists.
