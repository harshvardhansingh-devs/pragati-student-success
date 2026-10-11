# Student Success Score: Methodology Note

> This is the submission deliverable: *"Short note explaining the Student Success Score, the indicators used and how they are combined."*
> The live version, with current weights and model metrics, is in the app under **Score Methodology**.

## 1. Design principles
1. **Transparent first, ML second.** The Success Score is a weighted composite that anyone can audit. ML is used to *predict risk*, and every prediction comes with its drivers.
2. **Comparable across cohorts.** Indicators are scaled against fixed, policy-based ranges, not percentiles, so a score of 70 means the same thing in every department and year. The cohort percentile is shown alongside it.
3. **Actionable.** Indicators are things a student or college can change (attendance, assignments, mock interviews), not demographics.
4. **Fair.** Gender, admission category and home state are **never** inputs to the score, the models or the segmentation. They are used only to monitor parity.

## 2. Indicators (23 indicators, 6 domains, 7 sources)

| Domain | Weight | Indicator (source) | Scaled range → 0–100 |
|---|---|---|---|
| **Academic** | **30%** | CGPA (ERP) | 4.5 → 9.5 |
| | | Active backlogs (ERP), lower is better | 0 → 4 |
| | | SGPA trend, last semester vs previous (ERP) | −1.5 → +1.5 |
| | | Current internal marks % (ERP) | 35 → 85 |
| | | Weakest current subject % (ERP) | 25 → 85 |
| | | Faculty rating (Feedback) | 1 → 5 |
| **Attendance** | **15%** | Term attendance % (Biometric) | 50 → 95 |
| | | Last-4-week attendance % (Biometric) | 50 → 95 |
| | | Subjects below 75%, lower is better (Biometric) | 0 → 3 |
| **Learning (LMS)** | **15%** | Logins / week (LMS) | 0 → 4 |
| | | Assignment completion % (LMS) | 30 → 100 |
| | | On-time submission % (LMS) | 20 → 100 |
| | | Quiz average (LMS) | 30 → 90 |
| **Placement readiness** | **20%** | Aptitude score (Placement cell) | 25 → 85 |
| | | Coding score (Placement cell) | 15 → 85 |
| | | Mock interviews (Placement cell) | 0 → 2 |
| | | Mock interview rating (Placement cell) | 1 → 5 |
| **Skills** | **10%** | Technical assessment (Skills) | 25 → 85 |
| | | Soft skills: mean of communication and teamwork (Skills) | 25 → 85 |
| | | Certifications (Skills + Engagement) | 0 → 2 |
| **Engagement & wellbeing** | **10%** | Clubs / events / hackathons (Engagement) | 0 → 4 |
| | | Leadership roles (Engagement) | 0 → 1 |
| | | Satisfaction (Feedback) | 1 → 5 |

**Year-aware weights:** for Years 1–2, 10 points of Placement weight move to Academic (placement preparation hasn't started yet). Weights are configurable by the Admin and versioned; saving new weights re-scores every student.

## 3. Computation

```
1. scaled_i   = clip((x_i − lo_i) / (hi_i − lo_i), 0, 1) × 100      (100 − scaled for "lower is better")
2. domain_d   = mean of the available scaled indicators in domain d
               missing domain → dept × year cohort median, flagged "low confidence"
3. Success    = Σ_d  w_d × domain_d                                      (Σ w_d = 1)  → 0–100
4. Band       = Thriving ≥ 75 · On track 60–74 · Watch 45–59 · At risk < 45
5. Sliding    = score fell ≥ 10 points between week t−4 and week t (weekly snapshots)
```

Attendance and LMS indicators are recomputed every week (rolling 4-week windows), so the score has a **trajectory**, not just a level. That is what powers Sliding alerts.

**Explainability (score):** each indicator's contribution is `w_d × scaled_i / n_d` points. The Student 360 page shows each indicator's contribution minus the cohort-average contribution as a diverging bar chart (what lifts or drags this student's score).

## 4. Risk flags (separate from the score)

The score says *where a student stands*. Risk says *where they are heading*.

| Risk | Predicted outcome | Model features | Hard rules (always High) |
|---|---|---|---|
| **Academic** | New backlog or SGPA < 6 next semester | Academic, attendance, LMS indicators + satisfaction + 4-week attendance and assignment trends (16) | Term attendance < 75% (detention rule); ≥ 2 active backlogs |
| **Placement** | Not placement-ready by placement season | Placement, skills, engagement indicators + CGPA and backlogs (11) | Final year with coding score < 30 |

- **Model:** logistic regression on standardised features, one per risk type, retrained on every pipeline run.
- **Tiers:** High ≥ 0.60, Medium ≥ 0.35, else Low. Final tier = High if any rule fires, else the model tier.
- **Validation:** stratified 75/25 hold-out on the demo data gives academic AUC 0.87 (recall 72% at Medium+) and placement AUC 0.77 (recall 77%). The labels are synthetic, so these numbers show that the method works, not how it performs on real students.
- **Explainability (risk):** for a linear model, `coefficient × standardised value` is the exact additive contribution of each feature to the log-odds (equivalent to linear SHAP). The top 3 risk-increasing features are shown as "drivers" with the student's value and the cohort median.
- **What-if:** edit any indicator, then the score, band and both risk probabilities are recomputed live.

## 5. Segmentation

K-Means (k = 6) on the six domain scores. Each cluster centroid is matched to an interpretable prototype profile using optimal assignment (Hungarian algorithm), so every cluster gets a unique, stable, meaningful name with a playbook:

| Segment | Profile | Playbook |
|---|---|---|
| All-rounders | High everywhere | Peer mentors; stretch goals |
| Academic Star, Placement-Unready | Academic high, placement and skills low | DSA / coding bootcamp, mock interviews, certifications |
| Placement-Ready, Academically Average | Placement high, academic mid | Protect CGPA cut-offs; backlog clearance |
| Engaged but Struggling | Engagement high, academic low | Remedial classes + time-management coaching |
| Silent Disengager | Attendance and LMS low | Mentor outreach within a week; counselling |
| Multi-domain Risk | Low across domains | Intensive case management |

## 6. Limitations
- Domain weights are expert-set. With real outcome data they should be validated by regressing outcomes on domain scores.
- The score is a conversation starter for mentors, not a judgement about a student.
