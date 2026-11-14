import logging
import urllib.parse
import math
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response

import db
import liner
import llm
from deps import current_store
from prompts import CHECKLIST_SYSTEM, EVENT_IMPORT_SYSTEM, checklist_user_prompt, event_import_user_prompt
from schemas import (
    ChecklistItemIn,
    ChecklistItemOut,
    ChecklistItemUpdate,
    ChecklistOut,
    ChecklistSuggestIn,
    EventCreateIn,
    EventImportIn,
    ImportCandidate,
    ImportSearchOut,
    EventImportOut,
    EventIn,
    EventOut,
    EventProductIn,
    EventProductOut,
    EventUpdate,
    ImportField,
    ImportSource,
    PlanConditions,
    PlanConditionsUpdate,
    PlanOut,
    PlanProduct,
    SupplyIn,
    SupplyOut,
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
            image_url=p.get("image_url") or "",
        )
        for p in db.get_event_products(ev["id"])
    ]
    done, total = db.checklist_progress(ev["id"])
    return EventOut(id=ev["id"], d_day=_d_day(ev["start_date"]), products=products,
                    checklist_done=done, checklist_total=total,
                    is_public=bool(ev.get("is_public")), subscribe_url=ev.get("subscribe_url") or "",
                    chat_plugin_key=ev.get("chat_plugin_key") or "", notice=ev.get("notice") or "",
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


def _check_url(url: str) -> str:
    """공고 링크 검사: http(s)이고 도메인이 있는 공개 주소만 (사설망·localhost 차단)."""
    import ipaddress
    u = urllib.parse.urlparse(url.strip())
    host = (u.hostname or "").lower()
    if u.scheme not in ("http", "https") or "." not in host:
        raise HTTPException(422, {"code": "invalid_url", "message": "올바른 링크인지 확인해 주세요. (https://로 시작하는 공고 주소)"})
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            raise HTTPException(422, {"code": "invalid_url", "message": "공개된 공고 주소만 가져올 수 있어요."})
    except ValueError:
        pass
    if host == "localhost" or host.endswith(".local"):
        raise HTTPException(422, {"code": "invalid_url", "message": "공개된 공고 주소만 가져올 수 있어요."})
    return url.strip()


def _search_candidates(url: str, query: str) -> list[dict]:
    """링크가 있으면 링크로만, 없으면 행사명(키워드)으로만 검색한다."""
    q = _check_url(url) if url else (f"{query} 참가 모집 공고" if query else "")
    results: list[dict] = []
    seen: set[str] = set()
    for r in liner.web_search(q, max_results=10 if not url else 8):
        if r["url"] and r["url"] not in seen:
            seen.add(r["url"])
            results.append(r)
    return results


@router.post("/import/search", response_model=ImportSearchOut,
             summary="공고 후보 찾기 (Liner 검색만, 빠름) → 사용자가 고른 뒤 /import에 candidates로 보냄")
def search_import(body: EventImportIn, store: dict = Depends(current_store)):
    url, query = body.url.strip(), body.query.strip()
    if not url and not query:
        raise HTTPException(422, {"code": "validation_error", "message": "url 또는 query 중 하나는 필요해요"})
    try:
        results = _search_candidates(url, query)
    except liner.LinerError as e:
        log.warning("Liner 검색 실패: %s", e)
        return ImportSearchOut(status="failed", message="공고를 찾지 못했어요. 행사명을 바꿔 보거나 직접 입력해 주세요.", candidates=[])
    cands = []
    for r in results[:10]:
        host = urllib.parse.urlparse(r["url"]).hostname or ""
        cands.append(ImportCandidate(title=r["title"] or r["url"], url=r["url"], hostname=host.removeprefix("www."),
                                     description=(r.get("description") or "")[:200], date=(r.get("date") or "")[:10]))
    if not cands:
        return ImportSearchOut(status="failed", message="검색 결과가 없어요. 행사명을 바꿔 보거나 직접 입력해 주세요.", candidates=[])
    return ImportSearchOut(status="ok", message=f"공고 {len(cands)}개를 찾았어요. 참가하려는 행사를 골라 주세요.", candidates=cands)


@router.post("/import", response_model=EventImportOut,
             summary="공고 링크·행사명 → Liner 검색 → 행사 정보표 (저장 안 함, 검토용)")
def import_event(body: EventImportIn, store: dict = Depends(current_store)):
    url, query = body.url.strip(), body.query.strip()
    if not url and not query:
        raise HTTPException(422, {"code": "validation_error", "message": "url 또는 query 중 하나는 필요해요"})

    empty_fields = [ImportField(key=k, label=lb, value=None, required=req, status="missing")
                    for k, lb, req in IMPORT_LABELS]

    # 1) 사용자가 고른 공고가 있으면 그것만, 없으면 Liner 검색
    if body.candidates:
        results = [c.model_dump() for c in body.candidates]
    else:
        try:
            results = _search_candidates(url, query)
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
            source_url=url or (body.candidates[0].url if body.candidates else ""),
        )
    return EventImportOut(status=status, message=msg, fields=fields, draft=draft, sources=sources)


