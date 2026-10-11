"""AI Copilot (natural-language analytics via read-only tools) and AI Mentor Briefs, powered by Claude.

Privacy: only student IDs and numeric indicators are sent to the model — never names, emails or protected attributes.
"""
import json
import os

import anthropic
import pandas as pd

MODEL = "claude-opus-5-5"
NUMERIC = ["success_score", "cgpa", "active_backlogs", "attendance_term", "attendance_recent", "assignment_completion",
           "logins_per_week", "aptitude", "coding", "mock_interviews", "technical", "soft_skills", "certifications",
           "activities", "satisfaction", "trend_4w", "academic_risk_prob", "placement_risk_prob", "internal_avg"]
CATEGORICAL = ["dept", "year", "section", "band", "academic_risk", "placement_risk", "segment", "sliding", "mentor_id"]
FILTER_SCHEMA = {
    "type": "object",
    "properties": {
        **{c: {"type": ["string", "integer", "boolean"], "description": f"exact match on {c}"} for c in CATEGORICAL},
        "conditions": {"type": "array", "description": "numeric conditions", "items": {"type": "object", "properties": {
            "field": {"type": "string", "enum": NUMERIC}, "op": {"type": "string", "enum": [">", ">=", "<", "<=", "=="]},
            "value": {"type": "number"}}, "required": ["field", "op", "value"]}},
    },
}
TOOLS = [
    {"name": "search_students", "description": "Find students matching filters. Returns count and up to `limit` rows (student_id + key metrics).",
     "input_schema": {"type": "object", "properties": {
         "filters": FILTER_SCHEMA, "sort_by": {"type": "string", "enum": NUMERIC}, "descending": {"type": "boolean"},
         "limit": {"type": "integer", "minimum": 1, "maximum": 50}}}},
    {"name": "group_summary", "description": "Aggregate students by a dimension: count, average success score, % High academic/placement risk, sliding count.",
     "input_schema": {"type": "object", "properties": {
         "group_by": {"type": "string", "enum": ["dept", "year", "section", "segment", "band", "mentor_id"]}, "filters": FILTER_SCHEMA},
         "required": ["group_by"]}},
]
SYSTEM = """You are Pragati Copilot, an analytics assistant for college administrators and faculty.
Answer questions about students using the tools; never invent numbers. Data covers the current term
(dept: CSE, IT, ECE, ME, CE; year 1-4; band: Thriving/On track/Watch/At risk; risk tiers: High/Medium/Low;
segments: All-rounders, Academic Star, Placement-Unready, Placement-Ready, Academically Average, Engaged but Struggling,
Silent Disengager, Multi-domain Risk). Students are identified by ID only.
Reply in 2-5 concise sentences with the key numbers and one suggested action. Plain text, no markdown tables."""
COLS = ["student_id", "dept", "year", "success_score", "band", "academic_risk", "placement_risk", "segment", "cgpa", "attendance_term", "coding"]


def enabled():
    return bool(os.getenv("ANTHROPIC_API_KEY"))


def _filter(df, f):
    f = f or {}
    for c in CATEGORICAL:
        if c in f and f[c] not in (None, ""):
            v = f[c]
            if c == "year":
                v = int(v)
            elif c == "sliding":
                v = v in (True, "true", "True", 1)
            df = df[df[c] == v]
    for cond in f.get("conditions") or []:
        if cond.get("field") in NUMERIC and cond.get("op") in (">", ">=", "<", "<=", "=="):
            df = df.query(f"`{cond['field']}` {cond['op']} {float(cond['value'])}")
    return df


def run_tool(name, args, df):
    if name == "search_students":
        r = _filter(df, args.get("filters"))
        if args.get("sort_by") in NUMERIC:
            r = r.sort_values(args["sort_by"], ascending=not args.get("descending", True))
        rows = r[COLS].head(int(args.get("limit") or 15))
        return {"count": len(r), "rows": json.loads(rows.to_json(orient="records"))}
    if name == "group_summary":
        r = _filter(df, args.get("filters"))
        g = r.groupby(args["group_by"]).agg(
            students=("student_id", "count"), avg_success_score=("success_score", "mean"),
            pct_high_academic_risk=("academic_risk", lambda s: 100 * (s == "High").mean()),
            pct_high_placement_risk=("placement_risk", lambda s: 100 * (s == "High").mean()),
            sliding=("sliding", "sum")).round(1).reset_index()
        return {"groups": json.loads(g.to_json(orient="records"))}
    raise ValueError(f"unknown tool {name}")


