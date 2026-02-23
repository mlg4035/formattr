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


def init_history_db() -> None:
    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS history (
                document_uuid TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                input_text TEXT NOT NULL,
                formatted_text TEXT NOT NULL,
                created_at TEXT NOT NULL,
                rating INTEGER
            )
            """
        )


def add_history_item(title: str, input_text: str, formatted_text: str) -> str:
    item_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat()
    with _get_conn() as conn:
        conn.execute(
            """
            INSERT INTO history (document_uuid, title, input_text, formatted_text, created_at, rating)
            VALUES (?, ?, ?, ?, ?, NULL)
            """,
            (item_id, title, input_text, formatted_text, created_at),
        )
    return item_id


def fetch_history() -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT document_uuid, title, input_text, formatted_text, created_at, rating FROM history ORDER BY datetime(created_at) DESC"
        ).fetchall()
    return [dict(row) for row in rows]


def fetch_history_item(item_id: str) -> dict | None:
    with _get_conn() as conn:
        row = conn.execute(
            """
            SELECT document_uuid, title, input_text, formatted_text, created_at, rating
            FROM history
            WHERE document_uuid = ?
            """,
            (item_id,),
        ).fetchone()
    return dict(row) if row else None


def update_history_rating(item_id: str, rating: int | None) -> None:
    with _get_conn() as conn:
        conn.execute(
            "UPDATE history SET rating = ? WHERE document_uuid = ?",
            (rating, item_id),
        )


def update_history_title(item_id: str, title: str) -> None:
    with _get_conn() as conn:
        conn.execute(
            "UPDATE history SET title = ? WHERE document_uuid = ?",
            (title, item_id),
        )


def remove_history_item(item_id: str) -> None:
    with _get_conn() as conn:
        conn.execute("DELETE FROM history WHERE document_uuid = ?", (item_id,))
