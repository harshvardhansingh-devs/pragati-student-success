"""AI Copilot (natural-language analytics via read-only tools) and AI Mentor Briefs.

Free-tier LLM providers via their OpenAI-compatible endpoints, tried in order with automatic fallback
(rate limit / outage / bad model → next provider). Configure keys in .env; models are overridable.
Privacy: only student IDs and numeric indicators are sent, never names, emails or protected attributes.
"""
import json
import os

import openai
import pandas as pd

PROVIDERS = {
    "gemini": ("Gemini", "GEMINI_API_KEY", "https://generativelanguage.googleapis.com/v1beta/openai/", "GEMINI_MODEL", "gemini-3.8-flash"),
    "groq": ("Groq", "GROQ_API_KEY", "https://api.groq.com/openai/v1", "GROQ_MODEL", "openai/gpt-oss-120b"),
    "openrouter": ("OpenRouter", "OPENROUTER_API_KEY", "https://openrouter.ai/api/v1", "OPENROUTER_MODEL", "nvidia/nemotron-3-super-120b-a12b:free"),
}
NUMERIC = ["success_score", "cgpa", "active_backlogs", "attendance_term", "attendance_recent", "assignment_completion",
           "logins_per_week", "aptitude", "coding", "mock_interviews", "technical", "soft_skills", "certifications",
           "activities", "satisfaction", "trend_4w", "academic_risk_prob", "placement_risk_prob", "internal_avg"]
CATEGORICAL = {
    "dept": "CSE, IT, ECE, ME or CE", "year": "1-4", "section": "A, B or C", "band": "Thriving, On track, Watch or At risk",
    "academic_risk": "High, Medium or Low", "placement_risk": "High, Medium or Low", "segment": "segment name", "sliding": "true or false",
    "mentor_id": "mentor id",
}
FILTER_SCHEMA = {
    "type": "object",
    "properties": {
        **{c: {"type": "string", "description": f"exact match: {d}"} for c, d in CATEGORICAL.items()},
        "conditions": {"type": "array", "description": "numeric conditions", "items": {"type": "object", "properties": {
            "field": {"type": "string", "enum": NUMERIC}, "op": {"type": "string", "enum": [">", ">=", "<", "<=", "=="]},
            "value": {"type": "number"}}, "required": ["field", "op", "value"]}},
    },
}
TOOLS = [
    {"type": "function", "function": {
        "name": "search_students", "description": "Find students matching filters. Returns count and up to `limit` rows (student_id + key metrics).",
        "parameters": {"type": "object", "properties": {
            "filters": FILTER_SCHEMA, "sort_by": {"type": "string", "enum": NUMERIC}, "descending": {"type": "boolean"},
            "limit": {"type": "integer", "description": "1-50, default 15"}}}}},
    {"type": "function", "function": {
        "name": "group_summary", "description": "Aggregate students by a dimension: count, average success score, % High academic/placement risk, sliding count.",
        "parameters": {"type": "object", "properties": {
            "group_by": {"type": "string", "enum": ["dept", "year", "section", "segment", "band", "mentor_id"]}, "filters": FILTER_SCHEMA},
            "required": ["group_by"]}}},
]
SYSTEM = """You are Pragati Copilot, an analytics assistant for college administrators and faculty.
For any question about students, answer by calling the tools; never invent numbers. If the user just greets you or asks something
unrelated to student data, reply in one or two friendly sentences (no tools) and suggest an example question.
Data covers the current term
(dept: CSE, IT, ECE, ME, CE; year 1-4; band: Thriving/On track/Watch/At risk; risk tiers: High/Medium/Low;
segments: All-rounders, Academic Star, Placement-Unready, Campus-Active, Placement-Unready, Engaged but Struggling,
Silent Disengager, Multi-domain Risk). Students are identified by ID only.
Reply in 2-5 concise sentences with the key numbers and one suggested action. Plain text, no markdown tables."""
COLS = ["student_id", "dept", "year", "success_score", "band", "academic_risk", "placement_risk", "segment", "cgpa", "attendance_term", "coding"]


def providers():
    # fastest first (measured on the copilot: Groq ~1.5 s, OpenRouter ~4 s, Gemini ~15 s)
    order = [p.strip() for p in os.getenv("AI_PROVIDER_PRIORITY", "groq,openrouter,gemini").split(",")]
    out = []
    for key in order:
        if key in PROVIDERS and os.getenv(PROVIDERS[key][1]):
            name, env, url, model_env, default = PROVIDERS[key]
            out.append((name, openai.OpenAI(api_key=os.getenv(env), base_url=url, timeout=40, max_retries=1), os.getenv(model_env, default)))
    return out


