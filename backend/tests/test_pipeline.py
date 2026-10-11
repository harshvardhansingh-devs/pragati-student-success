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
    # what-if: better coding + mocks must not increase placement risk
    row = s[s.placement_risk == "High"].iloc[0].to_dict()
    feats = {k: row[k] for k in ["student_id", "dept", "year"] + list(scoring.INDICATORS) + ["attendance_trend", "lms_trend"]}
    before = scoring.simulate(feats, {}, st["weights"][1], st["models"], st["ref"])
    after = scoring.simulate(feats, {"coding": 85, "mock_interviews": 3, "aptitude": 85}, st["weights"][1], st["models"], st["ref"])
    assert after["placement_risk_prob"] < before["placement_risk_prob"] and after["success_score"] > before["success_score"]


if __name__ == "__main__":
    test_end_to_end()
    print("ok")
