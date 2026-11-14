"""홈 = 행사 개요 (Figma: 홈 화면). 사이드바에서 고른 행사(event_id)의 실제 데이터를 보여준다."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query

import db
from deps import current_store
from routers.events import _checklist_out, _d_day
from schemas import HomeDeadline, HomeEvent, HomeOut, HomeProduct, HomeProductCard, HomeTodo

router = APIRouter(prefix="/api/home", tags=["home"])
KST = timezone(timedelta(hours=9))


def _pick_event(store_id: str, event_id: str | None) -> dict | None:
    events = db.list_events(store_id)
    if not events:
        return None
    if event_id:
        for e in events:
            if e["id"] == event_id:
                return e
    today = datetime.now(KST).date().isoformat()
    upcoming = [e for e in events if e.get("status") != "done" and (e.get("end_date") or e.get("start_date") or "9999") >= today]
    return upcoming[0] if upcoming else events[0]


@router.get("", response_model=HomeOut, summary="행사 개요: 지금 할 일 · 다가오는 마감 · 판매 상품 (event_id 없으면 다가오는 첫 행사)")
def get_home(event_id: str | None = Query(None, description="사이드바에서 고른 행사"), store: dict = Depends(current_store)):
    ev = _pick_event(store["id"], event_id)
    if not ev:
        return HomeOut(event=None, todos=[], deadlines=[], products=[], is_sample=False)

    checklist = _checklist_out(ev).items
    # 지금 할 일: 완료 안 된 체크리스트 (진행 중 먼저, 그다음 마감 빠른 순)
    open_items = [c for c in checklist if c.status != "done"]
    open_items.sort(key=lambda c: (c.status != "doing", c.due_date or "9999"))
    todos = [HomeTodo(id=c.id, title=c.title, done=False) for c in open_items[:5]]

    # 다가오는 마감: 오늘 이후 마감인 체크리스트 + 참가 신청 마감
    today = datetime.now(KST).date()
    deadlines: list[HomeDeadline] = []
    for c in checklist:
        if c.status == "done" or not c.due_date:
            continue
        d = (datetime.fromisoformat(c.due_date).date() - today).days
        if d >= 0:
            deadlines.append(HomeDeadline(id=c.id, title=c.title, due_date=c.due_date, d_day=d))
    if ev.get("apply_deadline"):
        d = _d_day(ev["apply_deadline"])
        if d is not None and d >= 0:
            deadlines.append(HomeDeadline(id="apply", title="참가 신청 마감", due_date=ev["apply_deadline"][:10], d_day=d))
    deadlines.sort(key=lambda x: x.d_day if x.d_day is not None else 999)

    # 판매 상품: 준비 수량·남은 재고·판매
    sold = db.sold_qty_by_product(ev["id"])
    received = db.received_qty_by_product(ev["id"])  # 입고 완료된 추가 수량
    products = []
    for p in db.get_event_products(ev["id"]):
        n = sold.get(p["id"], 0)
        products.append(HomeProduct(id=p["id"], name=p["name"], image_url=None, cards=[
            HomeProductCard(id=f"{p['id']}_stock", label=f"준비 {p['planned_qty'] + received.get(p['id'], 0)}개 · 남은 {max(0, p['planned_qty'] + received.get(p['id'], 0) - n)}개"),
            HomeProductCard(id=f"{p['id']}_sold", label=f"판매 {n}개 · {n * p['price']:,}원"),
        ]))

    return HomeOut(
        event=HomeEvent(id=ev["id"], name=ev["name"], start_date=ev.get("start_date"), end_date=ev.get("end_date"),
                        d_day=_d_day(ev.get("start_date"))),
        todos=todos, deadlines=deadlines[:5], products=products, is_sample=False,
    )
