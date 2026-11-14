"""행사 예산·손익, 현장 판매, 마감 리포트 (Figma: 39~45)."""
import json
import logging
import math

from fastapi import APIRouter, Depends, HTTPException, Response

import db
import llm
from deps import current_store
from datetime import date

from schemas import (
    AiReportOut, AiSuggestion, ReportOrder,
    OrderIn, OrderOut, OrdersOut, OrderStatusIn, ReceiveIn,
    BudgetOut, BudgetProduct, BudgetProductIn, BudgetUpdate, ExpenseIn, ExpenseOut,
    ReportOut, SaleIn, SaleItemOut, SaleOut, SalesOut, StockRow,
)

router = APIRouter(prefix="/api/events", tags=["행사 · 예산·판매·리포트"])

PAY_LABEL = {"card": "카드", "cash": "현금", "transfer": "계좌이체"}


def _event_or_404(store_id: str, event_id: str) -> dict:
    ev = db.get_event(store_id, event_id)
    if not ev:
        raise HTTPException(404, {"code": "event_not_found", "message": "행사를 찾을 수 없어요"})
    return ev


def _won(n: int) -> str:
    return f"{n:,}원"


def _ceil_div(a: int, b: int) -> int | None:
    if b <= 0:
        return None
    return max(0, math.ceil(a / b))


def _budget_out(ev: dict) -> BudgetOut:
    expenses = db.list_expenses(ev["id"])
    planned_total = sum(e["planned"] for e in expenses)
    actual_total = sum(e["actual"] for e in expenses)
    budget = ev.get("budget") or planned_total

    products: list[BudgetProduct] = []
    for p in db.get_event_products(ev["id"]):
        margin = p["price"] - (p.get("cost") or 0)
        products.append(BudgetProduct(
            product_id=p["id"], name=p["name"], price=p["price"], cost=p.get("cost") or 0,
            prepared_qty=p["planned_qty"], unit_margin=margin,
            basis=f"{p['name']} {p['planned_qty']}개 · 판매가 {_won(p['price'])} − 원가 {_won(p.get('cost') or 0)} = 개당 {_won(margin)}",
        ))
    prepared_total = sum(p.prepared_qty for p in products)
    revenue = sum(p.price * p.prepared_qty for p in products)
    goods_cost = sum(p.cost * p.prepared_qty for p in products)
    # 준비 수량 비중으로 가중 평균 → 손익분기점은 '판매 개수' 기준 (Figma: 예상 판매 비중 60:40)
    avg_margin = round((revenue - goods_cost) / prepared_total) if prepared_total else 0
    target = ev.get("target_profit") or 0

    warnings = []
    if not products:
        warnings.append("판매 상품이 없어요. 상품 관리에서 판매 상품과 준비 수량을 정하세요.")
    elif avg_margin <= 0:
        warnings.append("개당 이익이 0원 이하예요. 판매가와 원가를 확인하세요.")
    if products and any(p.cost == 0 for p in products):
        warnings.append("원가가 0원인 상품이 있어요. 원가를 넣어야 손익이 정확해요.")
    bep_budget = _ceil_div(budget, avg_margin)
    if bep_budget is not None and prepared_total and bep_budget > prepared_total:
        warnings.append(f"예산 기준 손익분기({bep_budget}개)가 준비 수량({prepared_total}개)보다 많아요.")

    sold_qty, sold_rev, sold_cost = db.sold_contribution(ev["id"])
    contribution = sold_rev - sold_cost
    if sold_qty and avg_margin > 0:
        remaining = max(0, math.ceil((budget - contribution) / avg_margin))
    else:
        remaining = bep_budget
    has_budget = bool(ev.get("budget")) or bool(expenses)

    ratio = " : ".join(str(round(p.prepared_qty * 100 / prepared_total)) for p in products) if prepared_total else "-"
    return BudgetOut(
        budget=budget, target_profit=target,
        expenses=[ExpenseOut(**{k: e[k] for k in ("id", "category", "name", "planned", "actual")}) for e in expenses],
        planned_total=planned_total, actual_total=actual_total,
        products=products, prepared_total=prepared_total,
        expected_revenue=revenue, expected_cost=goods_cost, avg_unit_margin=avg_margin,
        bep_budget=bep_budget,
        bep_actual=_ceil_div(actual_total, avg_margin) if actual_total else None,
        target_qty=_ceil_div(budget + target, avg_margin) if target else None,
        full_sale_profit=revenue - goods_cost - budget,
        basis=f"준비한 {prepared_total}개 기준 예상 매출 {_won(revenue)} · 상품 원가 {_won(goods_cost)} · 판매 비중 {ratio} → 평균 개당 이익 {_won(avg_margin)}",
        warnings=warnings,
        has_budget=has_budget, sold_qty=sold_qty, contribution_so_far=contribution, remaining_to_bep=remaining,
    )