# ---------- 예시 행사 (내 행사 화면 더미 데이터) ----------
# 날짜는 오늘 기준으로 계산해서 언제 눌러도 준비 중(D-15)·운영 중·종료가 하나씩 보인다.
# 실제 행사로 저장되므로 바로가기·체크리스트·예산 화면이 그대로 동작한다.

def _sample_events(today: date) -> list[tuple[dict, list[dict]]]:
    def d(n: int) -> str:
        return (today + timedelta(days=n)).isoformat()

    base = EventIn(name="-").model_dump()
    return [
        ({**base, "name": "서울 일러스트 페어", "type": "booth", "start_date": d(15), "end_date": d(16),
          "location": "서울 코엑스 홀 C", "hours": "10:00–18:00", "load_in_time": "08:00–09:30",
          "booth_size": "2m × 2m", "expected_visitors": 300, "status": "preparing"},
         [{"title": "굿즈 최종 수량 확정", "d_minus": 14, "category": "상품", "status": "done"},
          {"title": "키링·스티커 발주", "d_minus": 12, "category": "제작", "status": "done"},
          {"title": "부스 가격표 제작", "d_minus": 7, "category": "운영", "status": "doing"},
          {"title": "참가 소식 인스타 게시", "d_minus": 5, "category": "홍보"},
          {"title": "현장 결제수단 준비", "d_minus": 1, "category": "운영"}]),
        ({**base, "name": "연남 겨울 팝업", "type": "popup", "start_date": d(-1), "end_date": d(1),
          "location": "서울 마포구 연남동", "hours": "11:00–19:00", "expected_visitors": 200, "status": "preparing"},
         [{"title": "포장재 준비", "d_minus": 3, "category": "운영", "status": "done"},
          {"title": "팝업 오픈 안내 게시", "d_minus": 1, "category": "홍보", "status": "done"},
          {"title": "마감 후 재고 확인", "d_minus": 0, "category": "운영"}]),
        ({**base, "name": "성수 핸드메이드 마켓", "type": "market", "start_date": d(-21), "end_date": d(-20),
          "location": "서울 성동구 성수동", "hours": "12:00–18:00", "expected_visitors": 150, "status": "done"},
         [{"title": "부스 설치", "d_minus": 0, "category": "운영", "status": "done"},
          {"title": "방문 감사 글 게시", "d_minus": 0, "category": "홍보", "status": "done"}]),
    ]


@router.post("/sample", response_model=list[EventOut],
             summary="예시 행사 3개 넣기 (준비 중·운영 중·종료). 같은 이름이 있으면 건너뜀 → 전체 목록 반환")
