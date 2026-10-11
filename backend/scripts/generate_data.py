"""Generate a realistic, deliberately messy synthetic campus dataset (8 source CSVs).

Each student gets latent traits (ability, motivation, career focus, sociability) that drive
correlated indicators across all sources, so the analytics find real patterns. ~8% of students
suffer a mid-term "shock" (attendance + LMS collapse) which produces the Sliding cases.

Usage: python scripts/generate_data.py [out_dir]
"""
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

SEED = 42
N = 1200
WEEKS = 12
TERM_START = date(2026, 7, 6)  # odd semester, Jul-Sep 2026
DEPTS = {"CSE": ("CS", 0.30), "IT": ("IT", 0.15), "ECE": ("EC", 0.20), "ME": ("ME", 0.20), "CE": ("CE", 0.15)}
FIRST = ["Aarav", "Vivaan", "Aditya", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan", "Rohan", "Kabir",
         "Ananya", "Diya", "Aadhya", "Riya", "Saanvi", "Priya", "Kavya", "Meera", "Isha", "Neha",
         "Rahul", "Vikram", "Karthik", "Nikhil", "Harsh", "Pooja", "Sneha", "Divya", "Lakshmi", "Tanvi",
         "Yash", "Aman", "Siddharth", "Varun", "Manish", "Shreya", "Nandini", "Aishwarya", "Pallavi", "Gayatri"]
LAST = ["Sharma", "Verma", "Reddy", "Iyer", "Nair", "Patel", "Gupta", "Singh", "Kumar", "Rao",
        "Joshi", "Mehta", "Das", "Banerjee", "Pillai", "Menon", "Kulkarni", "Deshpande", "Chopra", "Agarwal"]
STATES = ["Telangana", "Andhra Pradesh", "Karnataka", "Tamil Nadu", "Maharashtra", "Kerala", "Uttar Pradesh", "Bihar", "Odisha", "West Bengal"]
CATEGORIES = (["General", "OBC", "SC", "ST", "EWS"], [0.40, 0.30, 0.15, 0.07, 0.08])
SUBJECTS = {
    "CS": ["Data Structures", "Algorithms", "Operating Systems", "DBMS", "Computer Networks", "Compiler Design", "Machine Learning", "Software Engineering", "Theory of Computation", "Cloud Computing"],
    "IT": ["Programming in C", "Web Technologies", "DBMS", "Computer Networks", "Information Security", "Data Mining", "Software Testing", "Mobile Computing", "Big Data Analytics", "IoT"],
    "EC": ["Electronic Devices", "Signals & Systems", "Digital Electronics", "Analog Circuits", "Microprocessors", "Communication Systems", "VLSI Design", "Control Systems", "Antennas", "Embedded Systems"],
    "ME": ["Engineering Mechanics", "Thermodynamics", "Fluid Mechanics", "Strength of Materials", "Machine Design", "Manufacturing Processes", "Heat Transfer", "Dynamics of Machinery", "CAD/CAM", "Automobile Engineering"],
    "CE": ["Surveying", "Strength of Materials", "Fluid Mechanics", "Structural Analysis", "Geotechnical Engg", "Concrete Technology", "Transportation Engg", "Environmental Engg", "Hydrology", "Estimation & Costing"],
}
COMMON = ["Engineering Mathematics", "Engineering Physics", "Engineering Chemistry", "Communication Skills", "Problem Solving with Python"]
COMMENTS = ["Classes are good", "Need more practical sessions", "Faculty is supportive", "Too much workload", "Placement training should start earlier",
            "Labs need better equipment", "Happy with mentoring", "Feeling stressed about exams", "", ""]

rng = np.random.default_rng(SEED)
sig = lambda x: 1 / (1 + np.exp(-x))
clip = lambda x, lo=0, hi=100: float(np.clip(x, lo, hi))


def students():
    rows, seq = [], {}
    codes = list(DEPTS)
    dept_idx = rng.choice(len(codes), N, p=[v[1] for v in DEPTS.values()])
    for i in range(N):
        dept = codes[dept_idx[i]]
        code = DEPTS[dept][0]
        year = int(rng.integers(1, 5))
        adm = 26 - year
        seq[(code, adm)] = seq.get((code, adm), 100) + int(rng.integers(1, 4))
        s = seq[(code, adm)]
        first, last = rng.choice(FIRST), rng.choice(LAST)
        gender = "F" if first in FIRST[10:20] + FIRST[25:30] + FIRST[35:] else "M"
        ability, motivation, career, social = rng.normal(0, 1, 4)
        motivation = 0.6 * motivation + 0.3 * ability
        shock = rng.random() < 0.08
        rows.append(dict(
            student_id=f"{code}{adm:02d}-{s:04d}", roll_no=f"R{adm}{code}{s:03d}",
            name=f"{first} {last}", email=f"{first.lower()}.{last.lower()}.{code.lower()}{adm}{s}@pragati.edu",
            gender=gender, dob=str(date(2008 - year, 1, 1) + timedelta(days=int(rng.integers(0, 365)))),
            dept=dept, program="B.Tech", year=year, section=rng.choice(["A", "B", "C"]),
            mentor_id=f"M-{code}-{year}{int(rng.integers(1, 4))}",
            admission_category=rng.choice(CATEGORIES[0], p=CATEGORIES[1]), home_state=rng.choice(STATES),
            _ability=ability, _motivation=motivation, _career=career, _social=social,
            _shock_week=int(rng.integers(7, 11)) if shock else 99, _code=code,
        ))
    return pd.DataFrame(rows)


