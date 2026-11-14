import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

from config import DB_PATH


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS stores (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                region TEXT NOT NULL,
                tone TEXT NOT NULL,
                monthly_budget INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """
        )


def create_store(data: dict) -> str:
    store_id = "st_" + secrets.token_hex(3)
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO stores (id, name, category, region, tone, monthly_budget, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                store_id,
                data["name"],
                data["category"],
                data["region"],
                data["tone"],
                data["monthly_budget"],
                datetime.now(timezone.utc).isoformat(),
            ),
        )
    return store_id


def get_store(store_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM stores WHERE id = ?", (store_id,)).fetchone()
    return dict(row) if row else None
