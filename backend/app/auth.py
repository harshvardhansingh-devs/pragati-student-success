import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# ponytail: random secret per process if unset → tokens die on restart / differ across instances; set JWT_SECRET in prod
SECRET = os.getenv("JWT_SECRET") or secrets.token_hex(32)
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "Pragati@2026")
_SALT = b"pragati-demo"


def _hash(pw):
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), _SALT, 100_000).hex()


# Demo accounts (one per role). Scope = which students the role can see.
USERS = {
    "admin@pragati.demo": dict(name="Dr. Anita Rao", role="admin", title="Principal / Admin", scope={}),
    "hod.cse@pragati.demo": dict(name="Dr. Suresh Menon", role="hod", title="HoD, Computer Science", scope={"dept": "CSE"}),
    "mentor@pragati.demo": dict(name="Prof. Kavitha Iyer", role="mentor", title="Faculty Mentor (CSE Y3)", scope={"mentor_id": "M-CS-31"}),
    "tpo@pragati.demo": dict(name="Mr. Rajesh Kulkarni", role="tpo", title="Training & Placement Officer", scope={}),
}
_PW = _hash(DEMO_PASSWORD)


def login(email, password):
    u = USERS.get(email.lower().strip())
    if not u or not hmac.compare_digest(_hash(password), _PW):
        raise HTTPException(401, "Invalid email or password")
    token = jwt.encode({"sub": email.lower().strip(), "exp": datetime.now(timezone.utc) + timedelta(hours=12)}, SECRET, algorithm="HS256")
    return dict(token=token, user=public(email.lower().strip()))


def public(email):
    u = USERS[email]
    return dict(email=email, name=u["name"], role=u["role"], title=u["title"], scope=u["scope"])


def current_user(cred: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False))):
    if not cred:
        raise HTTPException(401, "Not authenticated")
    try:
        email = jwt.decode(cred.credentials, SECRET, algorithms=["HS256"])["sub"]
    except jwt.PyJWTError:
        raise HTTPException(401, "Session expired, please log in again")
    if email not in USERS:
        raise HTTPException(401, "Unknown user")
    return public(email)


def require_admin(user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin role required")
    return user


def scope(df, user):
    for col, val in user["scope"].items():
        df = df[df[col] == val]
    return df