def add_sample_events(store: dict = Depends(current_store)):
    existing = {e["name"] for e in db.list_events(store["id"])}
    for data, checklist in _sample_events(datetime.now(KST).date()):
        if data["name"] in existing:
            continue
        eid = db.create_event(store["id"], data)
        db.add_checklist_items(eid, checklist)
    return [_out(e) for e in db.list_events(store["id"])]


# ---------- 행사 CRUD ----------

@router.get("", response_model=list[EventOut], summary="행사 목록 (시작일 순)")
def list_events(store: dict = Depends(current_store)):
    return [_out(e) for e in db.list_events(store["id"])]


@router.post("", response_model=EventOut, summary="행사 생성 (직접 입력 또는 import의 draft)")
def create_event(body: EventCreateIn, store: dict = Depends(current_store)):
    # 1) 같은 저장 재요청(더블클릭·재시도)이면 이미 만든 행사를 그대로 돌려준다
    if body.request_id:
        prev = db.find_event_by_request(store["id"], body.request_id)
        if prev:
            return _out(prev)
    # 2) 같은 이름·같은 시작일 행사가 이미 있으면 물어본다
    if not body.allow_duplicate:
        same = db.find_same_event(store["id"], body.name, body.start_date)
        if same:
            raise HTTPException(409, {"code": "duplicate_event",
                                      "message": f"같은 이름·날짜의 행사가 이미 있어요: {same['name']} ({same['id']})"})
    eid = db.create_event(store["id"], body.model_dump(exclude={"request_id", "allow_duplicate"}))
    if body.request_id:
        db.set_event_request(store["id"], eid, body.request_id)
    return _out(db.get_event(store["id"], eid))


@router.get("/{event_id}", response_model=EventOut, summary="행사 상세 (판매 상품·부족 수량 포함)")
def get_event(event_id: str, store: dict = Depends(current_store)):
    return _out(_get_or_404(store["id"], event_id))


@router.patch("/{event_id}", response_model=EventOut, summary="행사 수정 (보낸 필드만)")
def update_event(event_id: str, body: EventUpdate, store: dict = Depends(current_store)):
    _get_or_404(store["id"], event_id)
    changes = body.model_dump(exclude_none=True)
    if "is_public" in changes:
        changes["is_public"] = int(changes["is_public"])
    db.update_event(store["id"], event_id, changes)
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



# ---------- 준비물·재고 계획 ----------

def _plan_out(ev: dict) -> PlanOut:
    plan = db.get_plan(ev["id"])
    cond = PlanConditions(purchase_rate=plan["purchase_rate"], qty_per_purchase=plan["qty_per_purchase"],
                          buffer_qty=plan["buffer_qty"])
    visitors = ev["expected_visitors"] or 0
    raw_total = visitors * cond.purchase_rate * cond.qty_per_purchase
    total = math.ceil(round(raw_total, 6))
    rate_pct = f"{cond.purchase_rate * 100:g}%"
    basis = f"{visitors}명 × 구매율 {rate_pct} × {cond.qty_per_purchase}개 = {total}개"

    items = db.get_event_products(ev["id"])
    planned_sum = sum(p["planned_qty"] for p in items)
    products = []
    for p in items:
        share = (p["planned_qty"] / planned_sum) if planned_sum else (1 / len(items))
        rec = math.ceil(round(raw_total * share, 6)) + cond.buffer_qty
        need = max(p["planned_qty"], rec)
        share_txt = "" if len(items) == 1 else f" × 비중 {share * 100:.0f}%"
        buf_txt = f" + 여유분 {cond.buffer_qty}개" if cond.buffer_qty else ""
        products.append(PlanProduct(
            product_id=p["id"], sku=p["sku"], name=p["name"], stock=p["stock"], planned_qty=p["planned_qty"],
            recommended_qty=rec, shortage=max(0, need - p["stock"]),
            basis=f"{basis}{share_txt}{buf_txt} → {rec}개",
        ))

    supplies = [SupplyOut(id=x["id"], name=x["name"], needed=x["needed"], owned=x["owned"],
                          shortage=max(0, x["needed"] - x["owned"])) for x in db.list_supplies(ev["id"])]
    warnings = []
    if not visitors:
        warnings.append("예상 방문객이 없어서 권장 수량을 계산할 수 없어요. 행사 정보에서 예상 방문객을 입력해 주세요.")
    if not items:
        warnings.append("판매 상품이 아직 없어요. 판매 상품·수량을 먼저 설정해 주세요.")
    for p in products:
        if p.shortage:
            warnings.append(f"{p.name}: 가용 {p.stock}개로 {p.shortage}개 부족해요. 추가 입고를 확인하세요.")
    for x in supplies:
        if x.shortage:
            warnings.append(f"{x.name}: 보유 {x.owned}개로 {x.shortage}개 부족해요.")
    return PlanOut(expected_visitors=visitors, conditions=cond, recommended_total=total, basis=basis,
                   products=products, supplies=supplies, warnings=warnings)


