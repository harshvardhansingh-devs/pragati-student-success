import io
import json
import math
from contextlib import asynccontextmanager
from datetime import date, timedelta

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import text

from . import ai, auth, pipeline, scoring, store
from .auth import current_user, require_admin, scope, staff_only
from .db import ROOT, engine


@asynccontextmanager
async def lifespan(_):
    store.bootstrap()
    store.state()  # warm the cache before serving, so the first visitor never waits
    yield


app = FastAPI(title="Prajna — Student Success Intelligence API", version="1.0.0", lifespan=lifespan,
              docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
api = APIRouter(prefix="/api/v1")

LIST_COLS = ["student_id", "name", "dept", "year", "section", "mentor_id", "success_score", "band", "cohort_percentile", "trend_4w",
             "sliding", "academic_risk", "academic_risk_prob", "placement_risk", "placement_risk_prob", "segment", "cgpa",
             "attendance_term", "coding", "low_confidence"]
SOURCE_OF = {"cgpa": "Academic", "active_backlogs": "Academic", "sgpa_trend": "Academic", "internal_avg": "Academic",
             "weakest_subject": "Academic", "faculty_rating": "Feedback", "attendance_term": "Attendance", "attendance_recent": "Attendance",
             "subjects_below_75": "Attendance", "logins_per_week": "LMS", "assignment_completion": "LMS", "on_time_rate": "LMS",
             "quiz_avg": "LMS", "aptitude": "Placement", "coding": "Placement", "mock_interviews": "Placement", "mock_rating": "Placement",
             "technical": "Skills", "soft_skills": "Skills", "certifications": "Skills / Engagement", "activities": "Engagement",
             "leadership": "Engagement", "satisfaction": "Feedback"}


def clean(o):
    """JSON-safe: NaN → None, numpy → python."""
    if isinstance(o, dict):
        return {k: clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating, float)):
        return None if math.isnan(o) else round(float(o), 3)
    if isinstance(o, np.bool_):
        return bool(o)
    return o


def records(df):
    return clean(df.to_dict("records"))


def scores(user):
    return scope(store.state()["scores"], user)


def audit(user, action, entity, eid):
    with engine.begin() as c:
        c.execute(text("INSERT INTO app_audit_log (user_email, action, entity, entity_id, at) VALUES (:u,:a,:e,:i,:t)"),
                  dict(u=user["email"], a=action, e=entity, i=eid, t=store.now()))


def interventions_df():
    return pd.read_sql(text("SELECT * FROM app_interventions ORDER BY id DESC"), engine)


def apply_filters(df, dept=None, year=None, section=None, band=None, academic_risk=None, placement_risk=None,
                  segment=None, sliding=None, q=None, mentor_id=None, below_75=None):
    for col, v in [("dept", dept), ("section", section), ("band", band), ("academic_risk", academic_risk),
                   ("placement_risk", placement_risk), ("mentor_id", mentor_id)]:
        if v:
            df = df[df[col].isin(v.split(","))]  # comma = OR
    if segment:
        df = df[df.segment == segment]  # segment names contain commas, so exact match only
    if year:
        df = df[df.year.isin([int(y) for y in str(year).split(",")])]
    if sliding is not None:
        df = df[df.sliding == sliding]
    if below_75:
        df = df[df.attendance_term < 75]
    if q:
        df = df[df.name.str.contains(q, case=False) | df.student_id.str.contains(q, case=False)]
    return df


# --- Auth ----------------------------------------------------------------------------------------
class Login(BaseModel):
    email: str
    password: str


@api.post("/auth/login")
def login(body: Login):
    return auth.login(body.email, body.password)


@api.get("/auth/me")
def me(user=Depends(current_user)):
    return user


@api.get("/auth/demo-accounts")
def demo_accounts():
    return [dict(email=e, role=u["role"], title=u["title"]) for e, u in auth.USERS.items()]