def copilot(question, df):
    if not enabled():
        return dict(answer="The AI Copilot needs an ANTHROPIC_API_KEY on the server. Every other feature works without it.", table=None, tools_used=[])
    client = anthropic.Anthropic()
    messages = [{"role": "user", "content": question}]
    table, used = None, []
    for _ in range(6):
        resp = client.beta.messages.create(
            model=MODEL, max_tokens=16000, system=SYSTEM, tools=TOOLS, messages=messages,
            output_config={"effort": "low"}, betas=["server-side-fallback-2026-07-01"], fallbacks="default")
        if resp.stop_reason == "refusal":
            return dict(answer="I can't help with that request.", table=None, tools_used=used)
        calls = [b for b in resp.content if b.type == "tool_use"]
        if not calls:
            text = "".join(b.text for b in resp.content if b.type == "text").strip()
            return dict(answer=text or "No answer.", table=table, tools_used=used)
        messages.append({"role": "assistant", "content": resp.content})
        results = []
        for b in calls:
            used.append(b.name)
            try:
                out = run_tool(b.name, b.input, df)
                table = out.get("rows") or out.get("groups") or table
                results.append({"type": "tool_result", "tool_use_id": b.id, "content": json.dumps(out)})
            except Exception as e:  # bad filter from the model → let it correct itself
                results.append({"type": "tool_result", "tool_use_id": b.id, "content": f"Error: {e}", "is_error": True})
        messages.append({"role": "user", "content": results})
    return dict(answer="That question needed too many steps; try narrowing it.", table=table, tools_used=used)


def template_brief(s):
    """Deterministic brief used when the AI is unavailable."""
    d = sorted(((k, s[f"d_{k}"]) for k in ["academic", "attendance", "lms", "placement", "skills", "engagement"]), key=lambda x: x[1])
    concerns = [x["label"] for x in (s["academic_drivers"] + s["placement_drivers"])[:3]]
    return (f"Strengths: {d[-1][0]} ({d[-1][1]:.0f}) and {d[-2][0]} ({d[-2][1]:.0f}).\n"
            f"Concerns: {', '.join(concerns) or 'none flagged'}; weakest area is {d[0][0]} ({d[0][1]:.0f}).\n"
            f"Risk: academic {s['academic_risk']}, placement {s['placement_risk']}; score trend {s['trend_4w']:+.1f} over 4 weeks.\n"
            f"Talking points: ask about {d[0][0]}, agree one measurable target for the next 2 weeks.")


def brief(s, actions):
    if not enabled():
        return dict(brief=template_brief(s), source="template")
    keep = ["student_id", "dept", "year", "success_score", "band", "trend_4w", "segment", "academic_risk", "academic_risk_prob",
            "placement_risk", "placement_risk_prob", "academic_rules", "academic_drivers", "placement_drivers", "cgpa",
            "active_backlogs", "attendance_term", "attendance_recent", "assignment_completion", "coding", "aptitude",
            "mock_interviews", "satisfaction"] + [f"d_{d}" for d in ["academic", "attendance", "lms", "placement", "skills", "engagement"]]
    payload = {k: (None if isinstance(s[k], float) and pd.isna(s[k]) else s[k]) for k in keep}
    prompt = ("Write a mentor-meeting brief for this student (data below). Exactly 4 short labelled lines: "
              "Strengths, Concerns, Talking points, Suggested action. Under 90 words, plain text, warm and non-judgemental. "
              f"Recommended actions available: {actions}.\n\n{json.dumps(payload, default=str)}")
    try:
        resp = anthropic.Anthropic().beta.messages.create(
            model=MODEL, max_tokens=4000, messages=[{"role": "user", "content": prompt}],
            output_config={"effort": "low"}, betas=["server-side-fallback-2026-07-01"], fallbacks="default")
        text = "".join(b.text for b in resp.content if b.type == "text").strip()
        if resp.stop_reason == "refusal" or not text:
            raise ValueError("no text")
        return dict(brief=text, source="ai")
    except (anthropic.APIError, ValueError):
        return dict(brief=template_brief(s), source="template")
