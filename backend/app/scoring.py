"""Student Success Score, dual risk models, explanations, segmentation, insights, what-if.

See handbook/SUCCESS_SCORE.md for the methodology.
"""
import numpy as np
import pandas as pd
from scipy.optimize import linear_sum_assignment
from sklearn.cluster import KMeans
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import recall_score, roc_auc_score, silhouette_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

# name: (domain, lo, hi, direction, label)
INDICATORS = {
    "cgpa": ("academic", 4.5, 9.5, 1, "CGPA"),
    "active_backlogs": ("academic", 0, 4, -1, "Active backlogs"),
    "sgpa_trend": ("academic", -1.5, 1.5, 1, "SGPA trend (last sem)"),
    "internal_avg": ("academic", 35, 85, 1, "Current internal marks %"),
    "weakest_subject": ("academic", 25, 85, 1, "Weakest subject %"),
    "faculty_rating": ("academic", 1, 5, 1, "Faculty rating"),
    "attendance_term": ("attendance", 50, 95, 1, "Term attendance %"),
    "attendance_recent": ("attendance", 50, 95, 1, "Last-4-week attendance %"),
    "subjects_below_75": ("attendance", 0, 3, -1, "Subjects below 75%"),
    "logins_per_week": ("lms", 0, 4, 1, "LMS logins / week"),
    "assignment_completion": ("lms", 30, 100, 1, "Assignment completion %"),
    "on_time_rate": ("lms", 20, 100, 1, "On-time submission %"),
    "quiz_avg": ("lms", 30, 90, 1, "LMS quiz average"),
    "aptitude": ("placement", 25, 85, 1, "Aptitude score"),
    "coding": ("placement", 15, 85, 1, "Coding score"),
    "mock_interviews": ("placement", 0, 2, 1, "Mock interviews"),
    "mock_rating": ("placement", 1, 5, 1, "Mock interview rating"),
    "technical": ("skills", 25, 85, 1, "Technical assessment"),
    "soft_skills": ("skills", 25, 85, 1, "Soft-skills assessment"),
    "certifications": ("skills", 0, 2, 1, "Certifications"),
    "activities": ("engagement", 0, 4, 1, "Clubs / events / hackathons"),
    "leadership": ("engagement", 0, 1, 1, "Leadership roles"),
    "satisfaction": ("engagement", 1, 5, 1, "Satisfaction (feedback)"),
}
DOMAINS = ["academic", "attendance", "lms", "placement", "skills", "engagement"]
DOMAIN_LABELS = {"academic": "Academic", "attendance": "Attendance", "lms": "Learning (LMS)",
                 "placement": "Placement readiness", "skills": "Skills", "engagement": "Engagement & wellbeing"}
