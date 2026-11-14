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

# 행사 테이블 추가 컬럼 (방문객용 안내 페이지)
_EVENT_EXTRA_COLUMNS = {
    "is_public": "INTEGER NOT NULL DEFAULT 0",
    "subscribe_url": "TEXT NOT NULL DEFAULT ''",
    "chat_plugin_key": "TEXT NOT NULL DEFAULT ''",
    "notice": "TEXT NOT NULL DEFAULT ''",
}

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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS event_plans (
                event_id TEXT PRIMARY KEY,
                purchase_rate REAL NOT NULL DEFAULT 0.15,
                qty_per_purchase INTEGER NOT NULL DEFAULT 1,
                buffer_qty INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS event_supplies (
                id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL,
                name TEXT NOT NULL,
                needed INTEGER NOT NULL DEFAULT 0,
                owned INTEGER NOT NULL DEFAULT 0,
                sort INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS checklist_items (
                id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL,
                title TEXT NOT NULL,
                d_minus INTEGER,
                category TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'todo',
                source_url TEXT NOT NULL DEFAULT '',
                sort INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS ad_connections (
                store_id TEXT NOT NULL,
                platform TEXT NOT NULL,
                customer_id TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'disconnected',
                message TEXT NOT NULL DEFAULT '',
                checked_at TEXT,
                PRIMARY KEY (store_id, platform)
            )
            """
        )
        ev_existing = {row["name"] for row in conn.execute("PRAGMA table_info(events)")}
        for col, ddl in _EVENT_EXTRA_COLUMNS.items():
            if col not in ev_existing:
                conn.execute(f"ALTER TABLE events ADD COLUMN {col} {ddl}")
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
EVENT_PUBLIC_FIELDS = ("is_public", "subscribe_url", "chat_plugin_key", "notice")


def create_event(store_id: str, data: dict) -> str:
    return _insert("events", "ev", store_id, {k: data[k] for k in EVENT_FIELDS})


def get_event(store_id: str, event_id: str) -> dict | None:
    return _get("events", store_id, event_id)


def list_events(store_id: str) -> list[dict]:
    return _list("events", store_id, "COALESCE(start_date, '9999'), created_at")


def update_event(store_id: str, event_id: str, changes: dict) -> None:
    _update("events", store_id, event_id, changes, EVENT_FIELDS + EVENT_PUBLIC_FIELDS)


def get_event_public(event_id: str) -> dict | None:
    """방문객용: store_id 없이 조회 (공개된 행사만 쓰도록 라우터에서 확인)."""
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    return dict(row) if row else None


def delete_event(store_id: str, event_id: str) -> None:
    _delete("events", store_id, event_id)
    with get_conn() as conn:
        for table in ("event_products", "event_plans", "event_supplies", "checklist_items"):
            conn.execute(f"DELETE FROM {table} WHERE event_id = ?", (event_id,))


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


# ---------- 준비물·재고 계획 ----------

PLAN_DEFAULTS = {"purchase_rate": 0.15, "qty_per_purchase": 1, "buffer_qty": 0}


def get_plan(event_id: str) -> dict:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM event_plans WHERE event_id = ?", (event_id,)).fetchone()
    return dict(row) if row else {"event_id": event_id, **PLAN_DEFAULTS}


def save_plan(event_id: str, changes: dict) -> None:
    plan = {**get_plan(event_id), **{k: v for k, v in changes.items() if k in PLAN_DEFAULTS}}
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO event_plans (event_id, purchase_rate, qty_per_purchase, buffer_qty) VALUES (?, ?, ?, ?)",
            (event_id, plan["purchase_rate"], plan["qty_per_purchase"], plan["buffer_qty"]),
        )


def list_supplies(event_id: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM event_supplies WHERE event_id = ? ORDER BY sort", (event_id,)).fetchall()
    return [dict(r) for r in rows]


def set_supplies(event_id: str, items: list[dict]) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM event_supplies WHERE event_id = ?", (event_id,))
        conn.executemany(
            "INSERT INTO event_supplies (id, event_id, name, needed, owned, sort) VALUES (?, ?, ?, ?, ?, ?)",
            [("sp_" + secrets.token_hex(4), event_id, i["name"], i["needed"], i["owned"], n) for n, i in enumerate(items)],
        )


# ---------- 준비 체크리스트 ----------

CHECKLIST_FIELDS = ("title", "d_minus", "category", "status", "source_url")


def list_checklist(event_id: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM checklist_items WHERE event_id = ? ORDER BY COALESCE(d_minus, -999) DESC, sort, created_at",
            (event_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def get_checklist_item(event_id: str, item_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM checklist_items WHERE id = ? AND event_id = ?", (item_id, event_id)).fetchone()
    return dict(row) if row else None


def add_checklist_items(event_id: str, items: list[dict]) -> None:
    with get_conn() as conn:
        conn.executemany(
            "INSERT INTO checklist_items (id, event_id, title, d_minus, category, status, source_url, sort, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                ("ck_" + secrets.token_hex(4), event_id, i["title"], i.get("d_minus"), i.get("category", ""),
                 i.get("status", "todo"), i.get("source_url", ""), n, _now())
                for n, i in enumerate(items)
            ],
        )


def delete_todo_checklist(event_id: str) -> None:
    """AI 다시 제안: 진행 중·완료 항목은 남기고 미완료 항목만 지움."""
    with get_conn() as conn:
        conn.execute("DELETE FROM checklist_items WHERE event_id = ? AND status = 'todo'", (event_id,))


def update_checklist_item(event_id: str, item_id: str, changes: dict) -> None:
    changes = {k: v for k, v in changes.items() if k in CHECKLIST_FIELDS}
    if not changes:
        return
    sets = ", ".join(f"{k} = ?" for k in changes)
    with get_conn() as conn:
        conn.execute(f"UPDATE checklist_items SET {sets} WHERE id = ? AND event_id = ?", [*changes.values(), item_id, event_id])


def delete_checklist_item(event_id: str, item_id: str) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM checklist_items WHERE id = ? AND event_id = ?", (item_id, event_id))


def checklist_progress(event_id: str) -> tuple[int, int]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done"
            " FROM checklist_items WHERE event_id = ?",
            (event_id,),
        ).fetchone()
    return (row["done"] or 0), row["total"]


# ---------- 광고 계정 연결 ----------

def get_ad_connection(store_id: str, platform: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM ad_connections WHERE store_id = ? AND platform = ?",
                           (store_id, platform)).fetchone()
    return dict(row) if row else None


def save_ad_connection(store_id: str, platform: str, customer_id: str, status: str, message: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO ad_connections (store_id, platform, customer_id, status, message, checked_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (store_id, platform, customer_id, status, message, _now()),
        )


def delete_ad_connection(store_id: str, platform: str) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM ad_connections WHERE store_id = ? AND platform = ?", (store_id, platform))
