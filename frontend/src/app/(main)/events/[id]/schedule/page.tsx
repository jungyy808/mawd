"use client";
// Figma 41 행사 운영 캘린더 (월간) · 41.1 주간 · 41.2/41.3 발주 일정 반영 (CAL-01)
// 원본 일정(행사·체크리스트 마감·발주·입고)을 모아 보여준다. 체크리스트 완료 처리는 개요에서만.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type ChecklistOut, type OrdersOut, ORDER_LABEL, api } from "@/components/events/api";
import { useEvent } from "@/components/events/EventShell";
import { Card, ErrorBox, Spinner } from "@/components/events/ui";

type Kind = "order" | "prep" | "onsite" | "promo";
type Item = { date: string; title: string; kind: Kind; href?: string; done?: boolean };

const KIND: Record<Kind, { label: string; dot: string; chip: string }> = {
  order: { label: "발주·입고", dot: "bg-[#f7ac88]", chip: "bg-[#f7ac88]/25 text-[#9a4a1f]" },
  prep: { label: "준비", dot: "bg-[#6d53f1]", chip: "bg-[#6d53f1]/15 text-[#4b36c4]" },
  onsite: { label: "현장", dot: "bg-[#03c75a]", chip: "bg-[#03c75a]/15 text-[#047a3a]" },
  promo: { label: "홍보", dot: "bg-[#e05aa8]", chip: "bg-[#ffcdee]/70 text-[#a3226e]" },
};
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export default function SchedulePage() {
  const { ev } = useEvent();
  const base = `/events/${ev.id}`;
  const [ck, setCk] = useState<ChecklistOut | null>(null);
  const [orders, setOrders] = useState<OrdersOut | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"month" | "week">("month");
  const [on, setOn] = useState<Record<Kind, boolean>>({ order: true, prep: true, onsite: true, promo: true });
  const [cursor, setCursor] = useState<Date>(() => (ev.start_date ? parse(ev.start_date) : new Date()));
  const [picked, setPicked] = useState<string>(() => ev.start_date ?? ymd(new Date())); // 선택한 날 (Figma: 선택한 날 패널)

  const load = useCallback(() => {
    Promise.all([api<ChecklistOut>(`/api/events/${ev.id}/checklist`), api<OrdersOut>(`/api/events/${ev.id}/orders`)])
      .then(([c, o]) => { setCk(c); setOrders(o); })
      .catch((e) => setError(e.message));
  }, [ev.id]);
  useEffect(load, [load]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    // 행사 일정 (현장)
    if (ev.start_date) {
      const end = ev.end_date ? parse(ev.end_date) : parse(ev.start_date);
      for (let d = parse(ev.start_date), i = 1; d <= end; d = addDays(d, 1), i++) out.push({ date: ymd(d), title: `${ev.name} ${i}일차`, kind: "onsite", href: base });
    }
    if (ev.apply_deadline && /^\d{4}-\d{2}-\d{2}/.test(ev.apply_deadline)) out.push({ date: ev.apply_deadline.slice(0, 10), title: "참가 신청 마감", kind: "prep", href: base });
    // 준비 체크리스트 마감
    for (const c of ck?.items ?? []) {
      if (!c.due_date) continue;
      const kind: Kind = c.category === "홍보" ? "promo" : c.category === "현장 운영" ? "onsite" : "prep";
      out.push({ date: c.due_date, title: c.title, kind, href: base, done: c.status === "done" });
    }
    // 발주·입고
    for (const o of orders?.orders ?? []) {
      out.push({ date: o.order_date, title: `${o.name} ${o.qty}개 발주${o.status === "planned" ? " (예정)" : ""}`, kind: "order", href: `${base}/stock`, done: o.status !== "planned" });
      const rd = o.status === "received" && o.received_date ? o.received_date : o.expected_date;
      out.push({ date: rd, title: `${o.name} ${o.status === "received" ? `${o.received_qty}개 입고 완료` : "입고 예정"}`, kind: "order", href: `${base}/stock`, done: o.status === "received" });
    }
    return out.filter((i) => on[i.kind]);
  }, [ev, ck, orders, on, base]);

  const byDate = useMemo(() => {
    const m: Record<string, Item[]> = {};
    for (const i of items) (m[i.date] ??= []).push(i);
    return m;
  }, [items]);

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!ck || !orders) return <Spinner text="일정을 모으는 중" />;

  // 보이는 날짜 범위
  const days: Date[] = [];
  if (view === "month") {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = addDays(first, -first.getDay());
    for (let i = 0; i < 42; i++) days.push(addDays(start, i));
  } else {
    const start = addDays(cursor, -cursor.getDay());
    for (let i = 0; i < 7; i++) days.push(addDays(start, i));
  }
  const today = ymd(new Date());
  const move = (n: number) => setCursor((c) => (view === "month" ? new Date(c.getFullYear(), c.getMonth() + n, 1) : addDays(c, 7 * n)));
  const title = view === "month" ? `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`
    : `${days[0].getMonth() + 1}.${days[0].getDate()} – ${days[6].getMonth() + 1}.${days[6].getDate()}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold">행사 운영 캘린더</h2>
        <div className="ml-auto flex rounded-lg bg-white p-1 ring-1 ring-neutral-200">
          {(["month", "week"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-md px-4 py-1.5 text-sm font-medium ${view === v ? "bg-[#6d53f1] text-white" : "text-neutral-600"}`}>
              {v === "month" ? "월간" : "주간"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(KIND) as Kind[]).map((k) => (
          <button key={k} onClick={() => setOn({ ...on, [k]: !on[k] })}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ${on[k] ? "bg-white ring-neutral-300" : "bg-neutral-100 text-neutral-400 ring-transparent line-through"}`}>
            <span className={`h-2 w-2 rounded-full ${KIND[k].dot}`} />{KIND[k].label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1">
          <button onClick={() => move(-1)} className="rounded-md px-2 py-1 text-lg hover:bg-neutral-100" aria-label="이전">‹</button>
          <span className="min-w-[120px] text-center font-semibold">{title}</span>
          <button onClick={() => move(1)} className="rounded-md px-2 py-1 text-lg hover:bg-neutral-100" aria-label="다음">›</button>
          <button onClick={() => setCursor(ev.start_date ? parse(ev.start_date) : new Date())} className="ml-1 rounded-md px-2 py-1 text-xs text-[#6d53f1] hover:bg-[#6d53f1]/10">행사 주간으로</button>
        </span>
      </div>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200">
        <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50 text-center text-xs font-medium text-neutral-500">
          {WEEK.map((w, i) => <div key={w} className={`py-2 ${i === 0 ? "text-red-500" : i === 6 ? "text-sky-600" : ""}`}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const key = ymd(d);
            const list = byDate[key] ?? [];
            const dim = view === "month" && d.getMonth() !== cursor.getMonth();
            return (
              <div key={key} role="button" tabIndex={0} onClick={() => setPicked(key)} onKeyDown={(e) => e.key === "Enter" && setPicked(key)}
                className={`cursor-pointer border-r border-b border-neutral-100 p-1 sm:p-1.5 ${view === "month" ? "min-h-[64px] sm:min-h-[96px]" : "min-h-[120px] sm:min-h-[220px]"} ${dim ? "bg-neutral-50/70" : ""} ${picked === key ? "ring-2 ring-inset ring-[#6d53f1]" : "hover:bg-[#6d53f1]/5"}`}>
                <div className={`mb-1 text-xs ${key === today ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#6d53f1] font-semibold text-white" : dim ? "text-neutral-300" : "text-neutral-600"}`}>{d.getDate()}</div>
                {/* 휴대폰: 글자가 잘리지 않게 점으로만 표시하고, 날짜를 누르면 아래에 목록 */}
                <div className="flex flex-wrap gap-1 sm:hidden">
                  {list.map((i, n) => <span key={n} className={`h-1.5 w-1.5 rounded-full ${KIND[i.kind].dot} ${i.done ? "opacity-40" : ""}`} />)}
                </div>
                <div className="hidden space-y-1 sm:block">
                  {(view === "month" ? list.slice(0, 3) : list).map((i, n) => (
                    <p key={n} title={i.title}
                      className={`line-clamp-2 break-keep rounded px-1.5 py-0.5 text-[11px] font-medium leading-snug ${KIND[i.kind].chip} ${i.done ? "line-through opacity-60" : ""}`}>
                      {i.title}
                    </p>
                  ))}
                  {view === "month" && list.length > 3 && <p className="px-1 text-[11px] text-neutral-500">+{list.length - 3}개</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(() => {
        const d = parse(picked);
        const list = byDate[picked] ?? [];
        return (
          <Card title={`선택한 날 · ${d.getMonth() + 1}월 ${d.getDate()}일 ${"일월화수목금토"[d.getDay()]}요일`}>
            {list.length === 0 ? (
              <p className="text-sm text-neutral-500">이날은 일정이 없어요.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {list.map((i, n) => (
                  <li key={n} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${KIND[i.kind].dot}`} />
                      <span className="text-xs text-neutral-500">{KIND[i.kind].label}</span>
                      <span className={`font-medium ${i.done ? "text-neutral-400 line-through" : ""}`}>{i.title}</span>
                    </span>
                    <Link href={i.href ?? base} className="shrink-0 text-xs font-semibold text-[#6d53f1] hover:underline">일정 상세 ↗</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })()}

      <Card title="발주·입고 일정">
        {orders.orders.length === 0 ? (
          <p className="text-sm text-neutral-500">등록된 발주가 없어요. <Link href={`${base}/stock`} className="text-[#6d53f1] underline">상품 관리에서 발주 일정 등록</Link></p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {orders.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap gap-2">
                <span className="w-16 font-medium">{ORDER_LABEL[o.status]}</span>
                <Link href={`${base}/stock`} className="underline">{o.name} {o.qty}개</Link>
                <span className="text-neutral-500">발주 {o.order_date} → 입고 {o.status === "received" ? `${o.received_date} (${o.received_qty}개)` : `예정 ${o.expected_date}`}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="text-xs text-neutral-500">체크리스트 추가·완료 처리는 개요에서 해요. 날짜가 없는 체크리스트 항목은 캘린더에 표시되지 않아요.</p>
    </div>
  );
}
