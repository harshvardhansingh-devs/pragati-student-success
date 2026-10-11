# CHANGELOG

Newest first. Commit hashes refer to `harshvardhansingh-devs/pragati-student-success` (`main`).

## 2026-10-12
- **Handbook:** all docs moved to `handbook/`; added CONTEXT, AI_HANDOFF, DECISIONS, RUNBOOK, CHANGELOG and ROADMAP; media generators saved in `tools/media/`.
- `48e924f` AI answers render markdown bold properly (Copilot and briefs); no raw `**`.
- `cbec833` `submission/` (videos, deck) git-ignored.
- `62fbf63` Docs updated for the student login, the responsive UI and the 5 roles.
- `014b849` **Responsive pass:**
  - mobile login with a brand banner and icon role cards; 16 px inputs
  - card lists below 1280 px (two columns on tablets)
  - collapsible filters on phones; 40 px tap targets
  - the student table fits 1280 px laptops
- `9bc0c34` **Student login** ("My Progress"): own record only, goal simulator, AI study coach, supportive wording. `staff_only` guard; flags normalised to booleans (fixes stray "0").
- `e45f2f7` **Rebrand to Prajna:** logo, favicon, animated loader and boot splash. New logins `@prajna.demo` / `Prajna@2026`; old ones kept as aliases.

## 2026-10-11
- `472a963` Handover guide; keep-alive URL configurable via the `APP_URL` repo variable.
- `34e35a3` Copilot accepts short messages and greets without tool calls.
- `463db0f` Risk metrics from **5-fold CV** (AUC 0.87 ± 0.06 / 0.81 ± 0.03); deterministic split; submission text.
- `964ba10`, `93a506f` Cache warmed at startup; plain-`SELECT` table loads (the first request went from 47 s to ~2 s); demo script; compliance links.
- `a5b4488` **UI/UX redesign:**
  - grouped navigation, global search, Action Center
  - score rings, toasts, skeletons
- `a5b4488` **Fixes:**
  - risk recalibration: High ≥ 0.70, backlog rule 3+
  - segments clustered on standardised scores with truthful names
  - comma-safe segment filter
  - CGPA over cleared credits
  - working free AI models
  - `PIPELINE_VERSION` re-scoring; GitHub keep-alive
- `775ba7b` AI layer switched to free **Groq / OpenRouter / Gemini** with automatic fallback; Jev/Laya evaluated (not used).
- `2f354a0` **Initial platform:**
  - synthetic messy data; 7-source pipeline
  - Success Score, 2 risk models, segments, insights, what-if
  - interventions, Copilot, fairness, roles
  - docs; Docker and Render
