"use client";
// 행사 상세 탭에서 같이 쓰는 카드들 (판매 계획, 체크리스트, 재고 계획, 방문객 안내)
import { useCallback, useEffect, useState } from "react";
import {
  type CheckStatus, type ChecklistOut, type EventOut, type PlanOut, api, pct, publicOrigin, won,
} from "@/components/events/api";
import { Badge, Button, Card, Empty, ErrorBox, Spinner, inputCls } from "@/components/events/ui";

const NEXT_STATUS: Record<CheckStatus, CheckStatus> = { todo: "doing", doing: "done", done: "todo" };
const CHECK_LABEL: Record<CheckStatus, string> = { todo: "미완료", doing: "진행 중", done: "완료" };

export function SalesPlan({ ev }: { ev: EventOut }) {
  return (
    <Card title="이번 행사 판매 계획" right={<Button variant="ghost" href={`/events/${ev.id}/products`}>상품·수량 편집 ↗</Button>}>
      {ev.products.length === 0 ? (
        <Empty>판매 상품이 아직 없어요. 상품·수량 편집에서 추가하세요.</Empty>
      ) : (
        <ul className="divide-y divide-neutral-100 text-sm">
          {ev.products.map((p) => (
            <li key={p.product_id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">{p.sku ? `${p.sku} · ` : ""}{p.name}</p>
                <p className="text-xs text-neutral-500">{won(p.price)} · 판매 예정 {p.planned_qty}개 · 가용 {p.stock}개</p>
              </div>
              {p.shortage > 0 ? <Badge tone="amber">{p.shortage}개 추가 준비</Badge> : <Badge tone="green">충분</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function Checklist({ id, onChange }: { id: string; onChange: () => void }) {
  const [data, setData] = useState<ChecklistOut | null>(null);
  const [busy, setBusy] = useState<"" | "ai" | "liner">("");
  const [title, setTitle] = useState("");
  const [dMinus, setDMinus] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<ChecklistOut>(`/api/events/${id}/checklist`).then(setData).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<ChecklistOut>) => {
    setError("");
    try {
      setData(await fn());
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const suggest = async (useLiner: boolean) => {
    setBusy(useLiner ? "liner" : "ai");
    await run(() => api(`/api/events/${id}/checklist/suggest`, { method: "POST", json: { use_liner: useLiner } }));
    setBusy("");
  };

  return (
    <Card title={`준비 체크리스트${data ? ` · ${data.done} / ${data.total} 완료` : ""}`}>
      {error && <div className="mb-3"><ErrorBox message={error} /></div>}
      {!data ? (
        <Spinner text="불러오는 중" />
      ) : busy ? (
        <Spinner text={busy === "liner" ? "다른 셀러들의 준비 팁을 찾아 체크리스트를 보강하는 중" : "AI가 체크리스트를 만드는 중"} />
      ) : (
        <>
          {data.items.length === 0 ? (
            <Empty>아직 체크리스트가 없어요. AI 제안을 받아보세요.</Empty>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 py-2 text-sm">
                  <button
                    onClick={() => run(() => api(`/api/events/${id}/checklist/${it.id}`, { method: "PATCH", json: { status: NEXT_STATUS[it.status] } }))}
                    title="눌러서 상태 변경"
                  >
                    <Badge tone={it.status === "done" ? "green" : it.status === "doing" ? "amber" : "gray"}>{CHECK_LABEL[it.status]}</Badge>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={it.status === "done" ? "text-neutral-400 line-through" : "font-medium"}>{it.title}</p>
                    <p className="text-xs text-neutral-500">
                      {it.d_label}{it.due_date ? ` (${it.due_date.slice(5).replace("-", ".")})` : ""}{it.category ? ` · ${it.category}` : ""}
                      {it.source_url && <> · <a href={it.source_url} target="_blank" rel="noreferrer" className="underline">출처</a></>}
                    </p>
                  </div>
                  <button className="text-xs text-neutral-400 hover:text-red-600" onClick={() => run(() => api(`/api/events/${id}/checklist/${it.id}`, { method: "DELETE" }))}>삭제</button>
                </li>
              ))}
            </ul>
          )}
          {data.is_fallback && <p className="mt-2 text-xs text-amber-700">AI 연결이 불안정해서 기본 체크리스트를 넣었어요.</p>}
          <div className="mt-4 flex items-center gap-2">
            <input className={inputCls} placeholder="항목 직접 추가" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className={`${inputCls} w-24`} type="number" placeholder="D-" value={dMinus} onChange={(e) => setDMinus(e.target.value)} />
            <Button
              variant="secondary"
              disabled={!title.trim()}
              onClick={() => run(async () => {
                const r = await api<ChecklistOut>(`/api/events/${id}/checklist`, { method: "POST", json: { title, d_minus: dMinus === "" ? null : Number(dMinus) } });
                setTitle(""); setDMinus("");
                return r;
              })}
            >
              추가
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => suggest(false)}>AI 체크리스트 {data.total ? "다시 제안" : "제안"}</Button>
            <Button variant="secondary" onClick={() => suggest(true)}>웹에서 준비 팁 찾아 보강</Button>
          </div>
          <p className="mt-2 text-xs text-neutral-500">다시 제안해도 진행 중·완료 항목은 그대로 남아요.</p>
        </>
      )}
    </Card>
  );
}

export function StockPlan({ id, visitors, onVisitors }: { id: string; visitors: number; onVisitors: (n: number) => Promise<void> }) {
  const [plan, setPlan] = useState<PlanOut | null>(null);
  const [supplies, setSupplies] = useState<{ name: string; needed: number; owned: number }[]>([]);
  const [error, setError] = useState("");

  const apply = (p: PlanOut) => {
    setPlan(p);
    setSupplies(p.supplies.map(({ name, needed, owned }) => ({ name, needed, owned })));
  };
  const load = useCallback(() => {
    api<PlanOut>(`/api/events/${id}/plan`).then(apply).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load, visitors]);

  const setCond = async (k: string, v: number) => {
    try { apply(await api<PlanOut>(`/api/events/${id}/plan`, { method: "PATCH", json: { [k]: v } })); }
    catch (e) { setError((e as Error).message); }
  };
  const saveSupplies = async () => {
    try { apply(await api<PlanOut>(`/api/events/${id}/supplies`, { method: "PUT", json: supplies.filter((s) => s.name.trim()) })); }
    catch (e) { setError((e as Error).message); }
  };

  if (!plan) return <Card title="준비물·재고 계획">{error ? <ErrorBox message={error} onRetry={load} /> : <Spinner text="계산 중" />}</Card>;

  return (
    <Card title="준비물·재고 계획">
      {error && <div className="mb-3"><ErrorBox message={error} /></div>}
      <p className="mb-2 text-sm font-medium">수량 산정 조건</p>
      <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        <label className="space-y-1"><span className="text-xs text-neutral-500">예상 방문객</span>
          <input className={inputCls} type="number" defaultValue={visitors || ""} onBlur={(e) => onVisitors(Number(e.target.value || 0))} /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-500">구매율(%)</span>
          <input className={inputCls} type="number" defaultValue={Math.round(plan.conditions.purchase_rate * 100)} onBlur={(e) => setCond("purchase_rate", Number(e.target.value || 0) / 100)} /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-500">구매당 수량</span>
          <input className={inputCls} type="number" defaultValue={plan.conditions.qty_per_purchase} onBlur={(e) => setCond("qty_per_purchase", Math.max(1, Number(e.target.value || 1)))} /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-500">여유분</span>
          <input className={inputCls} type="number" defaultValue={plan.conditions.buffer_qty} onBlur={(e) => setCond("buffer_qty", Number(e.target.value || 0))} /></label>
      </div>
      <p className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-sm">산출 근거 · {plan.basis} <span className="text-neutral-500">(구매율 {pct(plan.conditions.purchase_rate)})</span></p>

      {plan.products.length > 0 && (
        <ul className="mt-3 divide-y divide-neutral-100 text-sm">
          {plan.products.map((p) => (
            <li key={p.product_id} className="py-2">
              <div className="flex justify-between">
                <span className="font-medium">{p.name} {p.sku && <span className="text-neutral-400">{p.sku}</span>}</span>
                {p.shortage > 0 ? <Badge tone="amber">부족 {p.shortage}개</Badge> : <Badge tone="green">충분</Badge>}
              </div>
              <p className="text-xs text-neutral-500">가용 {p.stock}개 · 판매 예정 {p.planned_qty}개 · 권장 {p.recommended_qty}개</p>
            </li>
          ))}
        </ul>
      )}

      <p className="mb-2 mt-4 text-sm font-medium">준비물</p>
      <div className="space-y-2">
        {supplies.map((s, i) => (
          <div key={i} className="flex gap-2">
            <input className={inputCls} placeholder="예: 종이백" value={s.name} onChange={(e) => setSupplies(supplies.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <input className={`${inputCls} w-24`} type="number" placeholder="필요" value={s.needed || ""} onChange={(e) => setSupplies(supplies.map((x, j) => (j === i ? { ...x, needed: Number(e.target.value || 0) } : x)))} />
            <input className={`${inputCls} w-24`} type="number" placeholder="보유" value={s.owned || ""} onChange={(e) => setSupplies(supplies.map((x, j) => (j === i ? { ...x, owned: Number(e.target.value || 0) } : x)))} />
            <button className="text-xs text-neutral-400" onClick={() => setSupplies(supplies.filter((_, j) => j !== i))}>삭제</button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setSupplies([...supplies, { name: "", needed: 0, owned: 0 }])}>＋ 준비물 추가</Button>
          <Button variant="secondary" onClick={saveSupplies}>준비물 저장</Button>
        </div>
      </div>

      {plan.warnings.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          {plan.warnings.map((w) => <li key={w}>• {w}</li>)}
        </ul>
      )}
    </Card>
  );
}

export function VisitorPage({ ev, patch }: { ev: EventOut; patch: (b: Partial<EventOut>) => Promise<void> }) {
  const [form, setForm] = useState({ subscribe_url: ev.subscribe_url, chat_plugin_key: ev.chat_plugin_key, notice: ev.notice });
  const [saved, setSaved] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(publicOrigin()), []);
  const url = `${origin}/e/${ev.id}`;

  const save = async () => {
    await patch(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Card title="행사 안내 페이지 · 방문객 접점" right={ev.is_public ? <Badge tone="green">공개 중</Badge> : <Badge>공개 전 · 운영자 확인 필요</Badge>}>
      <div className="space-y-3 text-sm">
        <label className="block space-y-1"><span className="text-xs text-neutral-500">방문객 안내 문구 (FAQ·공지)</span>
          <textarea className={inputCls} rows={2} placeholder="예: 포켓 노트는 현장 구매가 가능합니다." value={form.notice} onChange={(e) => setForm({ ...form, notice: e.target.value })} /></label>
        <label className="block space-y-1"><span className="text-xs text-neutral-500">스티비 · 행사 전용 구독 폼 URL</span>
          <input className={inputCls} placeholder="https://page.stibee.com/subscriptions/…" value={form.subscribe_url} onChange={(e) => setForm({ ...form, subscribe_url: e.target.value })} /></label>
        <label className="block space-y-1"><span className="text-xs text-neutral-500">채널톡 · 플러그인 키 (상담 위젯)</span>
          <input className={inputCls} placeholder="채널톡 관리자 > 설정 > 플러그인 키" value={form.chat_plugin_key} onChange={(e) => setForm({ ...form, chat_plugin_key: e.target.value })} /></label>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={save}>{saved ? "저장됨 ✓" : "설정 저장"}</Button>
          <Button onClick={() => patch({ ...form, is_public: !ev.is_public })}>{ev.is_public ? "공개 중지" : "안내 페이지 공개"}</Button>
          <Button variant="ghost" href={`/e/${ev.id}`}>방문객 화면 보기 ↗</Button>
        </div>
        {ev.is_public && origin && (
          <div className="flex items-center gap-4 rounded-lg bg-neutral-50 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="부스 QR" width={96} height={96} src={`https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(url)}`} />
            <div className="min-w-0 text-xs">
              <p className="font-medium text-neutral-800">부스 QR · 공개 안내 페이지 URL</p>
              <p className="mt-1 break-all text-neutral-500">{url}</p>
              <button className="mt-1 underline" onClick={() => navigator.clipboard.writeText(url)}>링크 복사</button>
              <p className="mt-1 text-neutral-500">이 URL을 네이버 광고와 블로그·인스타 홍보에서 사용합니다.</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
