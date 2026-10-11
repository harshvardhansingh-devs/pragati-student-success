# Data Model & Synthetic Data

## 1. Source files (`data/raw`), messy on purpose

| File | Grain | Key used | Injected messiness (what the pipeline fixes) |
|---|---|---|---|
| `erp_students.csv` | student | `student_id` | 8 duplicate rows |
| `academic.csv` | student × semester × subject | `student_id` (8% of students in variant formats: `cs22-0147`, `CS220147`, `CS 22 0147`) | Absent `"AB"` marks, duplicate upload rows, orphan IDs |
| `attendance.csv` | student × subject × week | **`roll_no`** (different key) | Lower-case roll numbers, attended > held, duplicates, orphans |
| `lms_activity` → `lms.csv` | student × week | **`email`** (different key) | Upper-case / trailing-space emails, missing quiz scores |
| `engagement.csv` | activity | `student_id` | Three date formats, duplicates |
| `placement.csv` | student × assessment | `student_id` | `"72%"` strings, out-of-range 104, Y1–2 mostly absent (by design) |
| `skills.csv` | student | `student_id` | Out-of-range −5 / 120 |
| `feedback.csv` | student × term | `student_id` | `"4/5"` strings, nulls, free-text comments |
| `outcome_labels.csv` | student | `student_id` | Historical-style outcomes used to train the risk models |

**Generator** (`backend/scripts/generate_data.py`, seed 42): 1,200 students, 5 departments (CSE, IT, ECE, ME, CE), years 1–4, a 12-week odd semester (Jul–Sep 2026). Each student has latent traits (ability, motivation, career focus, sociability) that drive correlated indicators across sources, so real patterns exist to be found. About 8% suffer a mid-term "shock" (attendance and LMS collapse, satisfaction drops), which produces the Sliding cases. One subject per department-semester is deliberately hard, to create subject hotspots.

## 2. Database tables

**Raw** (`raw_<source>`): exactly the uploaded columns, stored as text.

**Analytics** (rebuilt on every pipeline run):
```
an_scores          one row per student: profile, 23 indicators, weekly trends, 6 domain scores (d_*),
                   success_score, band, cohort_percentile, trend_4w, sliding, completeness, low_confidence,
                   academic/placement: risk_prob, risk tier, rules (JSON), drivers (JSON), segment
an_weekly_scores   student × week: success_score + 6 domain scores
an_weekly_features student × week: attendance & LMS indicators (rolling windows) + trends
an_data_quality    per source: rows_in, duplicates_removed, ids_normalized, unmatched_ids, values_fixed,
                   quarantined, rows_clean, students_covered, completeness
an_subject_stats   current-semester subject: students, avg internal %, fail rate
an_sgpa_history    student × semester: SGPA
an_insights        generated insight feed
```

**App** (transactional):
```
app_interventions   id, student_id, action, reason, owner, status, due_date, notes, score_at_creation,
                    created_by, created_at, updated_at
app_weight_configs  version, weights (JSON), created_by, created_at
app_pipeline_runs   run_id, started_at, finished_at, weights_version, summary (JSON: model metrics, segments)
app_audit_log       user_email, action, entity, entity_id, at
```

## 3. Protected attributes
`gender`, `admission_category` and `home_state` are kept only for the fairness report. They are excluded from the score, the models and the clustering.
