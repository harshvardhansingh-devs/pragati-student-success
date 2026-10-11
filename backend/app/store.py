"""Runs the pipeline, persists analytics tables, and serves a per-process cache of them."""
import json
import threading
import time
from datetime import datetime, timezone

import pandas as pd
from sqlalchemy import text

from . import pipeline, scoring
from .db import engine, has_table, init_app_tables

PIPELINE_VERSION = 3  # bump when scoring logic changes → deployed instances re-score on boot
JSON_COLS = ["academic_drivers", "placement_drivers", "academic_rules", "placement_rules"]
_lock = threading.Lock()
_state = {"run_id": None, "checked": 0.0}


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get_weights():
    with engine.connect() as c:
        row = c.execute(text("SELECT version, weights FROM app_weight_configs ORDER BY version DESC LIMIT 1")).first()
    return (row[0], json.loads(row[1])) if row else (0, dict(scoring.DEFAULT_WEIGHTS))


def save_weights(weights, user):
    v, _ = get_weights()
    with engine.begin() as c:
        c.execute(text("INSERT INTO app_weight_configs VALUES (:v, :w, :u, :t)"), dict(v=v + 1, w=json.dumps(weights), u=user, t=now()))
    return v + 1


def run_pipeline():
    started = now()
    t0 = time.time()
    data = pipeline.run()
    version, weights = get_weights()
    scores, history, models, seg_info, _ = scoring.score_all(data["static"], data["weekly"], data["labels"], weights)
    persisted = scores.copy()
    for c in JSON_COLS:
        persisted[c] = persisted[c].map(json.dumps)
    tables = {
        "an_scores": persisted, "an_weekly_scores": history, "an_weekly_features": data["weekly"],
        "an_data_quality": data["quality"], "an_subject_stats": data["subject_stats"], "an_sgpa_history": data["sgpa_hist"],
        "an_insights": pd.DataFrame(scoring.insights(scores, data["subject_stats"])),
    }
    for name, df in tables.items():
        df.to_sql(name, engine, if_exists="replace", index=False, chunksize=2000)
    summary = dict(version=PIPELINE_VERSION, students=len(scores), seconds=round(time.time() - t0, 1), segments=seg_info,
                   models={k: m.metrics for k, m in models.items()})
    with engine.begin() as c:
        rid = (c.execute(text("SELECT COALESCE(MAX(run_id), 0) FROM app_pipeline_runs")).scalar() or 0) + 1
        c.execute(text("INSERT INTO app_pipeline_runs VALUES (:r, :s, :f, :v, :j)"),
                  dict(r=rid, s=started, f=now(), v=version, j=json.dumps(summary)))
    _state["checked"] = 0.0
    return summary


def bootstrap():
    init_app_tables()
    if not has_table("raw_erp_students"):
        pipeline.load_raw_csvs()
    with engine.connect() as c:
        last = c.execute(text("SELECT summary FROM app_pipeline_runs ORDER BY run_id DESC LIMIT 1")).scalar()
    if not last or not has_table("an_scores") or json.loads(last).get("version") != PIPELINE_VERSION:
        run_pipeline()


def table(name):
    df = pd.read_sql_table(name, engine)
    df.columns = [str(c) for c in df.columns]
    return df


def _load(run_id):
    scores = table("an_scores")
    for c in JSON_COLS:
        scores[c] = scores[c].map(json.loads)
    labels = table("raw_outcome_labels")
    labels["student_id"] = labels.student_id.map(pipeline.norm_id)
    labels = labels.set_index("student_id").astype(int)
    feats = scores.set_index("student_id")
    models = {k: scoring.RiskModel(k, feats, labels) for k in ("academic", "placement")}
    dom = feats[[f"d_{d}" for d in scoring.DOMAINS]].rename(columns=lambda c: c[2:])
    with engine.connect() as c:
        summary = json.loads(c.execute(text("SELECT summary FROM app_pipeline_runs WHERE run_id=:r"), dict(r=run_id)).scalar())
        finished = c.execute(text("SELECT finished_at FROM app_pipeline_runs WHERE run_id=:r"), dict(r=run_id)).scalar()
    return dict(
        run_id=run_id, finished_at=finished, summary=summary, scores=scores, models=models, ref=(dom, feats[["dept", "year"]]),
        history=table("an_weekly_scores"), quality=table("an_data_quality"),
        subjects=table("an_subject_stats"), sgpa=table("an_sgpa_history"),
        insights=table("an_insights").to_dict("records"), weights=get_weights(),
    )


def state():
    # ponytail: per-process cache, re-checked every 10s so multiple instances pick up new runs; move to SQL queries past ~100k students
    if time.time() - _state["checked"] > 10:
        with _lock:
            with engine.connect() as c:
                rid = c.execute(text("SELECT MAX(run_id) FROM app_pipeline_runs")).scalar()
            if rid != _state["run_id"]:
                _state.update(_load(rid))
            _state["checked"] = time.time()
    return _state
