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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                store_id TEXT NOT NULL,
                sku TEXT NOT NULL DEFAULT '',
                name TEXT NOT NULL,
                price INTEGER NOT NULL DEFAULT 0,
                stock INTEGER NOT NULL DEFAULT 0,
                url TEXT NOT NULL DEFAULT '',
                selling_point TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                store_id TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'popup',
                start_date TEXT,
                end_date TEXT,
                location TEXT NOT NULL DEFAULT '',
                hours TEXT NOT NULL DEFAULT '',
                apply_deadline TEXT NOT NULL DEFAULT '',
                load_in_time TEXT NOT NULL DEFAULT '',
                fee TEXT NOT NULL DEFAULT '',
                booth_size TEXT NOT NULL DEFAULT '',
                expected_visitors INTEGER NOT NULL DEFAULT 0,
                source_url TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'planning',
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS event_products (
                event_id TEXT NOT NULL,
                product_id TEXT NOT NULL,
                planned_qty INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (event_id, product_id)
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


# ---------- 공통 ----------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _insert(table: str, prefix: str, store_id: str, data: dict) -> str:
    new_id = f"{prefix}_" + secrets.token_hex(4)
    cols = ["id", "store_id", *data.keys(), "created_at"]
    with get_conn() as conn:
        conn.execute(
            f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
            [new_id, store_id, *data.values(), _now()],
        )
    return new_id


def _get(table: str, store_id: str, item_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(f"SELECT * FROM {table} WHERE id = ? AND store_id = ?", (item_id, store_id)).fetchone()
    return dict(row) if row else None


def _list(table: str, store_id: str, order: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(f"SELECT * FROM {table} WHERE store_id = ? ORDER BY {order}", (store_id,)).fetchall()
    return [dict(r) for r in rows]


def _update(table: str, store_id: str, item_id: str, changes: dict, allowed: tuple) -> None:
    changes = {k: v for k, v in changes.items() if k in allowed}
    if not changes:
        return
    sets = ", ".join(f"{k} = ?" for k in changes)
    with get_conn() as conn:
        conn.execute(f"UPDATE {table} SET {sets} WHERE id = ? AND store_id = ?", [*changes.values(), item_id, store_id])


def _delete(table: str, store_id: str, item_id: str) -> None:
    with get_conn() as conn:
        conn.execute(f"DELETE FROM {table} WHERE id = ? AND store_id = ?", (item_id, store_id))


# ---------- 상품 ----------

PRODUCT_FIELDS = ("sku", "name", "price", "stock", "url", "selling_point")


def create_product(store_id: str, data: dict) -> str:
    return _insert("products", "pd", store_id, {k: data[k] for k in PRODUCT_FIELDS})


def get_product(store_id: str, product_id: str) -> dict | None:
    return _get("products", store_id, product_id)


def list_products(store_id: str) -> list[dict]:
    return _list("products", store_id, "created_at")


def update_product(store_id: str, product_id: str, changes: dict) -> None:
    _update("products", store_id, product_id, changes, PRODUCT_FIELDS)


def delete_product(store_id: str, product_id: str) -> None:
    _delete("products", store_id, product_id)
    with get_conn() as conn:
        conn.execute("DELETE FROM event_products WHERE product_id = ?", (product_id,))


# ---------- 행사 ----------

EVENT_FIELDS = (
    "name", "type", "start_date", "end_date", "location", "hours", "apply_deadline",
    "load_in_time", "fee", "booth_size", "expected_visitors", "source_url", "status",
)


def create_event(store_id: str, data: dict) -> str:
    return _insert("events", "ev", store_id, {k: data[k] for k in EVENT_FIELDS})


def get_event(store_id: str, event_id: str) -> dict | None:
    return _get("events", store_id, event_id)


def list_events(store_id: str) -> list[dict]:
    return _list("events", store_id, "COALESCE(start_date, '9999'), created_at")


def update_event(store_id: str, event_id: str, changes: dict) -> None:
    _update("events", store_id, event_id, changes, EVENT_FIELDS)


def delete_event(store_id: str, event_id: str) -> None:
    _delete("events", store_id, event_id)
    with get_conn() as conn:
        conn.execute("DELETE FROM event_products WHERE event_id = ?", (event_id,))


def set_event_products(event_id: str, items: list[tuple[str, int]]) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM event_products WHERE event_id = ?", (event_id,))
        conn.executemany(
            "INSERT INTO event_products (event_id, product_id, planned_qty) VALUES (?, ?, ?)",
            [(event_id, pid, qty) for pid, qty in items],
        )


def get_event_products(event_id: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT p.*, ep.planned_qty FROM event_products ep
            JOIN products p ON p.id = ep.product_id
            WHERE ep.event_id = ? ORDER BY p.created_at
            """,
            (event_id,),
        ).fetchall()
    return [dict(r) for r in rows]
