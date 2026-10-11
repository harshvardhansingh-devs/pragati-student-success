# byteXL submission form: ready to paste

**Project title**
Prajna: AI-Powered Student Success Intelligence Platform

**Project summary** (short)
Prajna unifies seven campus data sources into one Student 360 view, computes an explainable Student Success Score (0–100), predicts academic and placement risk early, groups students into six actionable segments, and turns every risk flag into a tracked intervention, with an AI Copilot for plain-English questions.

**Solution description**
Colleges hold attendance, exam, LMS, engagement, placement, skills and feedback data in separate systems that don't share a student ID, so problems such as detention (attendance below 75%), backlogs or placement unreadiness surface too late.

Prajna's pipeline ingests all seven sources, reconciles three different student keys (student ID variants, roll numbers, LMS emails), removes duplicates, and repairs or quarantines bad values. On the demo data that is 118,692 rows, 6,126 IDs reconciled and 1,021 duplicates removed, all reported per source.

The Student Success Score combines 23 indicators across six weighted domains (Academic 30%, Placement 20%, Attendance 15%, LMS 15%, Skills 10%, Engagement 10%), scaled against fixed policy ranges, with year-aware weights an admin can change.

Two logistic-regression models, retrained on every data load, predict academic setback (5-fold CV AUC 0.87) and placement unreadiness (AUC 0.81). Hard campus rules sit alongside them, and every flag shows its top drivers. Weekly snapshots power "Sliding" alerts for students whose score drops 10+ points in four weeks. A what-if simulator shows the targets that would lower a student's risk.

K-Means segmentation finds six named groups (for example "Academic Star, Placement-Unready"), each with a playbook that can be assigned in one click. An AI Copilot (Groq / OpenRouter / Gemini with fallback) answers questions through read-only analytics tools and AI mentor briefs prepare meetings; the AI sees IDs and numbers only.

Role-based access (Principal, HoD, Mentor, Placement Officer, and a Student self-view), an audit log and a fairness check support responsible use, aligned with India's DPDP Act 2023. The interface is fully responsive: it works on phones, tablets and laptops, in light and dark mode.

**Tech stack**
React 19 + TypeScript + Vite + Tailwind + ECharts · FastAPI (Python) · pandas, scikit-learn, SciPy · PostgreSQL (Supabase) · Groq / OpenRouter / Gemini (OpenAI-compatible APIs) · Docker on Render · GitHub Actions

**Links**
- Deployed app: https://pragati-9l3m.onrender.com
- GitHub: https://github.com/harshvardhansingh-devs/pragati-student-success
- API docs: https://pragati-9l3m.onrender.com/api/docs
- Success Score note: https://github.com/harshvardhansingh-devs/pragati-student-success/blob/main/handbook/SUCCESS_SCORE.md

**Test access / evaluator notes**
Open the app and click any role on the login page (one click, no typing). Or sign in manually; all accounts use the password `Prajna@2026`:
- Principal / Admin: admin@prajna.demo (whole institution; can edit score weights and upload data)
- HoD, CSE: hod.cse@prajna.demo (CSE only)
- Faculty Mentor: mentor@prajna.demo (own mentees only)
- Placement Officer: tpo@prajna.demo
- Student: student@prajna.demo (sees only their own progress, a goal simulator and AI study tips)

Suggested path: Overview → Action Center → At-Risk Students → a student's Student 360 (risk drivers, what-if, Assign, AI brief) → Segments → AI Copilot → Data Integration → Score Methodology. Then sign in as **Student** to see the student's own view. The data is synthetic (1,200 students) and contains no real student information.