@router.get("/{event_id}/plan", response_model=PlanOut, summary="준비물·재고 계획 (권장 수량, 부족분, 산출 근거)")
def get_plan(event_id: str, store: dict = Depends(current_store)):
    return _plan_out(_get_or_404(store["id"], event_id))


@router.patch("/{event_id}/plan", response_model=PlanOut, summary="수량 산정 조건 수정 (구매율·구매당 수량·여유분)")
def update_plan(event_id: str, body: PlanConditionsUpdate, store: dict = Depends(current_store)):
    ev = _get_or_404(store["id"], event_id)
    db.save_plan(event_id, body.model_dump(exclude_none=True))
    return _plan_out(ev)


@router.put("/{event_id}/supplies", response_model=PlanOut, summary="준비물 목록 설정 (통째로 교체)")
def set_supplies(event_id: str, body: list[SupplyIn], store: dict = Depends(current_store)):
    ev = _get_or_404(store["id"], event_id)
    db.set_supplies(event_id, [x.model_dump() for x in body])
    return _plan_out(ev)


# ---------- 준비 체크리스트 ----------

FALLBACK_CHECKLIST = [
    {"title": "판매 상품 입고 수량 확인", "d_minus": 7, "category": "상품"},
    {"title": "포장재(종이백·OPP) 발주", "d_minus": 10, "category": "배송"},
    {"title": "가격표·상품 안내 POP 제작", "d_minus": 5, "category": "현장 운영"},
    {"title": "카드 결제 단말기 충전·테스트", "d_minus": 2, "category": "결제"},
    {"title": "거스름돈·계좌이체 QR 준비", "d_minus": 1, "category": "결제"},
    {"title": "부스 집기(테이블보·진열대) 챙기기", "d_minus": 1, "category": "현장 운영"},
    {"title": "인스타그램 행사 예고 게시", "d_minus": 7, "category": "홍보"},
]


def _d_label(d: int | None) -> str:
    if d is None:
        return "날짜 미정"
    return "D-DAY" if d == 0 else (f"D-{d}" if d > 0 else f"D+{-d}")


def _checklist_out(ev: dict, is_fallback: bool = False, sources: list[ImportSource] | None = None) -> ChecklistOut:
    start = None
    try:
        start = date.fromisoformat((ev.get("start_date") or "")[:10])
    except ValueError:
        pass
    items = []
    for it in db.list_checklist(ev["id"]):
        due = (start - timedelta(days=it["d_minus"])).isoformat() if (start and it["d_minus"] is not None) else None
        items.append(ChecklistItemOut(id=it["id"], title=it["title"], d_minus=it["d_minus"], d_label=_d_label(it["d_minus"]),
                                      due_date=due, category=it["category"], status=it["status"], source_url=it["source_url"]))
    done, total = db.checklist_progress(ev["id"])
    return ChecklistOut(done=done, total=total, items=items, is_fallback=is_fallback, sources=sources or [])


