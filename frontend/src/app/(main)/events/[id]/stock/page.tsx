"use client";
// Figma 37.3 상품 관리 / 42 현장 판매 입력 / 43 판매 반영
import { useCallback, useEffect, useState } from "react";
import { PAY_LABEL, type SalesOut, api, won } from "@/components/events/api";
import { useEvent } from "@/components/events/EventShell";
import { StockPlan } from "@/components/events/sections";
import { Badge, Button, Card, Empty, ErrorBox, Spinner } from "@/components/events/ui";

export default function StockPage() {
  const { ev, patch, reload } = useEvent();
  const url = `/api/events/${ev.id}/sales`;
  const [data, setData] = useState<SalesOut | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [pay, setPay] = useState("card");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const load = useCallback(() => { api<SalesOut>(url).then(setData).catch((e) => setError(e.message)); }, [url]);
  useEffect(load, [load]);

  const items = Object.entries(qty).filter(([, n]) => n > 0).map(([product_id, n]) => ({ product_id, qty: n }));
  const total = data ? items.reduce((a, it) => a + it.qty * (data.stock.find((s) => s.product_id === it.product_id)?.price ?? 0), 0) : 0;
  const over = data?.stock.some((s) => (qty[s.product_id] ?? 0) > s.remaining);

  const save = async () => {
    setError("");
    try {
      const r = await api<SalesOut>(url, { method: "POST", json: { payment_method: pay, items } });
      setData(r);
      setSaved(`${items.reduce((a, i) => a + i.qty, 0)}개 · ${won(total)} 저장됨`);
      setQty({});
      setTimeout(() => setSaved(""), 2500);
    } catch (e) { setError((e as Error).message); }
  };
  const cancel = async (sid: string) => {
    if (!confirm("이 판매 기록을 취소할까요? 재고가 되돌아가요.")) return;
    try { setData(await api<SalesOut>(`${url}/${sid}`, { method: "DELETE" })); } catch (e) { setError((e as Error).message); }
  };

  if (!data) return error ? <ErrorBox message={error} onRetry={load} /> : <Spinner text="불러오는 중" />;

  return (
    <div className="space-y-4">
      <Card title="현장 판매 기록" right={<Button variant="ghost" href={`/events/${ev.id}/products`}>판매 상품·준비 수량 편집 ↗</Button>}>
        {data.stock.length === 0 ? (
          <Empty>판매 상품이 없어요. 오른쪽 위 ‘판매 상품·준비 수량 편집’에서 추가하세요.</Empty>
        ) : (
          <>
            <div className="space-y-2">
              {data.stock.map((s) => {
                const n = qty[s.product_id] ?? 0;
                const bad = n > s.remaining;
                return (
                  <div key={s.product_id} className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${bad ? "border-red-300 bg-red-50" : "border-neutral-200 bg-neutral-50"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{s.name} · 남은 재고 {s.remaining}개</p>
                      <p className="text-xs text-neutral-500">{won(s.price)} · 준비 {s.prepared_qty}개 · 판매 {s.sold_qty}개</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="mr-1 text-sm font-medium">판매 수량</span>
                      <button className="h-8 w-8 rounded border bg-white" onClick={() => setQty({ ...qty, [s.product_id]: Math.max(0, n - 1) })}>−</button>
                      <input className="h-8 w-14 rounded border text-center text-sm" type="number" value={n} onChange={(e) => setQty({ ...qty, [s.product_id]: Math.max(0, Number(e.target.value || 0)) })} />
                      <button className="h-8 w-8 rounded border bg-white" onClick={() => setQty({ ...qty, [s.product_id]: n + 1 })}>+</button>
                    </div>
                    <p className="w-24 text-right text-sm tabular-nums text-neutral-600">{won(n * s.price)}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">결제 수단</span>
              {Object.entries(PAY_LABEL).map(([k, v]) => (
                <button key={k} onClick={() => setPay(k)} className={`rounded-md px-3 py-1.5 ${pay === k ? "bg-[#6d53f1] text-white" : "bg-neutral-100"}`}>{v}</button>
              ))}
            </div>
            <p className="mt-3 text-sm text-neutral-600">합계 {items.reduce((a, i) => a + i.qty, 0)}개 · {won(total)}</p>
            <p className="text-xs text-neutral-500">남은 재고를 초과하면 수량을 수정해야 저장할 수 있어요.</p>
            {error && <div className="mt-2"><ErrorBox message={error} /></div>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button onClick={save} disabled={!items.length || over}>판매 저장</Button>
              <Button variant="secondary" onClick={() => setQty({})} disabled={!items.length}>취소하고 재고로 돌아가기</Button>
              {saved && <Badge tone="green">{saved}</Badge>}
            </div>
          </>
        )}
      </Card>

      <Card title={`판매 기록 · ${data.total_qty}개 · ${won(data.total_revenue)}`}>
        {data.sales.length === 0 ? (
          <p className="text-sm text-neutral-500">아직 판매 기록이 없어요.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {data.sales.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <span className="w-12 text-xs text-neutral-500">{new Date(s.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="flex-1">{s.items.map((i) => `${i.name} ${i.qty}개`).join(" · ")}</span>
                <Badge>{PAY_LABEL[s.payment_method] ?? s.payment_method}</Badge>
                <span className="w-24 text-right tabular-nums">{won(s.total)}</span>
                <button className="text-xs text-neutral-400 hover:text-red-600" onClick={() => cancel(s.id)}>취소</button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <StockPlan id={ev.id} visitors={ev.expected_visitors} onVisitors={async (n) => { await patch({ expected_visitors: n }); await reload(); }} />
    </div>
  );
}
