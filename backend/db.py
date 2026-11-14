import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

from config import DB_PATH

STORE_FIELDS = (
    "name",
    "category",
    "intro",
    "tone",
    "target_customer",
    "sales_channel",
    "region",
    "monthly_budget",
)

# 예전 DB에 없던 컬럼 자동 추가용
_STORE_EXTRA_COLUMNS = {
    "intro": "TEXT NOT NULL DEFAULT ''",
    "target_customer": "TEXT NOT NULL DEFAULT ''",
    "sales_channel": "TEXT NOT NULL DEFAULT ''",
}


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
                intro TEXT NOT NULL DEFAULT '',
                tone TEXT NOT NULL DEFAULT '',
                target_customer TEXT NOT NULL DEFAULT '',
                sales_channel TEXT NOT NULL DEFAULT '',
                region TEXT NOT NULL DEFAULT '',
                monthly_budget INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """
        )
        existing = {row["name"] for row in conn.execute("PRAGMA table_info(stores)")}
        for col, ddl in _STORE_EXTRA_COLUMNS.items():
            if col not in existing:
                conn.execute(f"ALTER TABLE stores ADD COLUMN {col} {ddl}")


def create_store(data: dict) -> str:
    store_id = "st_" + secrets.token_hex(3)
    cols = ", ".join(("id",) + STORE_FIELDS + ("created_at",))
    marks = ", ".join("?" * (len(STORE_FIELDS) + 2))
    values = [store_id] + [data[f] for f in STORE_FIELDS] + [datetime.now(timezone.utc).isoformat()]
    with get_conn() as conn:
        conn.execute(f"INSERT INTO stores ({cols}) VALUES ({marks})", values)
    return store_id


def get_store(store_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM stores WHERE id = ?", (store_id,)).fetchone()
    return dict(row) if row else None


def update_store(store_id: str, changes: dict) -> None:
    changes = {k: v for k, v in changes.items() if k in STORE_FIELDS}
    if not changes:
        return
    sets = ", ".join(f"{k} = ?" for k in changes)
    with get_conn() as conn:
        conn.execute(f"UPDATE stores SET {sets} WHERE id = ?", [*changes.values(), store_id])