@router.get("/{event_id}/checklist", response_model=ChecklistOut, summary="준비 체크리스트 (D-day 순)")
def get_checklist(event_id: str, store: dict = Depends(current_store)):
    return _checklist_out(_get_or_404(store["id"], event_id))


@router.post("/{event_id}/checklist/suggest", response_model=ChecklistOut,
             summary="AI 체크리스트 제안·다시 제안 (미완료 항목만 교체, 진행 중·완료는 유지)")
def suggest_checklist(event_id: str, body: ChecklistSuggestIn | None = None, store: dict = Depends(current_store)):
    ev = _get_or_404(store["id"], event_id)
    use_liner = bool(body and body.use_liner)
    db.delete_todo_checklist(event_id)
    keep = [i["title"] for i in db.list_checklist(event_id)]
    products = db.get_event_products(event_id)

    tips, sources = [], []
    if use_liner:
        type_label = {"popup": "팝업스토어", "market": "플리마켓", "booth": "부스"}.get(ev["type"], "팝업")
        try:
            tips = liner.web_search(f"{type_label} 셀러 참가 준비물 체크리스트", max_results=5)
            sources = [ImportSource(title=t["title"], url=t["url"]) for t in tips if t["url"]][:3]
        except liner.LinerError as e:
            log.warning("Liner 체크리스트 검색 실패: %s", e)

    is_fallback = False
    try:
        data = llm.generate_json(CHECKLIST_SYSTEM, checklist_user_prompt(ev, products, keep, tips))
        new_items = []
        for it in data.get("items", []):
            title = str(it.get("title", "")).strip()
            if not title or title in keep:
                continue
            try:
                d = int(it.get("d_minus")) if it.get("d_minus") is not None else None
            except (TypeError, ValueError):
                d = None
            new_items.append({"title": title, "d_minus": d, "category": str(it.get("category", "")).strip(),
                              "source_url": sources[0].url if (use_liner and sources) else ""})
        if not new_items:
            raise ValueError("빈 체크리스트")
    except Exception as e:  # noqa: BLE001
        log.warning("체크리스트 생성 실패, fallback 사용: %s", e)
        is_fallback = True
        new_items = [i for i in FALLBACK_CHECKLIST if i["title"] not in keep]
    db.add_checklist_items(event_id, new_items[:10])
    return _checklist_out(ev, is_fallback=is_fallback, sources=sources)


@router.post("/{event_id}/checklist", response_model=ChecklistOut, summary="체크리스트 항목 직접 추가")
def add_checklist_item(event_id: str, body: ChecklistItemIn, store: dict = Depends(current_store)):
    ev = _get_or_404(store["id"], event_id)
    db.add_checklist_items(event_id, [body.model_dump()])
    return _checklist_out(ev)


@router.patch("/{event_id}/checklist/{item_id}", response_model=ChecklistOut,
              summary="체크리스트 항목 수정 (상태 todo → doing → done 등)")
def update_checklist_item(event_id: str, item_id: str, body: ChecklistItemUpdate, store: dict = Depends(current_store)):
    ev = _get_or_404(store["id"], event_id)
    if not db.get_checklist_item(event_id, item_id):
        raise HTTPException(404, {"code": "checklist_item_not_found", "message": "체크리스트 항목을 찾을 수 없어요"})
    db.update_checklist_item(event_id, item_id, body.model_dump(exclude_none=True))
    return _checklist_out(ev)


@router.delete("/{event_id}/checklist/{item_id}", response_model=ChecklistOut, summary="체크리스트 항목 삭제")
def delete_checklist_item(event_id: str, item_id: str, store: dict = Depends(current_store)):
    ev = _get_or_404(store["id"], event_id)
    if not db.get_checklist_item(event_id, item_id):
        raise HTTPException(404, {"code": "checklist_item_not_found", "message": "체크리스트 항목을 찾을 수 없어요"})
    db.delete_checklist_item(event_id, item_id)
    return _checklist_out(ev)
