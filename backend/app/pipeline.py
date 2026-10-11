"""Ingest → validate → clean → integrate → weekly feature snapshots.

Raw source tables (raw_<source>) are stored as uploaded; everything downstream is recomputable.
"""
import re

import numpy as np
import pandas as pd

from .db import ROOT, engine

SOURCES = {
    "erp_students": "Student master (ERP)",
    "academic": "Academic / exams (ERP)",
    "attendance": "Attendance (biometric)",
    "lms": "LMS activity (Moodle)",
    "engagement": "Clubs, events & certifications",
    "placement": "Placement cell assessments",
    "skills": "Skill assessments",
    "feedback": "Student & faculty feedback",
}
RAW_DIR = ROOT / "data" / "raw"
WEEKS = 12
ID_RE = re.compile(r"^\s*([A-Za-z]{2})\s*-?\s*(\d{2})\s*-?\s*(\d{3,4})\s*$")


def load_raw_csvs():
    """Seed raw_* tables from data/raw CSVs (first boot)."""
    for name in list(SOURCES) + ["outcome_labels"]:
        pd.read_csv(RAW_DIR / f"{name}.csv", dtype=str).to_sql(f"raw_{name}", engine, if_exists="replace", index=False)


def read_raw(name):
    df = pd.read_sql_table(f"raw_{name}", engine)
    df.columns = [str(c) for c in df.columns]  # SQLAlchemy quoted_name → str
    return df


def norm_id(v):
    m = ID_RE.match(str(v)) if pd.notna(v) else None
    return f"{m[1].upper()}{m[2]}-{int(m[3]):04d}" if m else None


def to_num(s, q=None, lo=None, hi=None):
    """Parse messy numerics ('72%', '4/5', 'AB', ' 81 ') and quarantine out-of-range values."""
    raw = s.astype(str).str.strip()
    fixed = raw.str.contains(r"%|/", na=False)
    cleaned = raw.str.replace("%", "", regex=False).str.split("/").str[0].replace({"AB": "0", "nan": None, "None": None, "": None})
    out = pd.to_numeric(cleaned, errors="coerce")
    if q is not None:
        q["values_fixed"] += int(fixed.sum()) + int((raw == "AB").sum())
        if lo is not None:
            bad = (out < lo) | (out > hi)
            q["quarantined"] += int(bad.sum())
            out = out.mask(bad)
    return out


def new_q(name, df):
    return dict(source=name, label=SOURCES[name], rows_in=len(df), duplicates_removed=0, ids_normalized=0,
                unmatched_ids=0, values_fixed=0, quarantined=0)


def resolve(df, q, key, mapping, normalizer):
    """Map a source key (ID / roll no / email) to the canonical student_id."""
    keys = df[key].map(normalizer)
    q["ids_normalized"] += int((keys != df[key]).sum())
    return df.assign(student_id=keys.map(mapping))


def dedupe(df, q, subset=None):
    n = len(df)
    df = df.drop_duplicates(subset=subset, keep="last")
    q["duplicates_removed"] += n - len(df)
    return df


