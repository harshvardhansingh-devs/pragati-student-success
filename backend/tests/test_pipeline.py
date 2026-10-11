"""End-to-end check: raw CSVs → pipeline → scores → risk → what-if. Run: python -m pytest backend/tests  (or python backend/tests/test_pipeline.py)"""
import os
import sys
import tempfile
from pathlib import Path

os.environ["DATABASE_URL"] = f"sqlite:///{Path(tempfile.mkdtemp()) / 'test.db'}"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import pipeline, scoring, store  # noqa: E402


def test_end_to_end():
    store.bootstrap()
    st = store.state()
    s = st["scores"]
    assert len(s) == 1200 and s.student_id.is_unique
    assert s.success_score.between(0, 100).all()
    assert pipeline.norm_id(" cs22 0147 ") == "CS22-0147" and pipeline.norm_id("CS220147") == "CS22-0147"
    q = st["quality"].set_index("source")
    assert q.loc["academic", "ids_normalized"] > 0 and q.loc["attendance", "duplicates_removed"] > 0
    assert s.sliding.any() and set(s.segment) == set(scoring.SEGMENTS)
    assert all(m.metrics["auc"] > 0.65 for m in st["models"].values())
    # rule: below 75% attendance is always High academic risk
    assert (s[s.attendance_term < 75].academic_risk == "High").all()
    # filters: segment names contain commas and must still match exactly
    from app.main import apply_filters
    assert len(apply_filters(s, segment="Academic Star, Placement-Unready")) == (s.segment == "Academic Star, Placement-Unready").sum() > 0
    assert len(apply_filters(s, academic_risk="High,Medium")) == s.academic_risk.isin(["High", "Medium"]).sum()
    # auth: new Prajna logins work, pre-rebrand Pragati logins still work, wrong password fails
    from fastapi import HTTPException
    from app import auth
    assert auth.login("admin@prajna.demo", "Prajna@2026")["user"]["role"] == "admin"
    assert auth.login("admin@pragati.demo", "Pragati@2026")["user"]["email"] == "admin@prajna.demo"
    try:
        auth.login("admin@prajna.demo", "wrong"); raise AssertionError("bad password accepted")
    except HTTPException as e:
        assert e.status_code == 401
    # student role: sees only their own record, blocked from staff views and write actions
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as client:
        tok = client.post("/api/v1/auth/login", json={"email": "student@prajna.demo", "password": "Prajna@2026"}).json()["token"]
        h = {"Authorization": f"Bearer {tok}"}
        me = client.get("/api/v1/auth/me", headers=h).json()
        assert me["role"] == "student" and me["scope"] == {"student_id": "CS23-0115"}
        assert client.get("/api/v1/students/CS23-0115", headers=h).status_code == 200
        assert client.get("/api/v1/students/CS22-0155", headers=h).status_code == 404       # someone else
        assert client.post("/api/v1/students/CS23-0115/simulate", json={"overrides": {"coding": 70}}, headers=h).status_code == 200
        assert client.post("/api/v1/students/CS23-0115/brief", headers=h).status_code == 200
        for path in ["/api/v1/overview", "/api/v1/students", "/api/v1/segments", "/api/v1/interventions", "/api/v1/data-quality"]:
            assert client.get(path, headers=h).status_code == 403, path
        assert client.post("/api/v1/interventions", json={"student_ids": ["CS23-0115"], "action": "x" * 5}, headers=h).status_code == 403
        assert client.post("/api/v1/copilot/query", json={"question": "hi"}, headers=h).status_code == 403
    # what-if: better coding + mocks must not increase placement risk
    row = s[s.placement_risk == "High"].iloc[0].to_dict()
    feats = {k: row[k] for k in ["student_id", "dept", "year"] + list(scoring.INDICATORS) + ["attendance_trend", "lms_trend"]}
    before = scoring.simulate(feats, {}, st["weights"][1], st["models"], st["ref"])
    after = scoring.simulate(feats, {"coding": 85, "mock_interviews": 3, "aptitude": 85}, st["weights"][1], st["models"], st["ref"])
    assert after["placement_risk_prob"] < before["placement_risk_prob"] and after["success_score"] > before["success_score"]


if __name__ == "__main__":
    test_end_to_end()
    print("ok")