DEFAULT_WEIGHTS = {"academic": 0.30, "attendance": 0.15, "lms": 0.15, "placement": 0.20, "skills": 0.10, "engagement": 0.10}
EARLY_YEAR_SHIFT = 0.10  # Y1-Y2: placement weight → academic (placement prep hasn't started)
BANDS = [(75, "Thriving"), (60, "On track"), (45, "Watch"), (0, "At risk")]
RISK_FEATURES = {
    "academic": ["cgpa", "active_backlogs", "sgpa_trend", "internal_avg", "weakest_subject", "faculty_rating", "attendance_term",
                 "attendance_recent", "subjects_below_75", "logins_per_week", "assignment_completion", "on_time_rate", "quiz_avg",
                 "satisfaction", "attendance_trend", "lms_trend"],
    "placement": ["cgpa", "active_backlogs", "aptitude", "coding", "mock_interviews", "mock_rating", "technical", "soft_skills",
                  "certifications", "activities", "leadership"],
}
LABEL_COL = {"academic": "academic_setback", "placement": "placement_unready"}
TREND_LABELS = {"attendance_trend": "Attendance change (4 wks)", "lms_trend": "Assignment completion change (4 wks)"}
HIGH, MEDIUM = 0.70, 0.40
SEGMENTS = {  # relative profile in z-units vs all students (academic, attendance, lms, placement, skills, engagement) + playbook
    "All-rounders": ([1, 0.5, 0.7, 1.2, 1.2, 0.5], "Peer mentors; stretch goals and competitive placements"),
    "Academic Star, Placement-Unready": ([0.8, 0.5, 0.7, -0.3, -0.3, -1], "DSA / coding bootcamp, 2 mock interviews, certification track"),
    "Campus-Active, Placement-Unready": ([0.5, 0.5, 0.5, -0.3, 0, 1.2], "Channel club energy into placement prep: coding club, hackathons, mock interviews"),
    "Engaged but Struggling": ([-1, -0.3, -0.6, 0, 0, 0.8], "Remedial classes + time-management coaching; keep club involvement"),
    "Silent Disengager": ([-1, -2, -1.5, -0.3, -0.3, -0.5], "Mentor outreach within a week; counselling; parent connect"),
    "Multi-domain Risk": ([-0.7, 0, -0.3, -1, -1, -1], "Intensive case management: weekly mentor meetings across all areas"),
}
ACTIONS = {
    "attendance": ("Attendance counselling + parent connect", "Mentor"),
    "academic": ("Remedial classes in weak subjects", "HoD / Subject faculty"),
    "lms": ("Weekly LMS check-in & assignment plan", "Mentor"),
    "coding": ("Enrol in DSA / coding bootcamp", "Placement cell"),
    "aptitude": ("Aptitude training batch", "Placement cell"),
    "mock": ("Schedule 2 mock interviews", "Placement cell"),
    "skills": ("Certification track (NPTEL / industry)", "Placement cell"),
    "soft_skills": ("Communication skills workshop", "Training cell"),
    "engagement": ("Wellbeing check-in & club onboarding", "Counsellor"),
}


def action_for(feature):
    if feature in ("coding",):
        return ACTIONS["coding"]
    if feature == "aptitude":
        return ACTIONS["aptitude"]
    if feature.startswith("mock"):
        return ACTIONS["mock"]
    if feature == "soft_skills":
        return ACTIONS["soft_skills"]
    if feature.startswith("attendance") or feature == "subjects_below_75":
        return ACTIONS["attendance"]
    if feature == "lms_trend":
        return ACTIONS["lms"]
    dom = INDICATORS.get(feature, ("engagement",))[0]
    return ACTIONS[{"placement": "skills"}.get(dom, dom)]


def label(f):
    return INDICATORS[f][4] if f in INDICATORS else TREND_LABELS.get(f, f)


def year_weights(weights, year):
    w = dict(weights)
    if year <= 2:
        shift = min(EARLY_YEAR_SHIFT, w["placement"])
        w["placement"] -= shift
        w["academic"] += shift
    return w


def scale(df):
    out = pd.DataFrame(index=df.index)
    for f, (_, lo, hi, d, _) in INDICATORS.items():
        s = ((df[f].astype(float) - lo) / (hi - lo)).clip(0, 1) * 100
        out[f] = s if d > 0 else 100 - s
    return out


def domain_scores(scaled, meta, ref=None):
    """Domain = mean of available scaled indicators; missing domains imputed with cohort (dept×year) median.
    ref: (raw domain frame, its meta) to impute from; defaults to this batch."""
    dom = pd.DataFrame({d: scaled[[f for f, v in INDICATORS.items() if v[0] == d]].mean(axis=1) for d in DOMAINS}, index=scaled.index)
    ref_dom, ref_meta = ref if ref is not None else (dom, meta)
    imputed = dom.isna()
    cohort = ref_dom.join(ref_meta[["dept", "year"]]).groupby(["dept", "year"])[DOMAINS].median()
    keys = pd.MultiIndex.from_frame(meta[["dept", "year"]])
    for d in DOMAINS:
        fill = pd.Series(cohort[d].reindex(keys).values, index=dom.index)
        dom[d] = dom[d].fillna(fill).fillna(ref_dom[d].median()).fillna(50)
    return dom, imputed


