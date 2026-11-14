"use client";
// Figma 39 예산·손익 / 40 예산·비용 입력 / 40.5 준비 수량과 원가 편집
import { useCallback, useEffect, useState } from "react";
import { type BudgetOut, type Expense, api, signedWon, won } from "@/components/events/api";
import { useEvent } from "@/components/events/EventShell";
import { Button, Card, ErrorBox, Spinner, inputCls } from "@/components/events/ui";

const CATEGORIES = ["참가비", "운송비", "인쇄·디스플레이", "인건비", "포장재", "기타"];

export default function BudgetPage() {
  const { ev } = useEvent();
  const url = `/api/events/${ev.id}`;
  const [b, setB] = useState<BudgetOut | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    api<BudgetOut>(`${url}/budget`).then(setB).catch((e) => setError(e.message));
  }, [url]);
  useEffect(load, [load]);

  const run = async (p: Promise<BudgetOut>) => {
    setError("");
    try { setB(await p); } catch (e) { setError((e as Error).message); }
  };

  if (!b) return error ? <ErrorBox message={error} onRetry={load} /> : <Spinner text="손익을 계산하는 중" />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">손익분기점</h2>
        <p className="mt-1 text-sm text-neutral-500">준비 수량에 비례해 판매된다고 가정한 예상치입니다.</p>
      </div>
      {error && <ErrorBox message={error} />}
      <div className="grid gap-3 md:grid-cols-2">
        <Card title="예산 기준">
          <p className="text-3xl font-bold">{b.bep_budget != null ? `${b.bep_budget}개 판매 필요` : "-"}</p>
          <p className="mt-2 text-sm text-neutral-500">{won(b.budget)} ÷ 평균 개당 이익 {won(b.avg_unit_margin)} · 올림</p>
        </Card>
        <Card title="실제 지출 기준">
          <p className="text-3xl font-bold">{b.bep_actual != null ? `${b.bep_actual}개 판매 필요` : "-"}</p>
          <p className="mt-2 text-sm text-neutral-500">
            {b.actual_total ? `${won(b.actual_total)} ÷ 평균 개당 이익 ${won(b.avg_unit_margin)} · 올림` : "실제 지출을 입력하면 계산돼요"}
          </p>
        </Card>
      </div>

      <Card title="계산 근거">
        <ul className="space-y-1.5 text-sm text-neutral-600">
          {b.products.map((p) => <li key={p.product_id}>{p.basis}</li>)}
          <li>{b.basis}</li>
        </ul>
        {b.warnings.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{b.warnings.map((w) => <li key={w}>• {w}</li>)}</ul>
        )}
      </Card>

      <Card title="준비 수량과 판매 목표">
        <p className="font-semibold">
          {b.prepared_total}개 준비{b.bep_budget != null ? ` · 예산 기준 ${b.bep_budget}개 판매 필요` : ""}
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          전량 판매 시 예상 손익 {signedWon(b.full_sale_profit)}
          {b.target_qty != null ? ` · 목표 이익 ${won(b.target_profit)}까지 ${b.target_qty}개 판매 필요` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setEditing(!editing)}>{editing ? "편집 닫기" : "예산·지출 편집"}</Button>
          <Button variant="secondary" href={`/events/${ev.id}/stock`}>재고와 판매 확인 ↗</Button>
        </div>
      </Card>

      {editing && (
        <>
          <BudgetForm b={b} onSave={(body) => run(api(`${url}/budget`, { method: "PATCH", json: body }))} />
          <ExpenseEditor items={b.expenses} onSave={(items) => run(api(`${url}/expenses`, { method: "PUT", json: items }))} />
          <ProductCostEditor b={b} onSave={(rows) => run(api(`${url}/budget/products`, { method: "PATCH", json: rows }))} />
        </>
      )}
    </div>
  );
}

