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

# 행사 예산·목표 이익 (Figma: 예산·손익)
_EVENT_EXTRA_COLUMNS.update({
    "budget": "INTEGER NOT NULL DEFAULT 0",
    "target_profit": "INTEGER NOT NULL DEFAULT 0",
})

# 상품 원가 (Figma: 준비 수량과 원가 편집)
_PRODUCT_EXTRA_COLUMNS = {
    "cost": "INTEGER NOT NULL DEFAULT 0",
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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS event_expenses (
                id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT '',
                name TEXT NOT NULL,
                planned INTEGER NOT NULL DEFAULT 0,
                actual INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS event_sales (
                id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL,
                payment_method TEXT NOT NULL DEFAULT 'card',
                total INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS event_sale_items (
                sale_id TEXT NOT NULL,
                event_id TEXT NOT NULL,
                product_id TEXT NOT NULL,
                qty INTEGER NOT NULL,
                price INTEGER NOT NULL
            )
            """
        )
        sale_cols = {r[1] for r in conn.execute("PRAGMA table_info(event_sale_items)")}
        if "cost" not in sale_cols:
            conn.execute("ALTER TABLE event_sale_items ADD COLUMN cost INTEGER NOT NULL DEFAULT 0")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS ad_registrations (
                request_id TEXT PRIMARY KEY,
                store_id TEXT NOT NULL,
                campaign_id TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL,
                result TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        cols = {r[1] for r in conn.execute("PRAGMA table_info(products)")}
        for col, ddl in _PRODUCT_EXTRA_COLUMNS.items():
            if col not in cols:
                conn.execute(f"ALTER TABLE products ADD COLUMN {col} {ddl}")
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

PRODUCT_FIELDS = ("sku", "name", "price", "stock", "url", "selling_point", "cost")


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
EVENT_MONEY_FIELDS = ("budget", "target_profit")


def create_event(store_id: str, data: dict) -> str:
    return _insert("events", "ev", store_id, {k: data[k] for k in EVENT_FIELDS})


def get_event(store_id: str, event_id: str) -> dict | None:
    return _get("events", store_id, event_id)


def list_events(store_id: str) -> list[dict]:
    return _list("events", store_id, "COALESCE(start_date, '9999'), created_at")


def update_event(store_id: str, event_id: str, changes: dict) -> None:
    _update("events", store_id, event_id, changes, EVENT_FIELDS + EVENT_PUBLIC_FIELDS + EVENT_MONEY_FIELDS)


def get_event_public(event_id: str) -> dict | None:
    """방문객용: store_id 없이 조회 (공개된 행사만 쓰도록 라우터에서 확인)."""
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    return dict(row) if row else None


def delete_event(store_id: str, event_id: str) -> None:
    _delete("events", store_id, event_id)
    with get_conn() as conn:
        for table in ("event_products", "event_plans", "event_supplies", "checklist_items", "event_expenses", "event_sales", "event_sale_items"):
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


# ---------- 예산·지출 (Figma: 예산·손익) ----------

def list_expenses(event_id: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM event_expenses WHERE event_id = ? ORDER BY created_at, rowid", (event_id,)).fetchall()
    return [dict(r) for r in rows]


def set_expenses(event_id: str, items: list[dict]) -> None:
    now = _now()
    with get_conn() as conn:
        conn.execute("DELETE FROM event_expenses WHERE event_id = ?", (event_id,))
        conn.executemany(
            "INSERT INTO event_expenses (id, event_id, category, name, planned, actual, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [(f"ex_{secrets.token_hex(4)}", event_id, i.get("category", ""), i["name"], i.get("planned", 0), i.get("actual", 0), now) for i in items],
        )


def set_event_product_qty(event_id: str, product_id: str, qty: int) -> None:
    with get_conn() as conn:
        conn.execute("UPDATE event_products SET planned_qty = ? WHERE event_id = ? AND product_id = ?", (qty, event_id, product_id))


# ---------- 현장 판매 (Figma: 현장 판매 입력 → 재고 반영) ----------

def add_sale(event_id: str, payment_method: str, items: list[dict]) -> str:
    sale_id = f"sl_{secrets.token_hex(4)}"
    total = sum(i["qty"] * i["price"] for i in items)
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO event_sales (id, event_id, payment_method, total, created_at) VALUES (?, ?, ?, ?, ?)",
            (sale_id, event_id, payment_method, total, _now()),
        )
        conn.executemany(
            "INSERT INTO event_sale_items (sale_id, event_id, product_id, qty, price, cost) VALUES (?, ?, ?, ?, ?, ?)",
            [(sale_id, event_id, i["product_id"], i["qty"], i["price"], i.get("cost", 0)) for i in items],
        )
    return sale_id


def list_sales(event_id: str) -> list[dict]:
    with get_conn() as conn:
        sales = [dict(r) for r in conn.execute("SELECT * FROM event_sales WHERE event_id = ? ORDER BY created_at DESC, rowid DESC", (event_id,))]
        items = [dict(r) for r in conn.execute(
            "SELECT si.*, p.name FROM event_sale_items si LEFT JOIN products p ON p.id = si.product_id WHERE si.event_id = ?", (event_id,))]
    for s in sales:
        s["items"] = [i for i in items if i["sale_id"] == s["id"]]
    return sales


def sold_qty_by_product(event_id: str) -> dict[str, int]:
    with get_conn() as conn:
        rows = conn.execute("SELECT product_id, SUM(qty) q FROM event_sale_items WHERE event_id = ? GROUP BY product_id", (event_id,)).fetchall()
    return {r["product_id"]: r["q"] for r in rows}


def delete_sale(event_id: str, sale_id: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM event_sales WHERE id = ? AND event_id = ?", (sale_id, event_id))
        conn.execute("DELETE FROM event_sale_items WHERE sale_id = ?", (sale_id,))
    return cur.rowcount > 0


def sold_contribution(event_id: str) -> tuple[int, int, int]:
    """(판매 수량, 판매 당시 가격 기준 매출, 판매 당시 원가 합계)"""
    with get_conn() as conn:
        r = conn.execute("SELECT COALESCE(SUM(qty),0), COALESCE(SUM(qty*price),0), COALESCE(SUM(qty*cost),0) FROM event_sale_items WHERE event_id = ?",
                         (event_id,)).fetchone()
    return int(r[0]), int(r[1]), int(r[2])


# ---------- 광고 신청 기록 (중복 등록 방지) ----------

def get_ad_registration(store_id: str, request_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM ad_registrations WHERE request_id = ? AND store_id = ?", (request_id, store_id)).fetchone()
    return dict(row) if row else None


def save_ad_registration(store_id: str, request_id: str, campaign_id: str, status: str, result: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO ad_registrations (request_id, store_id, campaign_id, status, result, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (request_id, store_id, campaign_id, status, result, _now()),
        )
