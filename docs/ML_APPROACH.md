# ML & AI Approach: what is real, what adapts, and why we chose it

## Is it real ML?
Yes. Three kinds of learning run on every pipeline execution:

| Component | Technique | Learns from | Output |
|---|---|---|---|
| Academic risk | Supervised: logistic regression (scikit-learn) | Past outcomes (backlog / SGPA < 6) | Probability + tier + per-student drivers |
| Placement risk | Supervised: logistic regression | Past placement-readiness outcomes | Probability + tier + per-student drivers |
| Segmentation | Unsupervised: K-Means + Hungarian matching | Domain-score patterns, no labels | 6 named student groups |
| Copilot & briefs | LLM (Claude) with tool use | Nothing is trained; it reasons over our analytics | Natural-language answers, mentor briefs |

The Success Score itself is deliberately **not** a black-box model. It is a transparent weighted formula, because faculty must be able to trust it and audit it.

## Does it adapt to new data?
Yes, in batch mode. Every time data changes (CSV upload, or a scheduled sync in production) the pipeline:
1. re-cleans and re-integrates all sources,
2. **retrains both risk models** on the latest labelled outcomes,
3. **re-clusters** the segments,
4. re-scores every student and regenerates the insight feed.

So the models adapt to each college's own data. A college with a different attendance culture gets different learned weights. Admins can also adapt the score itself by changing domain weights, which are versioned.

We do **not** do online or real-time learning: updating the model on every new attendance row. Student outcomes arrive per semester, so per-event learning adds noise and makes explanations unstable.

## "Adaptive ML" vs "Cognitive ML"
These are marketing terms rather than technical categories. Mapped onto what we built:
- **Adaptive:** models retrain on new data, cohort-relative imputation, configurable weights, weekly trajectories. ✔
- **Cognitive:** a reasoning layer that understands questions and explains in natural language. That is the Claude-powered Copilot and mentor briefs. ✔ The LLM never invents numbers; it calls our analytics tools and reports their results.

## Why logistic regression instead of a custom deep model or gradient boosting?
| Criterion | Logistic regression (ours) | XGBoost / deep custom model |
|---|---|---|
| Explainability (bonus criterion) | Exact per-feature contributions | Needs SHAP approximations |
| Data size (one college ≈ 1–10k students) | Ideal | Overfits small tabular data |
| Accuracy on this data | AUC 0.87 / 0.77 | Typically within ±0.02 on tabular data of this size |
| Faculty trust / auditability | High | Low |
| Speed | 1,200 students scored in < 4 s, including retraining | Slower |

With **real** multi-year data, the code is built so the model can be swapped to gradient boosting (`scoring.RiskModel`) behind the same interface. We would only do it if it measurably beats the baseline on a hold-out set.

## Do we need RAG?
Not for the core problem. Our data is **structured** (marks, attendance, scores), and the right pattern for structured data is **tool calling**: the LLM queries our analytics API with filters, which is exact and scope-aware. RAG retrieves passages from **unstructured documents**; using it on tables gives approximate, unverifiable answers.

RAG becomes useful later for unstructured sources:
- the college's academic regulations and handbook ("what is the condonation rule for attendance?"),
- intervention playbooks and counselling guidelines,
- free-text feedback comments at scale (themes, sentiment).

That is on the roadmap, not needed to meet the brief.

## Responsible AI
- Protected attributes are excluded from all models and only used to monitor parity (four-fifths rule check in the app).
- The LLM receives student IDs and numbers only: no names, emails or protected attributes.
- Every flag shows its drivers; a human (mentor) always decides the action.