def success(dom, years, weights):
    w = pd.DataFrame([year_weights(weights, y) for y in years], index=dom.index)[DOMAINS]
    return (dom[DOMAINS] * w).sum(axis=1), w


def band(s):
    return next(b for t, b in BANDS if s >= t)


def tier(p):
    return "High" if p >= HIGH else "Medium" if p >= MEDIUM else "Low"


def rules(row, kind):
    r = []
    if kind == "academic":
        if row.get("attendance_term", 100) < 75:
            r.append("Attendance below 75% (detention risk)")
        if row.get("active_backlogs", 0) >= 3:
            r.append(f"{int(row['active_backlogs'])} active backlogs")
    elif row.get("year") == 4 and row.get("coding", 100) < 30:
        r.append("Final year with coding score below 30")
    return r


class RiskModel:
    """Logistic regression on standardised indicators: exact additive per-feature contributions (log-odds)."""

    def __init__(self, kind, feats, labels):
        self.kind, self.cols = kind, RISK_FEATURES[kind]
        feats = feats.sort_index()  # deterministic split regardless of database row order
        X = feats[self.cols].astype(float)
        self.fill = X.median()
        X = X.fillna(self.fill)
        y = labels.reindex(feats.index)[LABEL_COL[kind]].fillna(0).astype(int)
        # 5-fold stratified cross-validation: every student is scored once by a model that never saw them
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        p = cross_val_predict(make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=1000)), X, y, cv=cv, method="predict_proba")[:, 1]
        fold_auc = [roc_auc_score(y.iloc[te], p[te]) for _, te in cv.split(X, y)]
        self.metrics = dict(model="Logistic regression (standardised)", target=LABEL_COL[kind], validation="5-fold stratified CV",
                            auc=round(float(np.mean(fold_auc)), 3), auc_std=round(float(np.std(fold_auc)), 3),
                            recall_high_or_medium=round(recall_score(y, p >= MEDIUM), 3), base_rate=round(float(y.mean()), 3),
                            rows=len(X))
        self.model = make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=1000)).fit(X, y)
        self.sc, self.lr = self.model[0], self.model[1]
        self.metrics["coefficients"] = {c: round(float(v), 3) for c, v in zip(self.cols, self.lr.coef_[0])}
        self.median = feats[self.cols].median()

    def predict(self, feats):
        X = feats[self.cols].astype(float).fillna(self.fill)
        prob = self.model.predict_proba(X)[:, 1]
        contrib = self.sc.transform(X) * self.lr.coef_[0]
        return prob, pd.DataFrame(contrib, index=feats.index, columns=self.cols)

    def drivers(self, row, contrib_row, n=3):
        top = contrib_row[contrib_row > 0.05].sort_values(ascending=False).head(n)
        return [dict(feature=f, label=label(f), value=None if pd.isna(row.get(f)) else round(float(row[f]), 2),
                     cohort_median=None if pd.isna(self.median[f]) else round(float(self.median[f]), 2),
                     impact=round(float(v), 3)) for f, v in top.items()]


def segment(dom):
    """K-Means on standardised domain scores; clusters named by matching centroids to relative prototype profiles."""
    raw = dom[DOMAINS].values
    X = (raw - raw.mean(axis=0)) / raw.std(axis=0)
    km = KMeans(n_clusters=len(SEGMENTS), n_init=10, random_state=42).fit(X)
    names = list(SEGMENTS)
    proto = np.array([SEGMENTS[n][0] for n in names])
    cost = ((km.cluster_centers_[:, None, :] - proto[None, :, :]) ** 2).sum(axis=2)
    rows, cols = linear_sum_assignment(cost)  # unique, stable names for clusters
    mapping = {r: names[c] for r, c in zip(rows, cols)}
    return pd.Series([mapping[c] for c in km.labels_], index=dom.index), round(float(silhouette_score(X, km.labels_)), 3)


