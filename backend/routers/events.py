import logging
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response

import db
import liner
import llm
from deps import current_store
from prompts import EVENT_IMPORT_SYSTEM, event_import_user_prompt
from schemas import (
    EventImportIn,
    EventImportOut,
    EventIn,
    EventOut,
    EventProductIn,
    EventProductOut,
    EventUpdate,
    ImportField,
    ImportSource,
)

router = APIRouter(prefix="/api/events", tags=["events"])
log = logging.getLogger("mawd")
KST = timezone(timedelta(hours=9))


def _d_day(start: str | None) -> int | None:
    if not start:
        return None
    try:
        return (date.fromisoformat(start[:10]) - datetime.now(KST).date()).days
    except ValueError:
        return None


def _out(ev: dict) -> EventOut:
    products = [
        EventProductOut(
            product_id=p["id"],
            sku=p["sku"],
            name=p["name"],
            price=p["price"],
            stock=p["stock"],
            planned_qty=p["planned_qty"],
            shortage=max(0, p["planned_qty"] - p["stock"]),
        )
        for p in db.get_event_products(ev["id"])
    ]
    return EventOut(id=ev["id"], d_day=_d_day(ev["start_date"]), products=products,
                    **{k: ev[k] for k in db.EVENT_FIELDS})


def _get_or_404(store_id: str, event_id: str) -> dict:
    ev = db.get_event(store_id, event_id)
    if not ev:
        raise HTTPException(404, {"code": "event_not_found", "message": "행사를 찾을 수 없어요"})
    return ev


# ---------- 공고 가져오기 (Liner) ----------
# 경로가 /{event_id}보다 먼저 와야 함

IMPORT_LABELS = [
    ("name", "행사명", True),
    ("type", "행사 유형", True),
    ("start_date", "시작일", True),
    ("end_date", "종료일", True),
    ("location", "장소", True),
    ("hours", "운영 시간", False),
    ("apply_deadline", "참가 신청 마감", False),
    ("load_in_time", "반입 시간", False),
    ("fee", "참가비", False),
    ("booth_size", "부스 크기", False),
    ("expected_visitors", "예상 방문객", False),
]


@router.post("/import", response_model=EventImportOut,
             summary="공고 링크·행사명 → Liner 검색 → 행사 정보표 (저장 안 함, 검토용)")
