# PRD — Prajna: Student Success Intelligence Platform

> *Prajna* (प्रज्ञा) = wisdom, insight: the clarity to see which student needs help, and why.

| | |
|---|---|
| Problem statement | AI-Powered Student Analytics and Success Platform (KPMG × byteXL HacXlerate) |
| Version | 0.1 (brainstorm → build) |
| Owner | Team |
| Status | Built: v1.0 prototype (see build status below) |

---

## 1. Problem

Indian colleges already collect plenty of student data: ERP (marks, CGPA, backlogs), biometric or register attendance, LMS (Moodle/Google Classroom), club and event records, placement-cell aptitude and coding tests, and feedback forms. The trouble is that it is spread across **7+ disconnected systems**, it gets looked at **after** results are out, and nobody owns the follow-up.

The result:
- Detention (<75% attendance) and backlogs are found out at semester end, when it is too late to act.
- Placement cells find out in the final year that "toppers" can't clear coding rounds.
- Mentors get spreadsheets instead of a clear "talk to these 5 students this week, about this."
- No one measures whether interventions actually worked.

## 2. Vision

Move from **"dashboard of what happened"** to **"decision intelligence for what to do next"**:

> **Integrate → Score → Predict → Explain → Act → Measure**

Every screen should answer one of three questions for its user: *Who needs help? Why? What should I do?*

## 3. Users & their jobs

| Persona | Primary job-to-be-done | Key screen |
|---|---|---|
| **Principal / Dean (Admin)** | "Where is the institution bleeding? Which department/cohort needs resources?" | Institution Overview, Trends, Accreditation export |
| **HoD** | "Which of my sections/subjects are causing backlogs? Who is sliding?" | Department view, Subject hotspots |
| **Faculty mentor** | "Which of *my* 20 mentees need a conversation this week and about what?" | My Mentees, Student 360, AI Brief |
| **Placement officer (TPO)** | "Who is not placement-ready and what training batch do they need?" | Placement Readiness, Segments |
| **Student** *(stretch)* | "Where do I stand and what one thing should I improve?" | Self view |
| **Data admin** | "Is the data complete and fresh?" | Data Integration & Quality |

## 4. Goals & success metrics

| Goal | Metric (demo) | Metric (real deployment) |
|---|---|---|
| Unified view | 7 sources → 1 Student 360, quality report shown | % students with complete profile > 95% |
| Early identification | Risk model AUC ≥ 0.80 (5-fold CV) | % at-risk flagged ≥ 6 weeks before exam |
| Explainability | Top-3 drivers shown for every score/flag | Mentor trust survey |
| Actionability | Every flag has a suggested intervention | % flags with an intervention logged in 7 days |
| Impact | Before/after score on intervened students | Reduction in backlogs / detention / unplaced % |

## 5. Scope — features

Priority: **P0** = must ship for the demo (covers the evaluation rubric). **P1** = strong differentiator, build if time allows. **P2** = roadmap slide only.

### 5.1 Core (from the brief)

| # | Feature | Priority | Rubric hit |
|---|---|---|---|
| F1 | **Multi-source ingestion**: CSV/Excel upload per source (Academic, Attendance, LMS, Engagement, Placement, Skills, Feedback) with schema validation | P0 | Data Integration 30% |
| F2 | **Cleaning & entity resolution**: normalise student IDs (`CS21-001` / `cs21001` / `CS 21 001`), fix types (`"82%"` → 82.0), dedupe, impute, flag outliers | P0 | Data Integration |
| F3 | **Data Quality report**: completeness, duplicates removed, unmatched IDs, freshness per source | P0 | Data Integration |
| F4 | **Student 360**: one page per student with all 7 domains, timeline and trends | P0 | Data Integration, Dashboard |
| F5 | **Student Success Score (0–100)** + 6 domain sub-scores, bands (Thriving / On track / Watch / At risk). See [SUCCESS_SCORE.md](SUCCESS_SCORE.md) | P0 | Score 25% |
| F6 | **Dual risk prediction**: *Academic risk* and *Placement risk* probabilities + tiers (High/Med/Low), hybrid of hard rules (e.g. <75% attendance) and an ML model | P0 | Score 25% |
| F7 | **Interactive dashboard**: KPIs, filters (dept/year/section/segment/risk), at-risk list, trends, drill-down | P0 | Dashboard 25% |

### 5.2 Bonus (from the brief)

| # | Feature | Priority | Rubric hit |
|---|---|---|---|
| F8 | **Segmentation**: clustering on domain sub-scores → named, actionable personas (e.g. *"Academic Star, Placement-Unready"*, *"Silent Disengager"*) with a playbook per segment | P0 | Bonus → Score |
| F9 | **Explainable score**: per-student waterfall of score contribution + exact additive drivers for each risk flag, in plain language | P0 | Bonus → Dashboard |

### 5.3 Beyond the brief (our differentiators)

