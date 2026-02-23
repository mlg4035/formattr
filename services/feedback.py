import sqlite3
import uuid
from datetime import datetime
from pathlib import Path


DB_PATH = Path("data/app.db")


def _get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_feedback_db() -> None:
    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS feedback (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                text TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


def add_feedback(text: str, category: str = "feature") -> str:
    feedback_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat()
    with _get_conn() as conn:
        conn.execute(
            """
            INSERT INTO feedback (id, category, text, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (feedback_id, category, text, created_at),
        )
    return feedback_id