def score_all(static, weekly, labels, weights):
    """Full scoring run → per-student latest table, weekly score history, models, segment info."""
    static = static.set_index("student_id")
    latest_w = weekly.week.max()
    hist = []
    latest = None
    for w, wk in weekly.groupby("week"):
        feats = static.join(wk.set_index("student_id").drop(columns="week"))
        dom, imputed = domain_scores(scale(feats), feats)
        s, _ = success(dom, feats.year, weights)
        hist.append(pd.DataFrame({"student_id": feats.index, "week": w, "success_score": s.round(1).values,
                                  **{d: dom[d].round(1).values for d in DOMAINS}}))
        if w == latest_w:
            latest = (feats, dom, imputed, s)
    history = pd.concat(hist, ignore_index=True)
    feats, dom, imputed, s = latest
    out = feats.copy()
    for d in DOMAINS:
        out[f"d_{d}"] = dom[d].round(1)
    out["success_score"] = s.round(1)
    out["band"] = out.success_score.map(band)
    out["completeness"] = (100 * (1 - feats[list(INDICATORS)].isna().mean(axis=1))).round(0)
    out["low_confidence"] = imputed.sum(axis=1) >= 2
    piv = history.pivot(index="student_id", columns="week", values="success_score")
    out["trend_4w"] = (piv[latest_w] - piv[latest_w - 4]).round(1)
    out["sliding"] = out.trend_4w <= -10
    cohort = out.groupby(["dept", "year"]).success_score.rank(pct=True)
    out["cohort_percentile"] = (cohort * 100).round(0)

    models = {k: RiskModel(k, feats, labels) for k in ("academic", "placement")}
    for k, m in models.items():
        prob, contrib = m.predict(feats)
        out[f"{k}_risk_prob"] = prob.round(3)
        rule_hits = [rules(r, k) for r in feats.reset_index().to_dict("records")]
        out[f"{k}_rules"] = rule_hits
        out[f"{k}_risk"] = [("High" if r else tier(p)) for p, r in zip(prob, rule_hits)]
        out[f"{k}_drivers"] = [m.drivers(feats.loc[i], contrib.loc[i]) for i in feats.index]
    out["segment"], sil = segment(dom)
    return out.reset_index(), history, models, dict(silhouette=sil, k=len(SEGMENTS)), (dom, feats[["dept", "year"]])


def explain_score(row, weights, cohort_rows):
    """Waterfall: each indicator's points contribution vs the cohort average."""
    w = year_weights(weights, int(row["year"]))
    sc = scale(pd.DataFrame([row]))
    sc_c = scale(cohort_rows)
    items = []
    for d in DOMAINS:
        fs = [f for f, v in INDICATORS.items() if v[0] == d]
        avail = [f for f in fs if pd.notna(sc.iloc[0][f])] or fs
        for f in avail:
            pts = w[d] * (sc.iloc[0][f] / len(avail)) if pd.notna(sc.iloc[0][f]) else np.nan
            cpts = w[d] * (sc_c[f].mean() / len(avail))
            items.append(dict(indicator=f, label=label(f), domain=d, value=None if pd.isna(row.get(f)) else round(float(row[f]), 2),
                              points=None if pd.isna(pts) else round(float(pts), 2), max_points=round(w[d] * 100 / len(avail), 2),
                              vs_cohort=None if pd.isna(pts) else round(float(pts - cpts), 2)))
    return dict(weights=w, items=items)


def simulate(row, overrides, weights, models, ref):
    feats = pd.DataFrame([{**row, **overrides}]).set_index("student_id")
    dom, _ = domain_scores(scale(feats), feats, ref=ref)
    s, _ = success(dom, feats.year, weights)
    res = dict(success_score=round(float(s.iloc[0]), 1), band=band(float(s.iloc[0])), domains={d: round(float(dom[d].iloc[0]), 1) for d in DOMAINS})
    r = feats.reset_index().iloc[0].to_dict()
    for k, m in models.items():
        p = float(m.predict(feats)[0][0])
        hits = rules(r, k)
        res[f"{k}_risk_prob"] = round(p, 3)
        res[f"{k}_risk"] = "High" if hits else tier(p)
    return res