def import_event(body: EventImportIn, store: dict = Depends(current_store)):
    url, query = body.url.strip(), body.query.strip()
    if not url and not query:
        raise HTTPException(422, {"code": "validation_error", "message": "url 또는 query 중 하나는 필요해요"})

    empty_fields = [ImportField(key=k, label=lb, value=None, required=req, status="missing")
                    for k, lb, req in IMPORT_LABELS]

    # 1) Liner 검색: 링크와 검색어 각각 검색해서 합치기
    results: list[dict] = []
    seen: set[str] = set()
    try:
        for q in [x for x in (url, f"{query} 참가 모집 공고" if query else "") if x]:
            for r in liner.web_search(q, max_results=8):
                if r["url"] and r["url"] not in seen:
                    seen.add(r["url"])
                    results.append(r)
    except liner.LinerError as e:
        log.warning("Liner 검색 실패: %s", e)
        return EventImportOut(status="failed", message="공고를 읽지 못했어요. 링크를 수정하거나 직접 입력해 주세요.",
                              fields=empty_fields)
    if not results:
        return EventImportOut(status="failed", message="검색 결과가 없어요. 행사명으로 검색하거나 직접 입력해 주세요.",
                              fields=empty_fields)

    # 2) LLM으로 행사 정보표 추출
    try:
        data = llm.generate_json(
            EVENT_IMPORT_SYSTEM,
            event_import_user_prompt(url, query, results[:12], datetime.now(KST).year),
        )
    except Exception as e:  # noqa: BLE001
        log.warning("행사 정보 추출 실패: %s", e)
        return EventImportOut(status="failed", message="공고 분석에 실패했어요. 다시 시도하거나 직접 입력해 주세요.",
                              fields=empty_fields,
                              sources=[ImportSource(title=r["title"], url=r["url"]) for r in results[:5]])

    def clean(k, v):
        if v in (None, "", "null"):
            return None
        if k == "expected_visitors":
            try:
                return int(str(v).replace(",", "").replace("명", "").strip())
            except ValueError:
                return None
        if k == "type" and v not in ("popup", "market", "booth"):
            return None
        return str(v).strip()

    values = {k: clean(k, data.get(k)) for k, _, _ in IMPORT_LABELS}
    fields = [ImportField(key=k, label=lb, value=values[k], required=req,
                          status="found" if values[k] is not None else "missing")
              for k, lb, req in IMPORT_LABELS]

    used = [u for u in data.get("used_urls", []) if isinstance(u, str)]
    src = [r for r in results if r["url"] in used] or results[:3]
    sources = [ImportSource(title=r["title"], url=r["url"]) for r in src[:5]]

    found_required = all(f.status == "found" for f in fields if f.required)
    if values["name"] is None:
        status, msg = "failed", "행사 정보를 찾지 못했어요. 직접 입력해 주세요."
        draft = None
    else:
        status = "ok" if found_required else "partial"
        missing = [f.label for f in fields if f.status == "missing"]
        msg = "행사 정보를 가져왔어요. 확인 후 다음 단계로 이동하세요." if not missing else \
            f"비어 있는 항목은 직접 입력해 주세요: {', '.join(missing)}"
        draft = EventIn(
            name=values["name"],
            type=values["type"] or "popup",
            start_date=values["start_date"],
            end_date=values["end_date"],
            location=values["location"] or "",
            hours=values["hours"] or "",
            apply_deadline=values["apply_deadline"] or "",
            load_in_time=values["load_in_time"] or "",
            fee=values["fee"] or "",
            booth_size=values["booth_size"] or "",
            expected_visitors=values["expected_visitors"] or 0,
            source_url=url,
        )
    return EventImportOut(status=status, message=msg, fields=fields, draft=draft, sources=sources)


# ---------- 행사 CRUD ----------

@router.get("", response_model=list[EventOut], summary="행사 목록 (시작일 순)")
def list_events(store: dict = Depends(current_store)):
    return [_out(e) for e in db.list_events(store["id"])]


@router.post("", response_model=EventOut, summary="행사 생성 (직접 입력 또는 import의 draft)")
def create_event(body: EventIn, store: dict = Depends(current_store)):
    eid = db.create_event(store["id"], body.model_dump())
    return _out(db.get_event(store["id"], eid))


@router.get("/{event_id}", response_model=EventOut, summary="행사 상세 (판매 상품·부족 수량 포함)")
def get_event(event_id: str, store: dict = Depends(current_store)):
    return _out(_get_or_404(store["id"], event_id))


@router.patch("/{event_id}", response_model=EventOut, summary="행사 수정 (보낸 필드만)")
def update_event(event_id: str, body: EventUpdate, store: dict = Depends(current_store)):
    _get_or_404(store["id"], event_id)
    db.update_event(store["id"], event_id, body.model_dump(exclude_none=True))
    return _out(db.get_event(store["id"], event_id))


@router.delete("/{event_id}", status_code=204, summary="행사 삭제")
def delete_event(event_id: str, store: dict = Depends(current_store)):
    _get_or_404(store["id"], event_id)
    db.delete_event(store["id"], event_id)
    return Response(status_code=204)


@router.put("/{event_id}/products", response_model=EventOut,
            summary="판매 상품·수량 설정 (보낸 목록으로 통째로 교체)")
def set_event_products(event_id: str, body: list[EventProductIn], store: dict = Depends(current_store)):
    _get_or_404(store["id"], event_id)
    for item in body:
        if not db.get_product(store["id"], item.product_id):
            raise HTTPException(404, {"code": "product_not_found", "message": f"상품을 찾을 수 없어요: {item.product_id}"})
    db.set_event_products(event_id, [(i.product_id, i.planned_qty) for i in body])
    return _out(db.get_event(store["id"], event_id))