# --- Dashboard ---------------------------------------------------------------------------------------
@api.get("/overview")
def overview(user=Depends(staff_only)):
    st = store.state()
    df = scores(user)
    iv = interventions_df()
    iv = iv[iv.student_id.isin(df.student_id)]
    hist = st["history"].merge(df[["student_id", "dept"]], on="student_id")
    trend = hist.groupby(["week", "dept"]).success_score.mean().round(1).unstack()
    trend_all = hist.groupby("week").success_score.mean().round(1)
    by_dept = df.groupby("dept").agg(
        students=("student_id", "count"), avg_score=("success_score", "mean"),
        academic_high=("academic_risk", lambda s: int((s == "High").sum())),
        placement_high=("placement_risk", lambda s: int((s == "High").sum())),
        sliding=("sliding", "sum"), below_75=("attendance_term", lambda s: int((s < 75).sum()))).round(1).reset_index()
    band_dept = pd.crosstab(df.dept, df.band).reindex(columns=[b for _, b in scoring.BANDS], fill_value=0)
    heat = df.groupby(["dept", "year"]).success_score.mean().round(1).reset_index()
    top = df.sort_values(["academic_risk_prob"], ascending=False)
    priority = df.assign(p=np.maximum(df.academic_risk_prob, df.placement_risk_prob) + df.sliding * 0.3).sort_values("p", ascending=False).head(8)
    return clean(dict(
        kpis=dict(students=len(df), avg_success_score=df.success_score.mean(),
                  bands={b: int((df.band == b).sum()) for _, b in scoring.BANDS},
                  academic_high=int((df.academic_risk == "High").sum()), placement_high=int((df.placement_risk == "High").sum()),
                  academic_medium=int((df.academic_risk == "Medium").sum()), placement_medium=int((df.placement_risk == "Medium").sum()),
                  sliding=int(df.sliding.sum()), below_75=int((df.attendance_term < 75).sum()),
                  needs_attention=int(((df.academic_risk == "High") | (df.placement_risk == "High")).sum()),
                  senior_placement_high=int(((df.year >= 3) & (df.placement_risk == "High")).sum()),
                  star_unready=int((df.segment == "Academic Star, Placement-Unready").sum()),
                  open_interventions=int((iv.status != "done").sum()) if len(iv) else 0, sources=len(pipeline.SOURCES) - 1),
        by_dept=records(by_dept),
        band_by_dept=dict(depts=list(band_dept.index), bands=list(band_dept.columns), values=band_dept.values.tolist()),
        heatmap=records(heat),
        trend=dict(weeks=[int(w) for w in trend.index], series={d: trend[d].tolist() for d in trend.columns}, overall=trend_all.tolist()),
        segments=records(df.groupby("segment").agg(students=("student_id", "count"), avg_score=("success_score", "mean")).round(1).reset_index()),
        priority=records(priority[LIST_COLS]),
        insights=st["insights"] if user["role"] in ("admin", "tpo") else scoped_insights(df, st),
        as_of=st["finished_at"], weights_version=st["weights"][0],
    ))


def scoped_insights(df, st):
    subj = st["subjects"]
    subj = subj[subj.dept.isin(df.dept.unique())]
    return scoring.insights(df, subj) if len(df) > 5 else []


@api.get("/trends")
def trends(group_by: str = "dept", metric: str = "success_score", user=Depends(staff_only)):
    if group_by not in ("dept", "year", "segment", "band") or metric not in ["success_score"] + scoring.DOMAINS:
        raise HTTPException(400, "Unsupported group_by or metric")
    df = scores(user)
    h = store.state()["history"].merge(df[["student_id", group_by]], on="student_id")
    t = h.groupby(["week", group_by])[metric].mean().round(1).unstack()
    return clean(dict(weeks=[int(w) for w in t.index], series={str(c): t[c].tolist() for c in t.columns}))


@api.get("/hotspots/subjects")
def hotspots(user=Depends(staff_only)):
    df = scores(user)
    s = store.state()["subjects"]
    s = s[s.dept.isin(df.dept.unique())].sort_values("fail_rate", ascending=False)
    return records(s.head(15))


# --- Students -------------------------------------------------------------------------------------
@api.get("/students")
def list_students(dept: str = None, year: str = None, section: str = None, band: str = None, academic_risk: str = None,
                  placement_risk: str = None, segment: str = None, sliding: bool = None, q: str = None, mentor_id: str = None,
                  below_75: bool = None, focus: str = None, sort: str = "-academic_risk_prob", page: int = 1, size: int = 25,
                  user=Depends(staff_only)):
    df = apply_filters(scores(user), dept, year, section, band, academic_risk, placement_risk, segment, sliding, q, mentor_id, below_75)
    key = sort.lstrip("-")
    if key in df.columns:
        df = df.sort_values(key, ascending=not sort.startswith("-"), na_position="last")
    size = max(1, min(size, 200))
    out = df.iloc[(page - 1) * size: page * size].copy()
    def top(r):  # driver of the risk being viewed (focus), else of the more likely risk
        kinds = ["placement", "academic"] if focus == "placement" or (focus != "academic" and r["placement_risk_prob"] > r["academic_risk_prob"]) else ["academic", "placement"]
        for k in kinds:
            if r[f"{k}_risk"] != "Low" and r[f"{k}_drivers"]:
                label = r[f"{k}_drivers"][0]["label"]
                return label if focus else f"{label} ({k})"
        return None
    out["top_driver"] = [top(r) for r in out.to_dict("records")] if len(out) else []
    return clean(dict(total=len(df), page=page, size=size, items=records(out[LIST_COLS + ["top_driver"]])))