def insights(df, subject_stats):
    """Auto-generated, cross-source insight feed."""
    out = []
    n = len(df)
    det = df[df.attendance_term < 75]
    if len(det):
        worst = det.groupby(["dept", "year"]).size().sort_values(ascending=False)
        (d, y), c = worst.index[0], worst.iloc[0]
        out.append(dict(severity="high", title="Detention watch",
                        text=f"{len(det)} students ({100 * len(det) / n:.1f}%) are below the 75% attendance rule; the largest group is {d} Year {y} ({c} students)."))
    sl = df[df.sliding]
    if len(sl):
        top = sl.groupby(["dept", "year"]).size().sort_values(ascending=False)
        low_sat = (sl.satisfaction <= 2).mean() * 100
        out.append(dict(severity="high", title="Sliding students",
                        text=f"{len(sl)} students dropped 10+ points in 4 weeks, {int((sl.band.isin(['On track', 'Thriving'])).sum())} of them still look 'On track' or better. "
                             f"Most are in {top.index[0][0]} Year {top.index[0][1]}. {low_sat:.0f}% of them reported low satisfaction (≤2/5) in feedback."))
    hs = subject_stats[subject_stats.students >= 20].sort_values("fail_rate", ascending=False).head(1)
    if len(hs):
        h = hs.iloc[0]
        avg = subject_stats.fail_rate.mean()
        out.append(dict(severity="medium", title="Subject hotspot",
                        text=f"{h.subject_name} ({h.dept}, {h.subject_code}): {h.fail_rate:.0f}% of students are below 40% in internals vs a {avg:.0f}% average across subjects. Consider remedial sessions."))
    gap = df[(df.cgpa >= 8) & (df.placement_risk == "High") & (df.year >= 3)]
    if len(gap):
        out.append(dict(severity="medium", title="Hidden placement gap",
                        text=f"{len(gap)} Year 3-4 students have CGPA ≥ 8 but High placement risk, mostly due to {pd.Series([d[0]['label'] for d in gap.placement_drivers if d]).mode().iat[0].lower()}."))
    low = df[df.assignment_completion < 50]
    hi = df[df.assignment_completion >= 80]
    if len(low) and len(hi):
        r = (low.academic_risk == "High").mean() / max((hi.academic_risk == "High").mean(), 0.01)
        out.append(dict(severity="info", title="LMS signal",
                        text=f"Students completing <50% of LMS assignments are {r:.1f}× more likely to be at High academic risk than those completing 80%+; their internal marks average {low.internal_avg.mean():.0f}% vs {hi.internal_avg.mean():.0f}%."))
    eng_hi = df[df.activities >= 4].success_score.mean()
    eng_lo = df[df.activities == 0].success_score.mean()
    if pd.notna(eng_hi) and pd.notna(eng_lo):
        out.append(dict(severity="info", title="Engagement effect",
                        text=f"Students with 4+ clubs/events average a Success Score of {eng_hi:.0f}, vs {eng_lo:.0f} for students with none."))
    seg = df.groupby("segment").size().sort_values(ascending=False)
    aspu = seg.get("Academic Star, Placement-Unready", 0)
    if aspu:
        out.append(dict(severity="medium", title="Segment opportunity",
                        text=f"{aspu} students are 'Academic Star, Placement-Unready'. One targeted coding bootcamp could move the whole group."))
    return out


def fairness(df):
    """Flag-rate parity across protected groups (never model inputs). Four-fifths rule on the 'not flagged' rate."""
    res = {}
    for g in ("gender", "admission_category"):
        t = df.groupby(g).agg(students=("student_id", "count"), avg_score=("success_score", "mean"),
                              academic_high=("academic_risk", lambda s: 100 * (s == "High").mean()),
                              placement_high=("placement_risk", lambda s: 100 * (s == "High").mean())).round(1)
        ok = (100 - t[["academic_high", "placement_high"]])
        ratio = (ok.min() / ok.max()).round(3)
        res[g] = dict(groups=t.reset_index().to_dict("records"), parity_ratio=ratio.to_dict(), passes_four_fifths=bool((ratio >= 0.8).all()))
    return res
