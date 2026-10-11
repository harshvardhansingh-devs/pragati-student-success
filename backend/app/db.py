import os
from pathlib import Path

from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parents[2]
DATABASE_URL = os.getenv("DATABASE_URL") or f"sqlite:///{ROOT / 'backend' / 'pragati.db'}"
# Supabase/Heroku-style URLs → SQLAlchemy psycopg3 driver
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)


def init_app_tables():
    serial = "INTEGER PRIMARY KEY AUTOINCREMENT" if engine.dialect.name == "sqlite" else "SERIAL PRIMARY KEY"
    with engine.begin() as c:
        c.execute(text(f"""CREATE TABLE IF NOT EXISTS app_interventions (
            id {serial}, student_id VARCHAR(20) NOT NULL, action VARCHAR(200) NOT NULL, reason VARCHAR(300),
            owner VARCHAR(100), status VARCHAR(20) DEFAULT 'open', due_date VARCHAR(10), notes TEXT,
            score_at_creation FLOAT, created_by VARCHAR(100), created_at VARCHAR(30), updated_at VARCHAR(30))"""))
        c.execute(text(f"""CREATE TABLE IF NOT EXISTS app_audit_log (
            id {serial}, user_email VARCHAR(100), action VARCHAR(50), entity VARCHAR(50), entity_id VARCHAR(50), at VARCHAR(30))"""))
        c.execute(text("""CREATE TABLE IF NOT EXISTS app_weight_configs (
            version INTEGER PRIMARY KEY, weights TEXT NOT NULL, created_by VARCHAR(100), created_at VARCHAR(30))"""))
        c.execute(text("""CREATE TABLE IF NOT EXISTS app_pipeline_runs (
            run_id INTEGER PRIMARY KEY, started_at VARCHAR(30), finished_at VARCHAR(30), weights_version INTEGER, summary TEXT)"""))


def has_table(name):
    from sqlalchemy import inspect
    return inspect(engine).has_table(name)