def get_row(sid, user):
    df = scores(user)
    m = df[df.student_id == sid]
    if m.empty:
        raise HTTPException(404, f"Student {sid} not found or not in your scope")
    return m.iloc[0].to_dict()


def recommendations(s):
    seen, out = set(), []
    drivers = [(d, "academic") for d in s["academic_drivers"]] + [(d, "placement") for d in s["placement_drivers"]]
    if s["academic_rules"]:
        drivers.insert(0, ({"feature": "attendance_term" if "Attendance" in s["academic_rules"][0] else "active_backlogs",
                            "label": s["academic_rules"][0]}, "academic"))
    for d, kind in drivers:
        if kind == "academic" and s["academic_risk"] == "Low" or kind == "placement" and s["placement_risk"] == "Low":
            continue
        action, owner = scoring.action_for(d["feature"])
        if action not in seen:
            seen.add(action)
            out.append(dict(action=action, owner=owner, reason=f"{d['label']} ({kind} risk)", risk=kind))
    if s["segment"] in scoring.SEGMENTS and len(out) < 4:
        out.append(dict(action=scoring.SEGMENTS[s["segment"]][1], owner="Mentor", reason=f"Segment playbook: {s['segment']}", risk="segment"))
    return out


@api.get("/students/{sid}")
def student(sid: str, user=Depends(current_user)):
    st = store.state()
    s = get_row(sid, user)
    df = st["scores"]
    cohort = df[(df.dept == s["dept"]) & (df.year == s["year"])]
    indicators = [dict(feature=f, label=v[4], domain=v[0], source=SOURCE_OF[f], value=s.get(f),
                       cohort_median=cohort[f].median(), lo=v[1], hi=v[2], higher_is_better=v[3] > 0)
                  for f, v in scoring.INDICATORS.items()]
    hist = st["history"][st["history"].student_id == sid].sort_values("week")
    cohort_hist = st["history"][st["history"].student_id.isin(cohort.student_id)].groupby("week").success_score.mean().round(1)
    iv = interventions_df()
    audit(user, "view", "student", sid)
    profile_cols = ["student_id", "name", "email", "roll_no", "dept", "program", "year", "section", "mentor_id", "comments"]
    return clean(dict(
        profile={k: s.get(k) for k in profile_cols},
        score=dict(success_score=s["success_score"], band=s["band"], cohort_percentile=s["cohort_percentile"], trend_4w=s["trend_4w"],
                   sliding=s["sliding"], completeness=s["completeness"], low_confidence=s["low_confidence"], segment=s["segment"],
                   domains={d: s[f"d_{d}"] for d in scoring.DOMAINS},
                   cohort_domains={d: cohort[f"d_{d}"].mean() for d in scoring.DOMAINS}, cohort_avg=cohort.success_score.mean()),
        risk={k: dict(tier=s[f"{k}_risk"], probability=s[f"{k}_risk_prob"], rules=s[f"{k}_rules"], drivers=s[f"{k}_drivers"])
              for k in ("academic", "placement")},
        explanation=scoring.explain_score(s, st["weights"][1], cohort),
        indicators=indicators,
        history=dict(weeks=hist.week.tolist(), score=hist.success_score.tolist(), cohort=cohort_hist.reindex(hist.week).tolist(),
                     domains={d: hist[d].tolist() for d in scoring.DOMAINS}),
        sgpa=records(st["sgpa"][st["sgpa"].student_id == sid].sort_values("semester")),
        recommendations=recommendations(s),
        interventions=records(iv[iv.student_id == sid]),
        segment_playbook=scoring.SEGMENTS.get(s["segment"], (None, None))[1],
    ))


class Simulate(BaseModel):
    overrides: dict[str, float]


@api.post("/students/{sid}/simulate")
def simulate(sid: str, body: Simulate, user=Depends(current_user)):
    st = store.state()
    s = get_row(sid, user)
    bad = [k for k in body.overrides if k not in scoring.INDICATORS]
    if bad:
        raise HTTPException(400, f"Unknown indicators: {bad}")
    row = {k: s[k] for k in ["student_id", "dept", "year"] + list(scoring.INDICATORS) + ["attendance_trend", "lms_trend"]}
    before = scoring.simulate(row, {}, st["weights"][1], st["models"], st["ref"])
    after = scoring.simulate(row, body.overrides, st["weights"][1], st["models"], st["ref"])
    return clean(dict(before=before, after=after))


