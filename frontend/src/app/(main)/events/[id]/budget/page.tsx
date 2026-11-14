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
    api<BudgetOut>(`${url}/budget`).then((r) => { setB(r); if (!r.has_budget) setEditing(true); }).catch((e) => setError(e.message));
  }, [url]);
  useEffect(load, [load]);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("edit")) setEditing(true); }, []);

  const run = async (p: Promise<BudgetOut>): Promise<boolean> => {
    setError("");
    try { setB(await p); return true; } catch (e) { setError((e as Error).message); return false; }
  };

  if (!b) return error ? <ErrorBox message={error} onRetry={load} /> : <Spinner text="손익을 계산하는 중" />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">손익분기점</h2>
        <p className="mt-1 text-sm text-neutral-500">준비 수량에 비례해 판매된다고 가정한 예상치입니다.</p>
      </div>
      {error && <ErrorBox message={error} />}
      {!b.has_budget && (
        <div className="rounded-xl border border-[#6d53f1]/30 bg-[#6d53f1]/5 p-4 text-sm">
          <p className="font-semibold text-[#6d53f1]">예산 입력하고 손익분기점을 알아봐요.</p>
          <p className="mt-1 text-neutral-600">아래에서 지출 항목(예: 부스 참가비, 집기 대여, 운송비, 홍보비)과 상품 원가를 넣으면 계산돼요.</p>
        </div>
      )}
      {b.has_budget && <BudgetUsage b={b} />}
      {b.sold_qty > 0 && (
        <Card title="손익분기까지 남은 판매량">
          <p className="text-3xl font-bold">{b.remaining_to_bep === 0 ? "손익분기 달성!" : `${b.remaining_to_bep ?? "-"}개 더 팔면 돼요`}</p>
          <p className="mt-2 text-sm text-neutral-500">
            지금까지 {b.sold_qty}개 판매 · 누적 공헌이익 {won(b.contribution_so_far)} · ({won(b.budget)} − {won(b.contribution_so_far)}) ÷ 평균 개당 이익 {won(b.avg_unit_margin)} · 올림
          </p>
          <p className="mt-1 text-xs text-neutral-400">앞으로도 준비 수량 비율대로 팔린다고 가정한 추정치예요.</p>
        </Card>
      )}
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
          <ExpenseEditor items={b.expenses} budget={b.budget} onSave={(items) => run(api(`${url}/expenses`, { method: "PUT", json: items }))} />
          <ProductCostEditor b={b} onSave={(rows) => run(api(`${url}/budget/products`, { method: "PATCH", json: rows }))} />
        </>
      )}
    </div>
  );
}

type SaveState = "idle" | "saving" | "error";
// 값이 바뀌었을 때만 저장 버튼을 보여주고, 아니면 "저장됨 ✓" 상태로 둔다
function useSave() {
  const [state, setState] = useState<SaveState>("idle");
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const save = async (fn: () => Promise<boolean>) => {
    setState("saving");
    const ok = await fn();
    setState(ok ? "idle" : "error");
    if (ok) { setDirty(false); setJustSaved(true); setTimeout(() => setJustSaved(false), 2500); }
  };
  return { state, dirty, justSaved, touch: () => { setDirty(true); setJustSaved(false); }, save };
}
function SaveButton({ label, s, onClick }: { label: string; s: ReturnType<typeof useSave>; onClick: () => void }) {
  if (!s.dirty && s.state !== "saving") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-50 px-4 text-sm font-medium text-emerald-700">저장됨 ✓</span>
        {s.justSaved && <span className="text-xs text-emerald-700">저장했어요. 위 손익분기점에 바로 반영됐어요.</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onClick} disabled={s.state === "saving"}>{s.state === "saving" ? "저장 중…" : label}</Button>
      {s.state === "error" ? (
        <span className="text-xs text-red-600">저장하지 못했어요. 위 안내를 확인하세요.</span>
      ) : (
        <span className="text-xs text-amber-700">저장하지 않은 변경이 있어요</span>
      )}
    </div>
  );
}