@router.get("/{event_id}/budget", response_model=BudgetOut, summary="예산·손익 (손익분기점, 목표 판매량, 계산 근거)")
def get_budget(event_id: str, store: dict = Depends(current_store)):
    return _budget_out(_event_or_404(store["id"], event_id))


@router.patch("/{event_id}/budget", response_model=BudgetOut, summary="예산 총액·목표 이익 수정")
def update_budget(event_id: str, body: BudgetUpdate, store: dict = Depends(current_store)):
    _event_or_404(store["id"], event_id)
    db.update_event(store["id"], event_id, body.model_dump(exclude_none=True))
    return _budget_out(_event_or_404(store["id"], event_id))


@router.put("/{event_id}/expenses", response_model=BudgetOut, summary="지출 항목 설정 (통째로 교체)")
def set_expenses(event_id: str, body: list[ExpenseIn], store: dict = Depends(current_store)):
    ev = _event_or_404(store["id"], event_id)
    db.set_expenses(event_id, [e.model_dump() for e in body])
    return _budget_out(ev)


@router.patch("/{event_id}/budget/products", response_model=BudgetOut, summary="준비 수량·판매가·원가 편집")
def update_budget_products(event_id: str, body: list[BudgetProductIn], store: dict = Depends(current_store)):
    ev = _event_or_404(store["id"], event_id)
    linked = {p["id"] for p in db.get_event_products(event_id)}
    for item in body:
        if item.product_id not in linked:
            raise HTTPException(400, {"code": "product_not_in_event", "message": "이 행사에 연결된 상품이 아니에요"})
        if item.prepared_qty is not None:
            db.set_event_product_qty(event_id, item.product_id, item.prepared_qty)
        changes = {k: v for k, v in (("price", item.price), ("cost", item.cost)) if v is not None}
        if changes:
            db.update_product(store["id"], item.product_id, changes)
    return _budget_out(ev)


# ---------- 현장 판매 ----------

def _stock(event_id: str) -> list[StockRow]:
    sold = db.sold_qty_by_product(event_id)
    recv = db.received_qty_by_product(event_id)
    return [
        StockRow(product_id=p["id"], name=p["name"], price=p["price"], prepared_qty=p["planned_qty"],
                 received_qty=recv.get(p["id"], 0), sold_qty=sold.get(p["id"], 0),
                 remaining=p["planned_qty"] + recv.get(p["id"], 0) - sold.get(p["id"], 0))
        for p in db.get_event_products(event_id)
    ]


def _sales_out(event_id: str) -> SalesOut:
    sales = db.list_sales(event_id)
    return SalesOut(
        sales=[SaleOut(id=s["id"], payment_method=s["payment_method"], total=s["total"], created_at=s["created_at"],
                       items=[SaleItemOut(product_id=i["product_id"], name=i["name"] or "삭제된 상품", qty=i["qty"], price=i["price"]) for i in s["items"]])
               for s in sales],
        stock=_stock(event_id),
        total_revenue=sum(s["total"] for s in sales),
        total_qty=sum(i["qty"] for s in sales for i in s["items"]),
    )


@router.get("/{event_id}/sales", response_model=SalesOut, summary="현장 판매 기록과 남은 재고")
def list_sales(event_id: str, store: dict = Depends(current_store)):
    _event_or_404(store["id"], event_id)
    return _sales_out(event_id)


