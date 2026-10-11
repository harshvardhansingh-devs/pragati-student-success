# Run your own copy of Prajna

This guide sets up a fully independent copy: your own GitHub repo, database, hosting and AI keys. It takes about 30 minutes, and every service used here has a free tier.

> **Hackathon rule:** HacXLerate disqualifies teams that submit another team's work (rulebook §26). Only share this within your registered team, or use it after the event.

## 1. Accounts you need (all free)
| Service | Used for | Sign up |
|---|---|---|
| GitHub | Your copy of the code | github.com |
| Supabase | PostgreSQL database | supabase.com |
| Render | Hosting the app | render.com (sign in with GitHub) |
| Groq | AI Copilot, 1st choice (fastest) | console.groq.com → API Keys |
| OpenRouter | AI fallback | openrouter.ai → Keys |
| Google AI Studio | AI fallback (Gemini) | aistudio.google.com → Get API key |

Any **one** AI key is enough. With none, everything works except the Copilot, and mentor briefs use a built-in template.

## 2. Copy the code to your GitHub
On https://github.com/harshvardhansingh-devs/pragati-student-success click **Fork** (or **Use this template → Create a new repository**). Keep it **Public** so evaluators can open it.

To work on it locally (needs Python 3.12+, Node 20+, Git):
```bash
git clone https://github.com/<your-username>/pragati-student-success.git
cd pragati-student-success
git config user.name "<your-username>"
git config user.email "<your-github-noreply-email>"
```

## 3. Create your database (Supabase)
1. **New project** → name it, set a database password, region **Mumbai (ap-south-1)**.
2. When it's ready: **Connect → Session pooler** → copy the URI (port **5432**).
3. Replace `[YOUR-PASSWORD]` in it with your database password. That's your `DATABASE_URL`.

## 4. Run it locally (optional but recommended)
```bash
cp .env.example .env        # then edit .env and paste your keys (never commit .env; it's git-ignored)
python -m venv .venv
.venv/Scripts/pip install -r backend/requirements.txt        # macOS/Linux: .venv/bin/pip
cd frontend && npm install && npm run build && cd ..
.venv/Scripts/python -m uvicorn app.main:app --app-dir backend --port 8000
```
Open http://localhost:8000. Leave `DATABASE_URL` empty in `.env` to use a local SQLite file; set it to test against Supabase.

## 5. Deploy (Render)
1. Render → **New → Blueprint** → choose **your** repo. It reads `render.yaml` and the `Dockerfile`.
2. Fill in the environment variables: `DATABASE_URL` (step 3), and `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY` (any you have). `JWT_SECRET` is generated for you.
3. **Apply**. The first build takes about 8 minutes. On first boot the app loads the demo data into your Supabase and scores every student.
4. You get your own URL, like `https://pragati-xxxx.onrender.com`. Every later push to `main` redeploys automatically.

Check: `https://<your-url>/api/v1/health` should list your AI providers.

## 6. Make it yours
- **Keep-alive:** GitHub repo → Settings → Secrets and variables → Actions → **Variables** → New: `APP_URL` = your Render URL (no trailing slash). Then **Actions → keep-alive → Run workflow** once to test it. Forks have Actions off by default; enable them on the Actions tab.
- **README:** replace the "Live demo" and repo links with yours.
- **Docs:** update the links in `docs/SUBMISSION.md`, `docs/DEMO_PLAN.md` and `docs/RULES_COMPLIANCE.md`.
- **Slides:** the deck is a separate file; ask its owner to share or export it, then update the links on the last slide.
- **Demo logins:** keep the default password `Prajna@2026` (5 roles: admin, hod.cse, mentor, tpo, student `@prajna.demo`). The login page's one-click buttons rely on it.

## 7. Troubleshooting
| Symptom | Fix |
|---|---|
| Copilot says "needs at least one key" | No AI key set on Render. Add one, then redeploy |
| AI brief says "rule-based template" | The provider's free model was retired. Set `GROQ_MODEL` / `OPENROUTER_MODEL` / `GEMINI_MODEL` to a current model and redeploy |
| Render build fails on `npm ci` | Commit `frontend/package-lock.json` (it must be in the repo) |
| First page load is slow after a deploy | Normal for about 10 s while the app warms up; the keep-alive prevents sleeping afterwards |
| Want fresh demo data | `python backend/scripts/generate_data.py`, then drop the `raw_*`, `an_*` and `app_pipeline_runs` tables in Supabase and redeploy |
