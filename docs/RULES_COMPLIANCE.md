# Rulebook Compliance Checklist (HacXLerate 2026, Round 1)

Source: `HacXLerate_2026_Virtual Round 1_RuleBook.pdf`

## Hard rules (disqualification if broken)
| Rule | What we do | Status |
|---|---|---|
| Problem selected and locked by the **Team Lead** within the **first 2 hours** | Team Lead locks "AI-Powered Student Analytics and Success Platform" | ☐ |
| Locked problem cannot change (it carries through Round 2 and the Finale) | Build only for this PS | ☐ |
| 3–5 registered members; no unauthorised member changes | Only registered members commit and submit | ☐ |
| **All mandatory functionalities work** (automated evaluation runs first; failing it means no human evaluation) | See the "Mandatory functionality map" below; P0 is built first | ☐ |
| Deployed link and GitHub link are **valid and accessible** | Public repo (or evaluators given access); public deployment URL, tested in an incognito window | ☐ |
| Submit before the deadline (24 h from the college's start time); no late submissions | Submit an early working version, then resubmit improvements | ☐ |
| Original work, contributions represented honestly | Our own code; open-source libraries are allowed. AI use is allowed and we disclose it | ☐ |
| No manipulation of the platform or automated evaluation | Real features only; no hard-coded responses aimed at the checker | ☐ |

## Submission package
| Item | Where |
|---|---|
| Project title, summary, solution description | README + platform form |
| GitHub repo (code, README, tech stack, implementation details) | repo root `README.md`, `/docs` |
| **Working deployment link** (Nimbus by byteXL is encouraged, but any host is allowed) | ☐ URL |
| **Test logins / credentials + evaluator notes** | README "For Evaluators" section with demo accounts per role |
| Challenge deliverables: dashboard prototype, Success Score note, short demo/slides | App, `docs/SUCCESS_SCORE.md`, slides/video link |

## Mandatory functionality map (what the auto-evaluator is likely to check)
| Brief requirement | Feature | Must be visible at |
|---|---|---|
| Data integration (Academic, Attendance, LMS, Engagement, Placement, Skills, Feedback) → unified view | F1–F4 | Data Quality page + Student 360 |
| Student Success Score | F5 | Student list + Student 360 |
| At-risk: poor academic performance | F6 (academic risk) | Risk page / filters |
| At-risk: poor placement outcomes | F6 (placement risk) | Risk page / filters |
| Interactive dashboard: scores, risk flags, key trends, student insights | F7, F10, F16 | Overview |
| Bonus: segmentation | F8 | Segments page |
| Bonus: explainable score | F9 | Student 360 |

Use the exact brief wording as UI labels ("Student Success Score", "Risk Flag", "At-Risk: Academic", "At-Risk: Placement", "Segments", "Key Trends"), so both the automated checker and the human evaluators can find each requirement.

## AI usage
Allowed without restriction, but **every team member must be able to explain the solution**. Before submitting, each member should walk through the score formula, the risk model and the architecture.

## Before-deadline checklist
- [ ] Deployed link works (incognito, on mobile)
- [ ] GitHub link works and the repo is accessible
- [ ] All mandatory features work on the deployed version
- [ ] Test credentials work
- [ ] All platform fields completed
- [ ] Latest version submitted and verified