@router.post("/{event_id}/sales", response_model=SalesOut, summary="현장 판매 저장 → 남은 재고 반영 (재고 초과 시 400)")
def add_sale(event_id: str, body: SaleIn, store: dict = Depends(current_store)):
    _event_or_404(store["id"], event_id)
    stock = {s.product_id: s for s in _stock(event_id)}
    items = []
    for it in body.items:
        row = stock.get(it.product_id)
        if not row:
            raise HTTPException(400, {"code": "product_not_in_event", "message": "이 행사에 연결된 상품이 아니에요"})
        if it.qty > row.remaining:
            raise HTTPException(400, {"code": "over_stock", "message": f"{row.name}의 남은 재고({row.remaining}개)보다 많아요. 수량을 수정하세요."})
        cost = next((p.get("cost") or 0 for p in db.get_event_products(event_id) if p["id"] == it.product_id), 0)
        items.append({"product_id": it.product_id, "qty": it.qty, "price": row.price, "cost": cost})
    db.add_sale(event_id, body.payment_method, items)
    return _sales_out(event_id)


@router.delete("/{event_id}/sales/{sale_id}", response_model=SalesOut, summary="판매 기록 취소 (재고 되돌림)")
def delete_sale(event_id: str, sale_id: str, store: dict = Depends(current_store)):
    _event_or_404(store["id"], event_id)
    if not db.delete_sale(event_id, sale_id):
        raise HTTPException(404, {"code": "sale_not_found", "message": "판매 기록을 찾을 수 없어요"})
    return _sales_out(event_id)


# ---------- 마감 리포트 ----------

@router.get("/{event_id}/report", response_model=ReportOut, summary="행사 마감 리포트 (현장 매출·실제 손익·재고 잔량)")
def get_report(event_id: str, store: dict = Depends(current_store)):
    ev = _event_or_404(store["id"], event_id)
    sales = _sales_out(event_id)
    budget = _budget_out(ev)
    _, _, goods_cost = db.sold_contribution(event_id)  # 판매 당시 원가로 집계
    spend = budget.actual_total or budget.budget
    profit = sales.total_revenue - goods_cost - spend
    by_pay: dict[str, int] = {}
    for s in sales.sales:
        label = PAY_LABEL.get(s.payment_method, s.payment_method)
        by_pay[label] = by_pay.get(label, 0) + s.total
    target = budget.target_qty  # 목표 이익으로 정한 목표 판매량 (없으면 미설정)
    return ReportOut(
        revenue=sales.total_revenue, sold_qty=sales.total_qty, goods_cost=goods_cost, expenses=spend,
        profit=profit, remaining_qty=sum(r.remaining for r in sales.stock), stock=sales.stock,
        target_qty=target, gap_qty=(target - sales.total_qty) if target else None, by_payment=by_pay,
        achievement_rate=round(sales.total_qty / target, 4) if target else None, target_is_set=bool(target),
        basis=f"{_won(sales.total_revenue)} − 원가 {_won(goods_cost)} − 행사비 {_won(spend)}",
        orders=[ReportOrder(product_id=o["product_id"], name=o["name"] or "삭제된 상품", qty=o["qty"], status=o["status"],
                            order_date=o["order_date"], expected_date=o["expected_date"],
                            received_qty=o["received_qty"] or 0, received_date=o["received_date"] or "")
                for o in db.list_orders(event_id)],
    )


# ---------- 다음 행사 AI 리포트 (RPT-02) ----------

log = logging.getLogger("mawd")

AI_REPORT_SYSTEM = """당신은 1인 브랜드의 팝업·마켓 판매 결과를 분석해 다음 행사를 제안하는 도우미입니다.
주어진 집계 숫자만 근거로 씁니다. 없는 숫자를 만들지 않습니다.
JSON으로만 답합니다: {"suggestions":[{"title":"한 줄 제목","evidence":"근거 숫자 (예: 포켓 노트 36/36개 판매, 매출 비중 83%)","action":"다음 행동 (구체 수량·날짜)","assumption":"적용 가정"}]}
제안은 2~4개. 판매율이 높거나 낮은 상품의 다음 준비 수량, 입고가 늦었던 발주의 발주 시점, 손익과 비용 순서로 다룹니다. 말투는 존댓말, 짧게."""