| # | Feature | Why it matters | Priority |
|---|---|---|---|
| F10 | **Early-warning trajectory ("Sliding" alert)**: flag students whose score dropped ≥10 pts in 4 weeks, *even if still "On track"* | Catches problems before they show up as a bad score | P0 |
| F11 | **What-if simulator**: "If attendance → 80% and 3 pending assignments submitted, academic risk 72% → 38%" | Turns the explanation into a concrete target the student can hit | P1 |
| F12 | **Intervention recommender + tracker (closed loop)**: driver → playbook action (remedial class, mentor meet, mock interview, counselling); assign owner, due date, status | Moves past dashboards: insight → action | P0 |
| F13 | **Intervention effectiveness**: score change before vs after, by intervention type | Shows which actions actually work, so budget goes to them | P1 |
| F14 | **AI Copilot (natural language)**: "Show 3rd-year CSE students with CGPA > 8 but coding score < 40" → table + chart. Uses tool-calling on our API (no free-form SQL) | Admins don't write SQL | P1 |
| F15 | **AI Mentor Brief**: one-click, 5-line brief before a mentor meeting (strengths, concerns, talking points, suggested action) | Saves faculty time | P1 |
| F16 | **Auto-insights feed**: system-generated statements like "Mechanical Y3 attendance fell 9% after mid-sems; 62% of new backlogs are in *Thermodynamics*" | Pushes insights to users instead of making them search | P1 |
| F17 | **Subject hotspot analysis**: subjects/sections with abnormal fail rates | HoD-level root cause | P1 |
| F18 | **Configurable score weights**: admin adjusts domain weights with live re-ranking (versioned) | Different institutions want different weights | P1 |
| F19 | **Role-based views + PII masking + audit log** | DPDP Act 2023 compliance; KPMG judges will care about governance | P1 (RBAC basic P0) |
| F20 | **Fairness check**: flag-rate parity across gender/category/region; protected attributes never used as model features | Responsible AI | P1 |
| F21 | **Accreditation export**: NAAC Criterion 2 & 5 / NBA style student-progression tables (PDF/CSV) | Real admin pain point every year | P2 |
| F22 | **Weekly mentor digest** (email/WhatsApp) | Delivers the insight to where faculty already are | P2 |
| F23 | **Student self-view + nudges** | Gives students ownership of their own progress | P2 |
| F24 | **Live connectors** (Moodle API, ERP DB, Google Forms) replacing uploads | Scale | P2 |

### 5.4 Out of scope (for the hackathon)
Real student PII, production SSO, mobile app, streaming ingestion, model retraining pipelines.

## 6. Key user flows (demo story)

1. **Principal** opens Overview → 1,200 students, 14% High academic risk, 21% High placement risk; *"Sliding: 37"* card is red → Mechanical Y3 trend dips after mid-sems.
2. Drills into **Mech Y3** → at-risk list sorted by risk → opens **Riya (CGPA 8.6)**.
3. Riya: Success Score 61 (*Watch*), **Placement risk High**. Segment: *Academic Star, Placement-Unready*. Explanation: coding score 32 (−11), 0 mock interviews (−7), no certifications (−4).
4. **What-if**: coding → 60 and 2 mock interviews → placement risk 78% → 35%.
5. Clicks **Recommend** → "Enrol in DSA bootcamp + 2 mock interviews" → assigns to TPO, due in 14 days.
6. **Segments** page → 84 students in the same segment → bulk-assign the bootcamp.
7. **Copilot**: "Which departments have the most sliding students this month?" → answer + chart.
8. **Data Quality** page → 7 sources, 312 duplicate rows merged, 41 IDs reconciled, 96.8% complete.

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Dashboard API p95 < 500 ms for 10k students; full re-score of 10k students < 60 s |
| Scalability | Stateless API (horizontal scale); `institution_id` on every table (multi-tenant ready) |
| Security | JWT auth, role-based access (Admin/HoD/Mentor/TPO), mentors see only their mentees |
| Privacy | DPDP Act 2023: purpose limitation, PII masked in exports & LLM prompts (send IDs/aggregates, not names), audit log |
| Explainability | No score or flag without its top drivers |
| Reliability | Ingestion is idempotent; bad rows quarantined, never silently dropped |
| Accessibility | Colour + icon/text for risk (not colour alone), keyboard navigable |

## 8. Assumptions
- Synthetic dataset (~1,200 students, 5 departments, 4 years, 12 weekly snapshots) that mimics Indian college conventions: 10-point CGPA, backlogs/ATKT, 75% attendance rule, placement season in Y4.
- Ground-truth outcome labels are simulated from latent traits, so model metrics are illustrative.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Synthetic data looks too clean or too random | Generate from latent traits (ability, motivation, career focus) so the correlations are realistic; inject realistic messiness |
| "Black box" concern | Transparent weighted score is primary; ML only predicts risk, and always comes with its top drivers |
| Bias against groups | Protected attributes excluded from features; fairness page |
| Demo breaks | Seeded DB snapshot, one `docker compose up`, recorded backup video |

## 10. Build status (v1.0)
| Built | Not built (roadmap) |
|---|---|
| F1–F20 except F13 and F18 notes below; F14 Copilot and F15 Briefs (need any one of the Gemini / Groq / OpenRouter keys; the brief has a template fallback) | F13 effectiveness analytics beyond "score at start → now"; F21 accreditation export; F22 digests; F23 student self-view; F24 live connectors |
| F18 configurable weights (admin, versioned, live re-score) | PII masking in exports (no export feature yet) |