function BudgetUsage({ b }: { b: BudgetOut }) {
  const left = b.budget - b.actual_total;
  const ratio = b.budget ? Math.min(100, Math.round((b.actual_total / b.budget) * 100)) : 0;
  const over = left < 0;
  return (
    <Card title="예산 사용 현황">
      <div className="grid gap-3 sm:grid-cols-3">
        <div><p className="text-xs text-neutral-500">행사 예산</p><p className="mt-1 text-xl font-bold tabular-nums">{won(b.budget)}</p></div>
        <div><p className="text-xs text-neutral-500">실제 지출</p><p className="mt-1 text-xl font-bold tabular-nums">{won(b.actual_total)}</p></div>
        <div>
          <p className="text-xs text-neutral-500">{over ? "예산 초과" : "남은 예산"}</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${over ? "text-red-600" : "text-emerald-700"}`}>{won(Math.abs(left))}</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full ${over ? "bg-red-500" : "bg-[#6d53f1]"}`} style={{ width: `${over ? 100 : ratio}%` }} />
      </div>
      <p className="mt-1 text-xs text-neutral-500">예산의 {b.budget ? Math.round((b.actual_total / b.budget) * 100) : 0}% 사용</p>
    </Card>
  );
}

function BudgetForm({ b, onSave }: { b: BudgetOut; onSave: (body: { budget: number; target_profit: number }) => Promise<boolean> }) {
  const [budget, setBudget] = useState(String(b.budget || ""));
  const [target, setTarget] = useState(String(b.target_profit || ""));
  const sv = useSave();
  return (
    <Card title="예산과 목표 이익">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="space-y-1 text-sm"><span className="text-neutral-600">행사 예산 총액 (원)</span>
          <input className={inputCls} type="number" placeholder={`비우면 지출 예산 합계 ${b.planned_total.toLocaleString()}원`} value={budget} onChange={(e) => { setBudget(e.target.value); sv.touch(); }} /></label>
        <label className="space-y-1 text-sm"><span className="text-neutral-600">목표 이익 (원)</span>
          <input className={inputCls} type="number" value={target} onChange={(e) => { setTarget(e.target.value); sv.touch(); }} /></label>
        <SaveButton label="저장" s={sv} onClick={() => sv.save(() => onSave({ budget: Number(budget || 0), target_profit: Number(target || 0) }))} />
      </div>
    </Card>
  );
}

function ExpenseEditor({ items, budget, onSave }: { items: Expense[]; budget: number; onSave: (items: Expense[]) => Promise<boolean> }) {
  const sv = useSave();
  const [rows, setRows] = useState<Expense[]>(items.length ? items : [{ category: "참가비", name: "부스 참가비", planned: 0, actual: 0 }]);
  const set = (i: number, k: keyof Expense, v: string) => {
    sv.touch();
    setRows(rows.map((r, j) => (j === i ? { ...r, [k]: k === "planned" || k === "actual" ? Number(v || 0) : v } : r)));
  };
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
            <button className="text-xs text-neutral-400 hover:text-red-600" onClick={() => { sv.touch(); setRows(rows.filter((_, j) => j !== i)); }}>삭제</button>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 rounded-lg bg-neutral-50 p-3 text-sm sm:grid-cols-3">
        <p>지출 예산 합계 <b className="tabular-nums">{won(sum("planned"))}</b></p>
        <p>실제 지출 합계 <b className="tabular-nums">{won(sum("actual"))}</b></p>
        <p className={(budget || sum("planned")) - sum("actual") < 0 ? "text-red-600" : "text-emerald-700"}>
          {(budget || sum("planned")) - sum("actual") < 0 ? "예산 초과 " : "남은 예산 "}
          <b className="tabular-nums">{won(Math.abs((budget || sum("planned")) - sum("actual")))}</b>
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => { sv.touch(); setRows([...rows, { category: "기타", name: "", planned: 0, actual: 0 }]); }}>＋ 지출 항목 추가</Button>
        <SaveButton label="지출 저장" s={sv} onClick={() => sv.save(() => onSave(rows.filter((r) => r.name.trim())))} />
      </div>
    </Card>
  );
}

function ProductCostEditor({ b, onSave }: { b: BudgetOut; onSave: (rows: { product_id: string; prepared_qty: number; price: number; cost: number }[]) => Promise<boolean> }) {
  const sv = useSave();
  const [rows, setRows] = useState(b.products.map(({ product_id, name, prepared_qty, price, cost }) => ({ product_id, name, prepared_qty, price, cost })));
  const set = (i: number, k: "prepared_qty" | "price" | "cost", v: string) => { sv.touch(); setRows(rows.map((r, j) => (j === i ? { ...r, [k]: Number(v || 0) } : r))); };
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
      {rows.length > 0 && <div className="mt-3"><SaveButton label="수량·원가 저장" s={sv} onClick={() => sv.save(() => onSave(rows))} /></div>}
    </Card>
  );
}