@api.post("/students/{sid}/brief")
def mentor_brief(sid: str, user=Depends(current_user)):
    s = get_row(sid, user)
    return ai.brief(s, [r["action"] for r in recommendations(s)], audience="student" if user["role"] == "student" else "mentor")


# --- Segments, fairness, model ----------------------------------------------------------------------
@api.get("/segments")
def segments(user=Depends(staff_only)):
    df = scores(user)
    out = []
    for name, (proto, playbook) in scoring.SEGMENTS.items():
        g = df[df.segment == name]
        out.append(dict(segment=name, playbook=playbook, students=len(g), avg_score=g.success_score.mean() if len(g) else None,
                        domains={d: g[f"d_{d}"].mean() if len(g) else None for d in scoring.DOMAINS},
                        academic_high=int((g.academic_risk == "High").sum()), placement_high=int((g.placement_risk == "High").sum()),
                        by_dept=g.dept.value_counts().to_dict()))
    return clean(dict(segments=out, method=store.state()["summary"]["segments"]))


@api.get("/fairness")
def fairness(user=Depends(staff_only)):
    return clean(scoring.fairness(scores(user)))


@api.get("/model")
def model_info(user=Depends(current_user)):
    st = store.state()
    return clean(dict(
        weights_version=st["weights"][0], weights=st["weights"][1], early_year_shift=scoring.EARLY_YEAR_SHIFT,
        indicators=[dict(feature=f, domain=v[0], lo=v[1], hi=v[2], direction="higher is better" if v[3] > 0 else "lower is better",
                         label=v[4], source=SOURCE_OF[f]) for f, v in scoring.INDICATORS.items()],
        domains=scoring.DOMAIN_LABELS, bands=[dict(min=t, band=b) for t, b in scoring.BANDS],
        risk=dict(high=scoring.HIGH, medium=scoring.MEDIUM, features=scoring.RISK_FEATURES,
                  metrics={k: m.metrics for k, m in st["models"].items()}),
        run=dict(run_id=st["run_id"], finished_at=st["finished_at"], **st["summary"]),
    ))


# --- Interventions ----------------------------------------------------------------------------------
class NewIntervention(BaseModel):
    student_ids: list[str] = Field(min_length=1, max_length=500)
    action: str = Field(min_length=3, max_length=200)
    reason: str | None = Field(None, max_length=300)
    owner: str | None = Field(None, max_length=100)
    due_in_days: int = Field(14, ge=1, le=180)
    notes: str | None = Field(None, max_length=2000)


class PatchIntervention(BaseModel):
    status: str | None = Field(None, pattern="^(open|in_progress|done)$")
    notes: str | None = Field(None, max_length=2000)


@api.get("/interventions")
def list_interventions(status: str = None, user=Depends(staff_only)):
    df = scores(user)
    iv = interventions_df()
    iv = iv[iv.student_id.isin(df.student_id)]
    if status:
        iv = iv[iv.status == status]
    iv = iv.merge(df[["student_id", "name", "dept", "year", "success_score", "band", "academic_risk", "placement_risk"]], on="student_id", how="left")
    iv["score_change"] = (iv.success_score - iv.score_at_creation).round(1)
    summary = iv.groupby("action").agg(count=("id", "count"), done=("status", lambda s: int((s == "done").sum()))).reset_index()
    return clean(dict(items=records(iv), by_action=records(summary)))


@api.post("/interventions")
def create_interventions(body: NewIntervention, user=Depends(staff_only)):
    df = scores(user).set_index("student_id")
    missing = [s for s in body.student_ids if s not in df.index]
    if missing:
        raise HTTPException(404, f"Not in your scope: {missing[:5]}")
    due = (date.today() + timedelta(days=body.due_in_days)).isoformat()
    t = store.now()
    with engine.begin() as c:
        for sid in body.student_ids:
            c.execute(text("""INSERT INTO app_interventions (student_id, action, reason, owner, status, due_date, notes,
                              score_at_creation, created_by, created_at, updated_at)
                              VALUES (:s,:a,:r,:o,'open',:d,:n,:sc,:u,:t,:t)"""),
                      dict(s=sid, a=body.action, r=body.reason, o=body.owner, d=due, n=body.notes,
                           sc=float(df.loc[sid, "success_score"]), u=user["name"], t=t))
    return {"created": len(body.student_ids)}