def messy_id(sid):
    """Same student, different system conventions: cs22-0147 / CS220147 / CS 22 0147."""
    code, rest = sid[:2], sid[2:]
    adm, num = rest.split("-")
    return rng.choice([sid.lower(), f"{code}{adm}{num}", f"{code} {adm} {num}", f" {sid} "])


def academic(st):
    rows = []
    difficulty = {}
    for _, s in st.iterrows():
        pool = SUBJECTS[s._code]
        cur_sem = 2 * s.year - 1
        variant = rng.random() < 0.08
        for sem in range(1, cur_sem + 1):
            for k in range(5):
                subj_code = f"{s._code}{sem}0{k + 1}"
                name = COMMON[k] if sem <= 2 and k < 3 else pool[(sem * 5 + k) % len(pool)]
                if subj_code not in difficulty:
                    # one deliberately hard subject per dept in each odd semester → backlog hotspot
                    difficulty[subj_code] = rng.normal(0, 4) + (14 if (k == 1 and sem % 2 == 1 and sem > 1) else 0)
                total = clip(64 + 13 * s._ability + 6 * s._motivation - difficulty[subj_code] + rng.normal(0, 9), 8, 99)
                current = sem == cur_sem
                if current and s._shock_week < 99:
                    total = clip(total - 12)
                internal = round(clip(total * 0.4 + rng.normal(0, 2), 0, 40))
                external = None if current else round(clip(total * 0.6 + rng.normal(0, 3), 0, 60))
                sid = messy_id(s.student_id) if variant else s.student_id
                r = dict(student_id=sid, semester=sem, subject_code=subj_code, subject_name=name,
                         internal=internal, external=external, credits=4 if k < 3 else 3)
                if rng.random() < 0.005:
                    r["internal"] = "AB"
                rows.append(r)
    df = pd.DataFrame(rows)
    return pd.concat([df, df.sample(frac=0.01, random_state=1)])  # duplicate uploads


def attendance(st):
    rows = []
    for _, s in st.iterrows():
        cur_sem = 2 * s.year - 1
        for k in range(5):
            subj = f"{s._code}{cur_sem}0{k + 1}"
            p0 = sig(2.4 + 0.9 * s._motivation + 0.3 * s._ability - (0.4 if k == 4 else 0))
            for w in range(1, WEEKS + 1):
                held = int(rng.choice([3, 4]))
                p = max(0.05, p0 - (0.5 if w >= s._shock_week else 0))
                att = int(rng.binomial(held, p))
                if rng.random() < 0.003:
                    att = held + 1  # data entry error
                roll = s.roll_no.lower() if rng.random() < 0.03 else s.roll_no
                rows.append(dict(roll_no=roll, subject_code=subj, week=w, classes_held=held, classes_attended=att))
    df = pd.DataFrame(rows)
    return pd.concat([df, df.sample(frac=0.01, random_state=2)])


def lms(st):
    rows = []
    for _, s in st.iterrows():
        for w in range(1, WEEKS + 1):
            shocked = w >= s._shock_week
            logins = int(rng.poisson(max(0.3, 3.2 + 1.6 * s._motivation) * (0.2 if shocked else 1)))
            due = int(rng.integers(1, 3))
            sub = int(rng.binomial(due, max(0.02, sig(1.3 + 1.3 * s._motivation) - (0.6 if shocked else 0))))
            on_time = int(rng.binomial(sub, sig(0.8 + 1.0 * s._motivation)))
            quiz = round(clip(58 + 13 * s._ability + 6 * s._motivation + rng.normal(0, 8)), 1) if rng.random() < 0.5 else None
            email = s.email.upper() if rng.random() < 0.1 else (s.email + " " if rng.random() < 0.05 else s.email)
            rows.append(dict(email=email, week_start=str(TERM_START + timedelta(weeks=w - 1)), logins=logins,
                             assignments_due=due, assignments_submitted=sub, submitted_on_time=on_time, avg_quiz_score=quiz))
    return pd.DataFrame(rows)


def engagement(st):
    rows = []
    kinds = ["club", "event", "hackathon", "sports", "certification", "volunteering"]
    for _, s in st.iterrows():
        n = int(rng.poisson(np.exp(0.5 + 0.6 * s._social + 0.2 * s._career)))
        for _ in range(n):
            kind = rng.choice(kinds, p=[0.25, 0.25, 0.12 + 0.0, 0.13, 0.15, 0.10])
            d = TERM_START - timedelta(days=int(rng.integers(0, 330)))
            dstr = rng.choice([d.isoformat(), d.strftime("%d/%m/%Y"), d.strftime("%d %b %Y")])
            role = "lead" if rng.random() < sig(-2.2 + 0.9 * s._social) else rng.choice(["participant", "organizer"], p=[0.8, 0.2])
            rows.append(dict(student_id=s.student_id, activity_type=kind, title=f"{kind.title()} activity", date=dstr, role=role))
    df = pd.DataFrame(rows)
    return pd.concat([df, df.sample(frac=0.02, random_state=3)])