def _report_facts(ev: dict, r: ReportOut) -> dict:
    total_rev = r.revenue or 0
    products = []
    for s in r.stock:
        ready = s.prepared_qty + s.received_qty
        rev = s.sold_qty * s.price
        products.append({"상품": s.name, "판매": s.sold_qty, "확보": ready, "판매율": f"{round(s.sold_qty / ready * 100) if ready else 0}%",
                         "매출": rev, "매출비중": f"{round(rev / total_rev * 100) if total_rev else 0}%", "잔량": s.remaining})
    products.sort(key=lambda p: -p["판매"])
    orders = [{"상품": o.name, "수량": o.qty, "발주일": o.order_date, "입고예정": o.expected_date,
               "입고일": o.received_date or "미입고", "상태": o.status} for o in r.orders]
    return {"행사": ev["name"], "기간": f"{ev.get('start_date') or '?'} ~ {ev.get('end_date') or '?'}", "매출": total_rev,
            "판매수량": r.sold_qty, "실제손익": r.profit, "행사비": r.expenses, "상품": products, "발주입고": orders}


def _fallback_suggestions(ev: dict, facts: dict) -> list[AiSuggestion]:
    out: list[AiSuggestion] = []
    ps = facts["상품"]
    if ps:
        top = ps[0]
        out.append(AiSuggestion(
            title=f"{top['상품']} 준비 수량 늘리기" if top["잔량"] == 0 else f"{top['상품']} 중심으로 진열·홍보",
            evidence=f"{top['상품']} {top['판매']}/{top['확보']}개 판매 (판매율 {top['판매율']}), 매출 비중 {top['매출비중']}",
            action=(f"비슷한 행사에서 {top['확보']}개보다 5~10% 많이 준비해 시험해 보세요." if top["잔량"] == 0
                    else "부스 앞쪽 진열과 홍보 이미지의 대표 상품으로 쓰세요."),
            assumption="비슷한 규모·방문객의 행사라고 가정"))
        low = ps[-1]
        if len(ps) > 1 and low["확보"] and low["판매"] / low["확보"] < 0.5:
            out.append(AiSuggestion(
                title=f"{low['상품']} 수량 줄이기", evidence=f"{low['상품']} {low['판매']}/{low['확보']}개 판매 (판매율 {low['판매율']}), 잔량 {low['잔량']}개",
                action=f"다음 행사는 이번 판매량({low['판매']}개) 근처로 준비하고 남은 재고를 먼저 쓰세요.",
                assumption="남은 재고를 다음 행사에 가져갈 수 있다고 가정"))
    start = ev.get("start_date") or ""
    for o in facts["발주입고"]:
        got = o["입고일"] if o["입고일"] != "미입고" else ""
        if start and got and got[:10] >= start[:10]:
            out.append(AiSuggestion(
                title=f"{o['상품']} 발주 앞당기기", evidence=f"{o['상품']} {o['수량']}개가 행사 기간 중 {got[5:10].replace('-', '/')}에 입고됨 (행사 시작 {start[5:10].replace('-', '/')})",
                action="다음엔 행사 전날까지 받도록 발주일을 앞당기세요.", assumption="공급처 제작 기간이 이번과 같다고 가정"))
            break
    if facts["실제손익"] < 0:
        out.append(AiSuggestion(
            title="손익분기 먼저 확인", evidence=f"실제 손익 {facts['실제손익']:,}원 · 행사비 {facts['행사비']:,}원",
            action="다음 행사는 참가비·운송비를 먼저 넣고 손익분기 판매량이 현실적인지 확인한 뒤 신청하세요.", assumption="판매 단가가 같다고 가정"))
    return out


@router.post("/{event_id}/report/ai", response_model=AiReportOut, summary="다음 행사를 위한 AI 리포트 (LINER)")
def ai_report(event_id: str, store: dict = Depends(current_store)):
    ev = _event_or_404(store["id"], event_id)
    r = get_report(event_id, store)
    missing = []
    if r.sold_qty == 0:
        missing.append("현장 판매 기록 (상품 관리 → 현장 판매 기록)")
    if not r.stock:
        missing.append("판매 상품과 준비 수량")
    if missing:
        return AiReportOut(status="insufficient", missing=missing)
    if not r.orders:
        missing.append("발주·입고 기록이 없어 발주 시점 제안은 빠져요")
    facts = _report_facts(ev, r)
    try:
        data = llm.generate_json(AI_REPORT_SYSTEM, "행사 집계 (비식별)\n" + json.dumps(facts, ensure_ascii=False))
        sugg = [AiSuggestion(**{k: str(x.get(k, "")) for k in ("title", "evidence", "action", "assumption")})
                for x in (data.get("suggestions") or []) if x.get("title")][:4]
        if not sugg:
            raise ValueError("빈 제안")
        return AiReportOut(status="ok", suggestions=sugg, missing=missing)
    except Exception as e:  # noqa: BLE001 - LLM 실패 시 숫자 규칙 기반 제안
        log.warning("AI 리포트 LLM 실패, 규칙 기반 사용: %s", e)
        return AiReportOut(status="ok", suggestions=_fallback_suggestions(ev, facts), missing=missing, is_fallback=True)