@api.patch("/interventions/{iid}")
def update_intervention(iid: int, body: PatchIntervention, user=Depends(staff_only)):
    iv = interventions_df()
    row = iv[iv.id == iid]
    if row.empty or row.iloc[0].student_id not in set(scores(user).student_id):
        raise HTTPException(404, "Intervention not found")
    with engine.begin() as c:
        if body.status:
            c.execute(text("UPDATE app_interventions SET status=:s, updated_at=:t WHERE id=:i"), dict(s=body.status, t=store.now(), i=iid))
        if body.notes is not None:
            c.execute(text("UPDATE app_interventions SET notes=:n, updated_at=:t WHERE id=:i"), dict(n=body.notes, t=store.now(), i=iid))
    return {"ok": True}


# --- Data integration & config ------------------------------------------------------------------------
@api.get("/data-quality")
def data_quality(user=Depends(staff_only)):
    st = store.state()
    return clean(dict(sources=records(st["quality"]), run=dict(run_id=st["run_id"], finished_at=st["finished_at"], **st["summary"]),
                      steps=["Ingest raw files (append-only raw_* tables)", "Validate types & ranges → quarantine bad values",
                             "Normalise IDs across systems (ID / roll no / email)", "De-duplicate repeated uploads",
                             "Integrate into one Student 360 record", "Weekly feature snapshots & trends",
                             "Score → predict risk → explain → segment"]))


@api.post("/ingest/upload")
async def upload(source: str = Form(...), file: UploadFile = File(...), user=Depends(require_admin)):
    if source not in pipeline.SOURCES:
        raise HTTPException(400, f"source must be one of {list(pipeline.SOURCES)}")
    raw = await file.read()
    if len(raw) > 20_000_000:
        raise HTTPException(413, "File too large (max 20 MB)")
    try:
        df = pd.read_csv(io.BytesIO(raw), dtype=str)
    except Exception:
        raise HTTPException(422, "Could not parse CSV")
    expected = set(pd.read_sql(text(f"SELECT * FROM raw_{source} LIMIT 1"), engine).columns)
    if not expected.issubset(df.columns):
        raise HTTPException(422, f"Missing columns: {sorted(expected - set(df.columns))}")
    old = pipeline.read_raw(source)
    df[list(expected)].to_sql(f"raw_{source}", engine, if_exists="replace", index=False)
    try:
        summary = store.run_pipeline()
    except Exception as e:  # never leave the platform broken by a bad file
        old.to_sql(f"raw_{source}", engine, if_exists="replace", index=False)
        store.run_pipeline()
        raise HTTPException(422, f"Pipeline failed on this file, previous data restored: {e}")
    audit(user, "upload", "source", source)
    return clean(dict(rows=len(df), summary=summary))


@api.get("/config/weights")
def get_weights(user=Depends(current_user)):
    v, w = store.get_weights()
    return dict(version=v, weights=w, defaults=scoring.DEFAULT_WEIGHTS)


class Weights(BaseModel):
    weights: dict[str, float]


@api.put("/config/weights")
def put_weights(body: Weights, user=Depends(require_admin)):
    w = body.weights
    if set(w) != set(scoring.DOMAINS) or any(v < 0 for v in w.values()) or abs(sum(w.values()) - 1) > 0.01:
        raise HTTPException(400, f"Provide non-negative weights for {scoring.DOMAINS} summing to 1")
    v = store.save_weights(w, user["email"])
    summary = store.run_pipeline()
    audit(user, "update", "weights", str(v))
    return clean(dict(version=v, summary=summary))


class Question(BaseModel):
    question: str = Field(min_length=1, max_length=500)


@api.post("/copilot/query")
def copilot(body: Question, user=Depends(staff_only)):
    return clean(ai.copilot(body.question, scores(user)))


@api.get("/health")
def health():
    return {"status": "ok", "ai_providers": ai.enabled()}


app.include_router(api)

# --- Frontend (built SPA) -------------------------------------------------------------------------
DIST = ROOT / "frontend" / "dist"


@app.get("/{path:path}", include_in_schema=False)
def spa(path: str):
    if path.startswith("api/"):
        raise HTTPException(404)
    f = DIST / path
    if path and f.is_file() and DIST in f.resolve().parents:
        return FileResponse(f)
    if (DIST / "index.html").exists():
        return FileResponse(DIST / "index.html")
    return {"message": "Prajna API running. Frontend not built; see /api/docs"}
