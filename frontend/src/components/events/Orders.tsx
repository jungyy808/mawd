"use client";
// Figma 38 발주 일정 등록 → 38.1 발주 예정 → 38.2 발주 완료 → 38.3 입고 확인 → 38.4 입고 완료 (ORD-01)
import { useCallback, useEffect, useState } from "react";
import { ORDER_LABEL, type OrderOut, type OrdersOut, api, fmtDate } from "@/components/events/api";
import { Badge, Button, Card, ErrorBox, Field, inputCls } from "@/components/events/ui";

const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // KST

export default function Orders({ eventId, onStockChange }: { eventId: string; onStockChange?: () => void }) {
  const url = `/api/events/${eventId}/orders`;
  const [data, setData] = useState<OrdersOut | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ product_id: "", qty: "", supplier: "", order_date: today(), expected_date: today() });
  const [receiving, setReceiving] = useState<Record<string, { qty: string; date: string }>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const apply = (r: OrdersOut) => { setData(r); onStockChange?.(); };
  const load = useCallback(() => { api<OrdersOut>(url).then(setData).catch((e) => setError(e.message)); }, [url]);
  useEffect(load, [load]);

  const run = async (key: string, fn: () => Promise<OrdersOut>) => {
    setBusy(key); setError("");
    try { apply(await fn()); return true; } catch (e) { setError((e as Error).message); return false; } finally { setBusy(""); }
  };

  const formErr = !form.product_id ? "상품을 고르세요" : !(Number(form.qty) > 0) ? "발주 수량은 1개 이상" :
    form.expected_date < form.order_date ? "입고 예정일은 발주일과 같거나 이후여야 해요" : "";

  const create = async () => {
    const ok = await run("create", () => api(url, { method: "POST", json: { ...form, qty: Number(form.qty) } }));
    if (ok) { setOpen(false); setForm({ product_id: "", qty: "", supplier: "", order_date: today(), expected_date: today() }); }
  };

  const tone = (o: OrderOut) => (o.status === "received" ? "green" : o.status === "ordered" ? "blue" : "amber") as "green" | "blue" | "amber";

  return (
    <Card title="발주·입고" right={!open && <Button variant="secondary" onClick={() => { setOpen(true); setForm((f) => ({ ...f, product_id: f.product_id || data?.stock[0]?.product_id || "" })); }}>＋ 발주 일정 등록</Button>}>
      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      {open && (
        <div className="mb-4 rounded-xl border border-[#6d53f1]/30 bg-[#6d53f1]/5 p-4">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="md:col-span-2">
              <Field label="상품" required>
                <select className={inputCls} value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                  <option value="">선택</option>
                  {data?.stock.map((s) => <option key={s.product_id} value={s.product_id}>{s.name} (남은 {s.remaining}개)</option>)}
                </select>
              </Field>
            </div>
            <Field label="발주 수량" required><input className={inputCls} type="number" min={1} value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></Field>
            <div className="md:col-span-2"><Field label="공급처"><input className={inputCls} placeholder="예: 키링공방" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></Field></div>
            <div className="md:col-span-2"><Field label="발주일" required><input className={inputCls} type="date" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} /></Field></div>
            <div className="md:col-span-2"><Field label="입고 예정일" required><input className={inputCls} type="date" value={form.expected_date} onChange={(e) => setForm({ ...form, expected_date: e.target.value })} /></Field></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={create} disabled={!!formErr || busy === "create"}>{busy === "create" ? "등록 중…" : "발주 일정 등록"}</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>취소</Button>
            {formErr && form.product_id !== "" && <span className="text-xs text-amber-700">{formErr}</span>}
          </div>
        </div>
      )}

      {!data ? (
        <p className="text-sm text-neutral-500">불러오는 중…</p>
      ) : data.orders.length === 0 ? (
        <p className="text-sm text-neutral-500">발주 일정이 없어요. 부족한 상품은 발주 일정을 등록하면 일정 캘린더에도 표시돼요.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {data.orders.map((o) => {
            const rv = receiving[o.id];
            return (
              <li key={o.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={tone(o)}>{ORDER_LABEL[o.status]}</Badge>
                  <span className="font-medium">{o.name}</span>
                  <span className="text-sm text-neutral-600">{o.qty}개{o.supplier ? ` · ${o.supplier}` : ""}</span>
                  <span className="text-xs text-neutral-500">
                    발주 {fmtDate(o.order_date)} → 입고 예정 {fmtDate(o.expected_date)}
                    {o.status === "received" && ` · ${fmtDate(o.received_date)} ${o.received_qty}개 입고`}
                  </span>
                  <span className="ml-auto flex gap-2">
                    {o.status === "planned" && (
                      <Button variant="secondary" disabled={busy === o.id} onClick={() => run(o.id, () => api(`${url}/${o.id}`, { method: "PATCH", json: { status: "ordered" } }))}>발주 완료</Button>
                    )}
                    {o.status !== "received" && !rv && (
                      <Button onClick={() => setReceiving({ ...receiving, [o.id]: { qty: String(o.qty), date: today() } })}>입고 확인</Button>
                    )}
                    {o.status !== "received" && (
                      <button className="text-xs text-neutral-400 hover:text-red-600" onClick={() => confirm("이 발주를 삭제할까요?") && run(o.id, () => api(`${url}/${o.id}`, { method: "DELETE" }))}>삭제</button>
                    )}
                  </span>
                </div>
                {rv && o.status !== "received" && (
                  <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-emerald-50 p-3">
                    <Field label="실제 입고 수량"><input className={`${inputCls} w-28`} type="number" min={0} value={rv.qty} onChange={(e) => setReceiving({ ...receiving, [o.id]: { ...rv, qty: e.target.value } })} /></Field>
                    <Field label="입고일"><input className={inputCls} type="date" value={rv.date} onChange={(e) => setReceiving({ ...receiving, [o.id]: { ...rv, date: e.target.value } })} /></Field>
                    <Button disabled={busy === o.id || rv.qty === ""} onClick={async () => {
                      const ok = await run(o.id, () => api(`${url}/${o.id}/receive`, { method: "POST", json: { received_qty: Number(rv.qty), received_date: rv.date } }));
                      if (ok) setReceiving((m) => { const n = { ...m }; delete n[o.id]; return n; });
                    }}>{busy === o.id ? "반영 중…" : "입고 완료 · 재고 반영"}</Button>
                    <Button variant="ghost" onClick={() => setReceiving((m) => { const n = { ...m }; delete n[o.id]; return n; })}>취소</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