def run(students_only=False):
    quality = []
    # --- ERP master -------------------------------------------------------------------------
    erp = read_raw("erp_students")
    q = new_q("erp_students", erp)
    erp["student_id"] = erp.student_id.map(norm_id)
    erp = dedupe(erp, q, ["student_id"])
    erp["year"] = erp.year.astype(int)
    ids = set(erp.student_id)
    id_map = {i: i for i in ids}
    roll_map = dict(zip(erp.roll_no.str.upper().str.strip(), erp.student_id))
    email_map = dict(zip(erp.email.str.lower().str.strip(), erp.student_id))
    q["students_covered"] = 100.0
    quality.append(q)
    students = erp.set_index("student_id")

    def finish(q, df, value_cols):
        unmatched = df.student_id.isna()
        q["unmatched_ids"] = int(unmatched.sum())
        df = df[~unmatched]
        q["rows_clean"] = len(df)
        q["students_covered"] = round(100 * df.student_id.nunique() / len(ids), 1)
        q["completeness"] = round(100 * float(df[value_cols].notna().mean().mean()), 1) if len(df) else 0.0
        quality.append(q)
        return df

    # --- Academic -----------------------------------------------------------------------------
    ac = read_raw("academic")
    q = new_q("academic", ac)
    ac = resolve(ac, q, "student_id", id_map, norm_id)
    ac["semester"] = ac.semester.astype(int)
    ac["internal"] = to_num(ac.internal, q, 0, 40)
    ac["external"] = to_num(ac.external, q, 0, 60)
    ac["credits"] = ac.credits.astype(int)
    ac = finish(q, dedupe(ac, q, ["student_id", "semester", "subject_code"]), ["internal"])
    ac = ac.merge(students[["year", "dept"]], left_on="student_id", right_index=True)
    ac["current"] = ac.semester == 2 * ac.year - 1
    done = ac[~ac.current].dropna(subset=["external"]).copy()
    done["total"] = done.internal.fillna(0) + done.external
    done["gp"] = pd.cut(done.total, [-1, 39.99, 44.99, 49.99, 59.99, 69.99, 79.99, 89.99, 101], labels=[0, 5, 5.5, 6, 7, 8, 9, 10]).astype(float)
    done.loc[done.total < 40, "gp"] = 0
    done["wgp"] = done.gp * done.credits
    sem = done.groupby(["student_id", "semester"]).agg(wgp=("wgp", "sum"), cr=("credits", "sum")).reset_index()
    sem["sgpa"] = sem.wgp / sem.cr
    # CGPA over cleared credits (common university practice); failed subjects are tracked as active backlogs instead
    passed = done[done.gp > 0].groupby("student_id")[["wgp", "credits"]].sum()
    cgpa = (passed.wgp / passed.credits).rename("cgpa")
    trend = sem.sort_values("semester").groupby("student_id").sgpa.apply(lambda s: s.iloc[-1] - s.iloc[-2] if len(s) > 1 else np.nan).rename("sgpa_trend")
    backlogs = done[done.total < 40].groupby("student_id").size().rename("active_backlogs")
    cur = ac[ac.current].copy()
    cur["internal_pct"] = cur.internal / 40 * 100
    cur_agg = cur.groupby("student_id").internal_pct.agg(internal_avg="mean", weakest_subject="min")
    subject_stats = cur.groupby(["subject_code", "subject_name", "dept"]).agg(
        students=("student_id", "nunique"), avg_internal_pct=("internal_pct", "mean"),
        fail_rate=("internal_pct", lambda s: 100 * (s < 40).mean())).reset_index().round(1)
    sgpa_hist = sem[["student_id", "semester", "sgpa"]].round(2)

    # --- Attendance ---------------------------------------------------------------------------
    at = read_raw("attendance")
    q = new_q("attendance", at)
    at = resolve(at, q, "roll_no", roll_map, lambda v: str(v).upper().strip())
    at["week"] = at.week.astype(int)
    at["held"] = to_num(at.classes_held, q, 0, 10)
    at["attended"] = to_num(at.classes_attended, q)
    over = at.attended > at.held
    q["values_fixed"] += int(over.sum())
    at.loc[over, "attended"] = at.held  # data-entry errors: attended > held
    at = finish(q, dedupe(at, q, ["student_id", "subject_code", "week"]), ["held", "attended"])

    # --- LMS ------------------------------------------------------------------------------------
    lm = read_raw("lms")
    q = new_q("lms", lm)
    lm = resolve(lm, q, "email", email_map, lambda v: str(v).lower().strip())
    lm["week"] = ((pd.to_datetime(lm.week_start) - pd.to_datetime(lm.week_start).min()).dt.days // 7 + 1).astype(int)
    for c in ["logins", "assignments_due", "assignments_submitted", "submitted_on_time"]:
        lm[c] = to_num(lm[c], q, 0, 100)
    lm["avg_quiz_score"] = to_num(lm.avg_quiz_score, q, 0, 100)
    lm = finish(q, dedupe(lm, q, ["student_id", "week"]), ["logins", "assignments_submitted"])

    # --- Engagement -----------------------------------------------------------------------------
    en = read_raw("engagement")
    q = new_q("engagement", en)
    en = resolve(en, q, "student_id", id_map, norm_id)
    parsed = pd.to_datetime(en.date, format="mixed", dayfirst=True, errors="coerce")
    q["values_fixed"] += int((parsed.dt.strftime("%Y-%m-%d") != en.date).sum())
    en["date"] = parsed
    en = finish(q, dedupe(en, q, ["student_id", "activity_type", "date", "role"]), ["date"])
    eng = en.groupby("student_id").agg(
        activities=("activity_type", lambda s: int((s != "certification").sum())),
        eng_certs=("activity_type", lambda s: int((s == "certification").sum())),
        leadership=("role", lambda s: int(s.isin(["lead", "organizer"]).sum())))

    # --- Placement ------------------------------------------------------------------------------
    pl = read_raw("placement")
    q = new_q("placement", pl)
    pl = resolve(pl, q, "student_id", id_map, norm_id)
    pl["aptitude"] = to_num(pl.aptitude_score, q, 0, 100)
    pl["coding"] = to_num(pl.coding_score, q, 0, 100)
    pl["mock_interviews"] = to_num(pl.mock_interviews, q, 0, 50)
    pl["mock_rating"] = to_num(pl.mock_rating, q, 1, 5)
    pl = finish(q, dedupe(pl.sort_values("assessed_on"), q, ["student_id", "assessed_on"]), ["aptitude", "coding"])
    plc = pl.sort_values("assessed_on").groupby("student_id").agg(
        aptitude=("aptitude", "last"), coding=("coding", "last"), mock_interviews=("mock_interviews", "max"), mock_rating=("mock_rating", "last"))

    # --- Skills -------------------------------------------------------------------------------
    sk = read_raw("skills")
    q = new_q("skills", sk)
    sk = resolve(sk, q, "student_id", id_map, norm_id)
    for c in ["technical_score", "communication_score", "teamwork_score"]:
        sk[c] = to_num(sk[c], q, 0, 100)
    sk["certifications_count"] = to_num(sk.certifications_count, q, 0, 50)
    sk = finish(q, dedupe(sk, q, ["student_id"]), ["technical_score", "communication_score"])
    skc = sk.set_index("student_id").assign(soft_skills=lambda d: d[["communication_score", "teamwork_score"]].mean(axis=1))[
        ["technical_score", "soft_skills", "certifications_count"]].rename(columns={"technical_score": "technical"})

    # --- Feedback -------------------------------------------------------------------------------
    fb = read_raw("feedback")
    q = new_q("feedback", fb)
    fb = resolve(fb, q, "student_id", id_map, norm_id)
    fb["satisfaction"] = to_num(fb.satisfaction, q, 1, 5)
    fb["faculty_rating"] = to_num(fb.faculty_rating, q, 1, 5)
    fb = finish(q, dedupe(fb, q, ["student_id"]), ["satisfaction", "faculty_rating"])
    fbc = fb.set_index("student_id")[["satisfaction", "faculty_rating", "comments"]]

    # --- Static (term-level) features ----------------------------------------------------------
    static = students[["name", "email", "roll_no", "gender", "dept", "program", "year", "section", "mentor_id", "admission_category", "home_state"]].join(
        [cgpa, trend, backlogs, cur_agg, eng, plc, skc, fbc])
    static["active_backlogs"] = static.active_backlogs.fillna(0)
    static[["activities", "leadership", "eng_certs"]] = static[["activities", "leadership", "eng_certs"]].fillna(0)
    static["certifications"] = static.certifications_count.fillna(0) + static.eng_certs
    static = static.drop(columns=["eng_certs", "certifications_count"])

    # --- Weekly (time-varying) features: attendance + LMS, weeks 4..12 ---------------------------
    att_w = at.groupby(["student_id", "week"])[["held", "attended"]].sum().reset_index()
    att_sw = at.groupby(["student_id", "subject_code", "week"])[["held", "attended"]].sum().reset_index()
    snaps = []
    for w in range(4, WEEKS + 1):
        term = att_w[att_w.week <= w].groupby("student_id")[["held", "attended"]].sum()
        recent = att_w[att_w.week.between(w - 3, w)].groupby("student_id")[["held", "attended"]].sum()
        prev = att_w[att_w.week.between(w - 7, w - 4)].groupby("student_id")[["held", "attended"]].sum()
        subj = att_sw[att_sw.week <= w].groupby(["student_id", "subject_code"])[["held", "attended"]].sum()
        below = ((subj.attended / subj.held) < 0.75).groupby("student_id").sum()
        l4 = lm[lm.week.between(w - 3, w)].groupby("student_id")
        l_prev = lm[lm.week.between(w - 7, w - 4)].groupby("student_id")
        lsum = l4[["logins", "assignments_due", "assignments_submitted", "submitted_on_time"]].sum()
        snap = pd.DataFrame(index=static.index)
        snap["week"] = w
        snap["attendance_term"] = 100 * term.attended / term.held
        snap["attendance_recent"] = 100 * recent.attended / recent.held
        snap["attendance_trend"] = snap.attendance_recent - 100 * prev.attended / prev.held if w >= 8 else 0.0
        snap["subjects_below_75"] = below
        snap["logins_per_week"] = lsum.logins / 4
        snap["assignment_completion"] = 100 * lsum.assignments_submitted / lsum.assignments_due
        snap["on_time_rate"] = 100 * lsum.submitted_on_time / lsum.assignments_submitted.replace(0, np.nan)
        snap["quiz_avg"] = l4.avg_quiz_score.mean()
        snap["lms_trend"] = snap.assignment_completion - 100 * l_prev.assignments_submitted.sum() / l_prev.assignments_due.sum() if w >= 8 else 0.0
        snaps.append(snap.reset_index())
    weekly = pd.concat(snaps, ignore_index=True)
    weekly["subjects_below_75"] = weekly.subjects_below_75.fillna(0)

    labels = read_raw("outcome_labels").assign(
        academic_setback=lambda d: d.academic_setback.astype(int), placement_unready=lambda d: d.placement_unready.astype(int))
    labels["student_id"] = labels.student_id.map(norm_id)

    q = pd.DataFrame(quality).fillna({"rows_clean": 0, "completeness": 100.0})
    q.loc[q.source == "erp_students", ["rows_clean", "completeness"]] = [len(erp), 100.0]
    return dict(static=static.reset_index(), weekly=weekly, quality=q, subject_stats=subject_stats,
                sgpa_hist=sgpa_hist, labels=labels.set_index("student_id"))
