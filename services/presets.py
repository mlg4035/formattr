import json
import sqlite3
from datetime import datetime
from pathlib import Path


DB_PATH = Path("data/app.db")


def _get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_preset_db() -> None:
    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS custom_presets (
                name TEXT PRIMARY KEY,
                settings_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )


def list_custom_presets() -> list[str]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT name FROM custom_presets ORDER BY LOWER(name) ASC"
        ).fetchall()
    return [str(row["name"]) for row in rows]


def get_custom_preset(name: str) -> dict | None:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT settings_json FROM custom_presets WHERE name = ?",
            (name,),
        ).fetchone()
    if not row:
        return None
    try:
        return json.loads(row["settings_json"])
    except json.JSONDecodeError:
        return None


def save_custom_preset(name: str, settings: dict) -> None:
    with _get_conn() as conn:
        conn.execute(
            """
            INSERT INTO custom_presets (name, settings_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
              settings_json = excluded.settings_json,
              updated_at = excluded.updated_at
            """,
            (name, json.dumps(settings), datetime.utcnow().isoformat()),
        )


def delete_custom_preset(name: str) -> None:
    with _get_conn() as conn:
        conn.execute("DELETE FROM custom_presets WHERE name = ?", (name,))