# ---------- 발주·입고 (ORD-01) ----------

def _orders_out(event_id: str) -> OrdersOut:
    return OrdersOut(
        orders=[OrderOut(id=o["id"], product_id=o["product_id"], name=o["name"] or "삭제된 상품", qty=o["qty"],
                         supplier=o["supplier"], order_date=o["order_date"], expected_date=o["expected_date"],
                         status=o["status"], received_qty=o["received_qty"], received_date=o["received_date"])
                for o in db.list_orders(event_id)],
        stock=_stock(event_id),
    )


def _valid_date(v: str, label: str) -> str:
    try:
        return date.fromisoformat(v[:10]).isoformat()
    except ValueError:
        raise HTTPException(422, {"code": "invalid_date", "message": f"{label}을 YYYY-MM-DD로 입력해 주세요."}) from None


@router.get("/{event_id}/orders", response_model=OrdersOut, summary="발주·입고 목록과 재고 (배정 + 입고 − 판매)")
def list_orders(event_id: str, store: dict = Depends(current_store)):
    _event_or_404(store["id"], event_id)
    return _orders_out(event_id)


@router.post("/{event_id}/orders", response_model=OrdersOut, summary="발주 일정 등록 (상태: 발주 예정)")
def add_order(event_id: str, body: OrderIn, store: dict = Depends(current_store)):
    _event_or_404(store["id"], event_id)
    if body.product_id not in {p["id"] for p in db.get_event_products(event_id)}:
        raise HTTPException(400, {"code": "product_not_in_event", "message": "이 행사에 연결된 상품이 아니에요"})
    od, ed = _valid_date(body.order_date, "발주일"), _valid_date(body.expected_date, "입고 예정일")
    if ed < od:
        raise HTTPException(422, {"code": "invalid_period", "message": "입고 예정일은 발주일과 같거나 이후여야 해요."})
    db.add_order(event_id, {**body.model_dump(), "order_date": od, "expected_date": ed})
    return _orders_out(event_id)


@router.patch("/{event_id}/orders/{order_id}", response_model=OrdersOut, summary="발주 완료로 변경 (발주 예정 → 발주 완료)")
def mark_ordered(event_id: str, order_id: str, body: OrderStatusIn, store: dict = Depends(current_store)):
    _event_or_404(store["id"], event_id)
    if not db.get_order(event_id, order_id):
        raise HTTPException(404, {"code": "order_not_found", "message": "발주를 찾을 수 없어요"})
    db.mark_ordered(event_id, order_id)
    return _orders_out(event_id)


@router.post("/{event_id}/orders/{order_id}/receive", response_model=OrdersOut,
             summary="입고 확정 → 재고에 한 번만 반영 (같은 요청을 다시 보내도 재고가 또 늘지 않음)")
def receive_order(event_id: str, order_id: str, body: ReceiveIn, store: dict = Depends(current_store)):
    _event_or_404(store["id"], event_id)
    o = db.get_order(event_id, order_id)
    if not o:
        raise HTTPException(404, {"code": "order_not_found", "message": "발주를 찾을 수 없어요"})
    db.receive_order(event_id, order_id, body.received_qty, _valid_date(body.received_date, "입고일"))
    return _orders_out(event_id)


@router.delete("/{event_id}/orders/{order_id}", response_model=OrdersOut, summary="발주 삭제 (입고 완료된 발주는 삭제 불가)")
def delete_order(event_id: str, order_id: str, store: dict = Depends(current_store)):
    _event_or_404(store["id"], event_id)
    if not db.delete_order(event_id, order_id):
        raise HTTPException(400, {"code": "order_locked", "message": "입고 완료된 발주는 삭제할 수 없어요"})
    return _orders_out(event_id)
