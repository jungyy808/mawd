"""행사 예산·손익, 현장 판매, 마감 리포트 (Figma: 39~45)."""
import math

from fastapi import APIRouter, Depends, HTTPException, Response

import db
from deps import current_store
from schemas import (
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
    return [
        StockRow(product_id=p["id"], name=p["name"], price=p["price"], prepared_qty=p["planned_qty"],
                 sold_qty=sold.get(p["id"], 0), remaining=p["planned_qty"] - sold.get(p["id"], 0))
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
        items.append({"product_id": it.product_id, "qty": it.qty, "price": row.price})
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
    cost_by = {p.product_id: p.cost for p in budget.products}
    goods_cost = sum(r.sold_qty * cost_by.get(r.product_id, 0) for r in sales.stock)
    spend = budget.actual_total or budget.budget
    profit = sales.total_revenue - goods_cost - spend
    by_pay: dict[str, int] = {}
    for s in sales.sales:
        label = PAY_LABEL.get(s.payment_method, s.payment_method)
        by_pay[label] = by_pay.get(label, 0) + s.total
    target = budget.target_qty or budget.bep_budget
    return ReportOut(
        revenue=sales.total_revenue, sold_qty=sales.total_qty, goods_cost=goods_cost, expenses=spend,
        profit=profit, remaining_qty=sum(r.remaining for r in sales.stock), stock=sales.stock,
        target_qty=target, gap_qty=(target - sales.total_qty) if target else None, by_payment=by_pay,
        basis=f"{_won(sales.total_revenue)} − 원가 {_won(goods_cost)} − 행사비 {_won(spend)}",
    )