function BudgetForm({ b, onSave }: { b: BudgetOut; onSave: (body: { budget: number; target_profit: number }) => void }) {
  const [budget, setBudget] = useState(String(b.budget || ""));
  const [target, setTarget] = useState(String(b.target_profit || ""));
  return (
    <Card title="예산과 목표 이익">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="space-y-1 text-sm"><span className="text-neutral-600">행사 예산 총액 (원)</span>
          <input className={inputCls} type="number" placeholder={`비우면 지출 예산 합계 ${b.planned_total.toLocaleString()}원`} value={budget} onChange={(e) => setBudget(e.target.value)} /></label>
        <label className="space-y-1 text-sm"><span className="text-neutral-600">목표 이익 (원)</span>
          <input className={inputCls} type="number" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
        <Button onClick={() => onSave({ budget: Number(budget || 0), target_profit: Number(target || 0) })}>저장</Button>
      </div>
    </Card>
  );
}

function ExpenseEditor({ items, onSave }: { items: Expense[]; onSave: (items: Expense[]) => void }) {
  const [rows, setRows] = useState<Expense[]>(items.length ? items : [{ category: "참가비", name: "부스 참가비", planned: 0, actual: 0 }]);
  const set = (i: number, k: keyof Expense, v: string) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, [k]: k === "planned" || k === "actual" ? Number(v || 0) : v } : r)));
  const sum = (k: "planned" | "actual") => rows.reduce((a, r) => a + r[k], 0);
  return (
    <Card title="지출 항목">
      <div className="hidden grid-cols-[140px_1fr_130px_130px_40px] gap-2 px-1 pb-1 text-xs text-neutral-500 md:grid">
        <span>분류</span><span>항목</span><span>예산</span><span>실제 지출</span><span />
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 md:grid-cols-[140px_1fr_130px_130px_40px]">
            <select className={inputCls} value={r.category} onChange={(e) => set(i, "category", e.target.value)}>
              {[...new Set([...CATEGORIES, r.category])].filter(Boolean).map((c) => <option key={c}>{c}</option>)}
            </select>
            <input className={inputCls} placeholder="예: 부스 참가비" value={r.name} onChange={(e) => set(i, "name", e.target.value)} />
            <input className={inputCls} type="number" placeholder="예산" value={r.planned || ""} onChange={(e) => set(i, "planned", e.target.value)} />
            <input className={inputCls} type="number" placeholder="실제" value={r.actual || ""} onChange={(e) => set(i, "actual", e.target.value)} />
            <button className="text-xs text-neutral-400 hover:text-red-600" onClick={() => setRows(rows.filter((_, j) => j !== i))}>삭제</button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-neutral-600">합계 · 예산 {won(sum("planned"))} · 실제 {won(sum("actual"))}</p>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" onClick={() => setRows([...rows, { category: "기타", name: "", planned: 0, actual: 0 }])}>＋ 지출 항목 추가</Button>
        <Button onClick={() => onSave(rows.filter((r) => r.name.trim()))}>지출 저장</Button>
      </div>
    </Card>
  );
}

function ProductCostEditor({ b, onSave }: { b: BudgetOut; onSave: (rows: { product_id: string; prepared_qty: number; price: number; cost: number }[]) => void }) {
  const [rows, setRows] = useState(b.products.map(({ product_id, name, prepared_qty, price, cost }) => ({ product_id, name, prepared_qty, price, cost })));
  const set = (i: number, k: "prepared_qty" | "price" | "cost", v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: Number(v || 0) } : r)));
  return (
    <Card title="준비 수량과 원가">
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">판매 상품이 없어요. 상품 관리에서 먼저 추가하세요.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-neutral-500"><tr><th className="py-1">상품</th><th>준비 수량</th><th>판매가</th><th>원가</th><th className="text-right">개당 이익</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.product_id} className="border-t border-neutral-100">
                <td className="py-2 pr-2 font-medium">{r.name}</td>
                <td className="pr-2"><input className={inputCls} type="number" value={r.prepared_qty} onChange={(e) => set(i, "prepared_qty", e.target.value)} /></td>
                <td className="pr-2"><input className={inputCls} type="number" value={r.price} onChange={(e) => set(i, "price", e.target.value)} /></td>
                <td className="pr-2"><input className={inputCls} type="number" value={r.cost} onChange={(e) => set(i, "cost", e.target.value)} /></td>
                <td className="text-right tabular-nums">{won(r.price - r.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > 0 && <Button className="mt-3" onClick={() => onSave(rows)}>수량·원가 저장</Button>}
    </Card>
  );
}
