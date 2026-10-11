# API Reference (v1)

Base URL: `/api/v1` · Auth: `Authorization: Bearer <JWT>` from `/auth/login` · Interactive docs: **`/api/docs`** (OpenAPI).
Every response is automatically restricted to the caller's scope (an HoD sees only their department, a mentor only their mentees).

## Auth
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | `{email, password}` → `{token, user}` |
| GET | `/auth/me` | Current user + scope |
| GET | `/auth/demo-accounts` | Demo role list (no passwords) |

## Dashboard
| Method | Path | Purpose |
|---|---|---|
| GET | `/overview` | KPIs, weekly trend by dept, band × dept, dept × year heatmap, risk by dept, segments, priority students, insights |
| GET | `/trends?group_by=dept\|year\|segment\|band&metric=success_score\|<domain>` | Weekly series |
| GET | `/hotspots/subjects` | Current-semester subjects ranked by fail rate |

## Students
| Method | Path | Purpose |
|---|---|---|
| GET | `/students?dept=&year=&section=&band=&academic_risk=High,Medium&placement_risk=&segment=&sliding=true&q=&mentor_id=&sort=-academic_risk_prob&page=1&size=25` | Filtered, sorted, paged list (comma = OR) |
| GET | `/students/{id}` | Student 360: profile, score, domains vs cohort, both risks with rules and drivers, score explanation, 23 indicators by source, weekly history, SGPA history, recommendations, interventions |
| POST | `/students/{id}/simulate` | What-if: `{"overrides": {"coding": 60, "mock_interviews": 2}}` → `{before, after}` |
| POST | `/students/{id}/brief` | AI mentor brief (template fallback when no AI key) |

## Segments, model, fairness
| Method | Path | Purpose |
|---|---|---|
| GET | `/segments` | 6 segments with size, domain profile, playbook, risk counts, silhouette |
| GET | `/model` | Weights, indicators and ranges, bands, risk thresholds, model metrics (AUC, recall, coefficients), last run |
| GET | `/fairness` | Flag rates and four-fifths parity by gender and admission category |

## Interventions
| Method | Path | Purpose |
|---|---|---|
| GET | `/interventions?status=open\|in_progress\|done` | Items with score at creation vs now, plus counts by action |
| POST | `/interventions` | `{student_ids[], action, owner?, reason?, due_in_days, notes?}` (bulk supported) |
| PATCH | `/interventions/{id}` | `{status?, notes?}` |

## Data & configuration
| Method | Path | Purpose |
|---|---|---|
| GET | `/data-quality` | Per-source rows, duplicates, IDs reconciled, unmatched, repaired, quarantined, coverage, completeness; pipeline steps; last run |
| POST | `/ingest/upload` (admin) | multipart `source`, `file` (CSV) → replace raw source, re-run pipeline (rolls back on failure) |
| GET | `/config/weights` | Current version + defaults |
| PUT | `/config/weights` (admin) | `{"weights": {academic, attendance, lms, placement, skills, engagement}}`, summing to 1 → new version + full re-score |

## AI Copilot
| Method | Path | Purpose |
|---|---|---|
| POST | `/copilot/query` | `{"question": "..."}` → `{answer, table, tools_used, provider}` |

The LLM (Gemini, Groq or OpenRouter, first available) gets two **read-only tools**, `search_students(filters, sort_by, limit)` and `group_summary(group_by, filters)`, executed server-side inside the user's scope. No free-form SQL. Only IDs and numbers are sent.

## Health
`GET /health` → `{"status": "ok", "ai_providers": ["Gemini", "Groq", ...]}`

## Examples

```bash
TOKEN=$(curl -s -X POST localhost:8000/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@pragati.demo","password":"Pragati@2026"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s localhost:8000/api/v1/students?placement_risk=High\&year=4\&size=5 -H "Authorization: Bearer $TOKEN"
curl -s -X POST localhost:8000/api/v1/students/CS22-0155/simulate -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"overrides":{"coding":60,"mock_interviews":2}}'
```

Errors: `{"detail": "..."}` with 400 (validation), 401 (not signed in), 403 (role not permitted), 404 (not found or out of scope), 413/422 (bad upload), 502 (AI service error).