def enabled():
    return [p[0] for p in providers()]


def _filter(df, f):
    f = f or {}
    for c in CATEGORICAL:
        v = f.get(c)
        if v in (None, ""):
            continue
        if c == "year":
            v = int(v)
        elif c == "sliding":
            v = str(v).lower() == "true"
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
        rows = r[COLS].head(max(10, min(int(args.get("limit") or 15), 50)))  # show at least 10 so the table matches the stated count
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


def _copilot_once(client, model, question, df):
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": question}]
    table, used = None, []
    for _ in range(6):
        msg = client.chat.completions.create(model=model, messages=messages, tools=TOOLS, temperature=0.2).choices[0].message
        if not msg.tool_calls:
            return dict(answer=(msg.content or "").strip() or "No answer.", table=table, tools_used=used)
        # echo the message back unchanged: keeps provider extras such as Gemini's thought_signature on tool calls
        messages.append(msg.model_dump(exclude_none=True))
        for c in msg.tool_calls:
            used.append(c.function.name)
            try:
                out = run_tool(c.function.name, json.loads(c.function.arguments or "{}"), df)
                table = out.get("rows") or out.get("groups") or table
                content = json.dumps(out)
            except Exception as e:  # bad filter from the model → let it correct itself
                content = f"Error: {e}"
            messages.append({"role": "tool", "tool_call_id": c.id, "content": content})
    return dict(answer="That question needed too many steps; try narrowing it.", table=table, tools_used=used)


def copilot(question, df):
    errors = []
    for name, client, model in providers():
        try:
            return {**_copilot_once(client, model, question, df), "provider": f"{name} · {model}"}
        except openai.OpenAIError as e:  # rate limit, outage, unsupported model → next provider
            errors.append(f"{name}: {type(e).__name__}")
    if not errors:
        return dict(answer="The AI Copilot needs at least one key (GEMINI_API_KEY, GROQ_API_KEY or OPENROUTER_API_KEY) on the server. "
                           "Every other feature works without it.", table=None, tools_used=[], provider=None)
    return dict(answer=f"All AI providers failed ({'; '.join(errors)}). Try again in a minute.", table=None, tools_used=[], provider=None)


def template_brief(s):
    """Deterministic brief used when no AI provider is available."""
    d = sorted(((k, s[f"d_{k}"]) for k in ["academic", "attendance", "lms", "placement", "skills", "engagement"]), key=lambda x: x[1])
    drivers = (s["academic_drivers"] if s["academic_risk"] != "Low" else []) + (s["placement_drivers"] if s["placement_risk"] != "Low" else [])
    concerns = [x["label"] for x in drivers[:3]]
    return (f"Strengths: {d[-1][0]} ({d[-1][1]:.0f}) and {d[-2][0]} ({d[-2][1]:.0f}).\n"
            f"Concerns: {', '.join(concerns) or 'none flagged'}; weakest area is {d[0][0]} ({d[0][1]:.0f}).\n"
            f"Risk: academic {s['academic_risk']}, placement {s['placement_risk']}; score trend {s['trend_4w']:+.1f} over 4 weeks.\n"
            f"Talking points: ask about {d[0][0]}, agree one measurable target for the next 2 weeks.")


def brief(s, actions):
    keep = ["student_id", "dept", "year", "success_score", "band", "trend_4w", "segment", "academic_risk", "academic_risk_prob",
            "placement_risk", "placement_risk_prob", "academic_rules", "academic_drivers", "placement_drivers", "cgpa",
            "active_backlogs", "attendance_term", "attendance_recent", "assignment_completion", "coding", "aptitude",
            "mock_interviews", "satisfaction"] + [f"d_{d}" for d in ["academic", "attendance", "lms", "placement", "skills", "engagement"]]
    payload = {k: (None if isinstance(s[k], float) and pd.isna(s[k]) else s[k]) for k in keep}
    prompt = ("Write a mentor-meeting brief for this student (data below). Exactly 4 short labelled lines: "
              "Strengths, Concerns, Talking points, Suggested action. Under 90 words, plain text, warm and non-judgemental. "
              f"Recommended actions available: {actions}.\n\n{json.dumps(payload, default=str)}")
    for name, client, model in providers():
        try:
            text = (client.chat.completions.create(model=model, messages=[{"role": "user", "content": prompt}], temperature=0.4)
                    .choices[0].message.content or "").strip()
            if text:
                return dict(brief=text, source="ai", provider=f"{name} · {model}")
        except openai.OpenAIError:
            continue
    return dict(brief=template_brief(s), source="template", provider=None)