def placement(st):
    rows = []
    for _, s in st.iterrows():
        n = 2 if s.year >= 3 else (1 if rng.random() < 0.3 else 0)
        boost = 8 if s._code in ("CS", "IT") else 0
        for j in range(n):
            apt = clip(52 + 12 * s._ability + 7 * s._career + rng.normal(0, 8) + 3 * j)
            cod = clip(38 + 10 * s._ability + 16 * s._career + boost + rng.normal(0, 9) + 4 * j)
            mocks = int(rng.poisson(np.exp(-0.2 + 0.9 * s._career))) if s.year >= 3 else None
            rating = round(clip(3 + 0.6 * s._social + 0.4 * s._career + rng.normal(0, 0.5), 1, 5), 1) if mocks else None
            apt_v = f"{apt:.0f}%" if rng.random() < 0.05 else round(apt, 1)
            if rng.random() < 0.01:
                cod = 104.0
            rows.append(dict(student_id=s.student_id, assessed_on=str(TERM_START + timedelta(weeks=3 + 6 * j)),
                             aptitude_score=apt_v, coding_score=round(cod, 1), mock_interviews=mocks, mock_rating=rating))
    return pd.DataFrame(rows)


def skills(st):
    rows = []
    for _, s in st.iterrows():
        tech = clip(50 + 10 * s._ability + 11 * s._career + rng.normal(0, 8))
        comm = clip(56 + 12 * s._social + 5 * s._motivation + rng.normal(0, 8))
        team = clip(60 + 9 * s._social + 4 * s._motivation + rng.normal(0, 8))
        if rng.random() < 0.01:
            tech = rng.choice([-5.0, 120.0])
        rows.append(dict(student_id=s.student_id, assessed_on=str(TERM_START + timedelta(weeks=4)), technical_score=round(tech, 1),
                         communication_score=round(comm, 1), teamwork_score=round(team, 1),
                         certifications_count=int(rng.poisson(np.exp(-0.4 + 0.7 * s._career)))))
    return pd.DataFrame(rows)


def feedback(st):
    rows = []
    for _, s in st.iterrows():
        shocked = s._shock_week < 99
        sat = int(round(clip(3.4 + 0.6 * s._motivation + 0.3 * s._social - (1.2 if shocked else 0) + rng.normal(0, 0.6), 1, 5)))
        fac = int(round(clip(3.3 + 0.7 * s._ability + 0.5 * s._motivation + rng.normal(0, 0.5), 1, 5)))
        sat_v = f"{sat}/5" if rng.random() < 0.1 else sat
        if rng.random() < 0.05:
            sat_v = None
        rows.append(dict(student_id=s.student_id, term="2026-ODD", satisfaction=sat_v, faculty_rating=fac,
                         comments=("Feeling stressed and missing classes" if shocked and rng.random() < 0.5 else rng.choice(COMMENTS))))
    return pd.DataFrame(rows)


def outcomes(st):
    """Historical-style outcome labels used to train the risk models (synthetic ground truth)."""
    shock = (st._shock_week < 99).astype(float)
    p_acad = sig(-1.9 - 1.5 * st._ability - 1.1 * st._motivation + 1.8 * shock)
    p_plac = sig(-0.6 - 1.3 * st._career - 0.7 * st._ability - 0.3 * st._social)
    return pd.DataFrame(dict(student_id=st.student_id, academic_setback=(rng.random(N) < p_acad).astype(int),
                             placement_unready=(rng.random(N) < p_plac).astype(int)))


def orphans(df, col, n, make):
    """Rows whose ID matches no student (typos / transferred students) → shows unmatched-ID handling."""
    extra = df.sample(n, random_state=4).copy()
    extra[col] = [make(i) for i in range(n)]
    return pd.concat([df, extra])


def main(out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    st = students()
    files = {
        "academic": orphans(academic(st), "student_id", 12, lambda i: f"XX23-{9000 + i}"),
        "attendance": orphans(attendance(st), "roll_no", 20, lambda i: f"R23XX{900 + i}"),
        "lms": lms(st),
        "engagement": engagement(st),
        "placement": orphans(placement(st), "student_id", 5, lambda i: f"CS19-{9900 + i}"),
        "skills": skills(st),
        "feedback": feedback(st),
    }
    erp = st[[c for c in st.columns if not c.startswith("_")]]
    erp = pd.concat([erp, erp.sample(8, random_state=5)])  # duplicate ERP rows
    erp.to_csv(out / "erp_students.csv", index=False)
    for name, df in files.items():
        df.sample(frac=1, random_state=6).to_csv(out / f"{name}.csv", index=False)
    outcomes(st).to_csv(out / "outcome_labels.csv", index=False)
    print(f"wrote {len(files) + 2} files to {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "data" / "raw")
