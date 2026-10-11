# CLAUDE.md

Instructions for AI coding agents working in this repo.

**Start here:** read `handbook/CONTEXT.md`, then `handbook/AI_HANDOFF.md` (repo map, commands, invariants, definition of done), `handbook/DECISIONS.md` and `handbook/ROADMAP.md`. All docs live in `handbook/` (index: `handbook/README.md`).

Non-negotiables (details in AI_HANDOFF §3):
- Work locally on SQLite: `DATABASE_URL=sqlite:///backend/pragati.db`.
- Run `backend/tests/test_pipeline.py` (must print `ok`) and `cd frontend && npx tsc -b && npm run build` before committing.
- Keep role scoping server-side (`scope`, `staff_only`, `require_admin`). Never send names to the LLM. Never commit `.env`.
- Bump `store.PIPELINE_VERSION` when scoring or pipeline logic changes. Record changes in `handbook/CHANGELOG.md`.
- No AI co-author or attribution trailers in commits.
