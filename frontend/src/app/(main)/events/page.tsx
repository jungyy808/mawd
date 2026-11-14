"use client";
// Figma 02 · 홈 / 내 행사
import Link from "next/link";
import { useEffect, useState } from "react";
import { type BudgetOut, type EventOut, type Phase, api, fmtRange, phaseLabel, phaseOf } from "@/components/events/api";
import { Button, Empty, ErrorBox, Spinner } from "@/components/events/ui";

const FILTERS: ("전체" | Phase)[] = ["전체", "준비 중", "운영 중", "종료"];

export default function MyEventsPage() {
  const [events, setEvents] = useState<EventOut[] | null>(null);
  const [budgets, setBudgets] = useState<Record<string, BudgetOut>>({});
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("전체");
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    api<EventOut[]>("/api/events")
      .then((evs) => {
        setEvents(evs);
        evs.forEach((e) => api<BudgetOut>(`/api/events/${e.id}/budget`).then((b) => setBudgets((m) => ({ ...m, [e.id]: b }))).catch(() => {}));
      })
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const shown = (events ?? []).filter((e) => filter === "전체" || phaseOf(e) === filter);

  return (
    <div className="mx-auto max-w-[1128px]">
      <h1 className="text-3xl font-bold text-neutral-900">내 행사</h1>
      <p className="mt-2 text-sm text-neutral-500">진행할 행사를 선택해 준비와 홍보 업무를 관리하세요.</p>
      <Button href="/events/new" className="mt-4 h-11 w-[190px] justify-start">＋ 행사 생성 ↗</Button>
      <div className="mt-4 mb-4 flex gap-1.5">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${filter === f ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"}`}>{f}</button>
        ))}
      </div>
      {error && <ErrorBox message={error} onRetry={load} />}
      {!events && !error && <Spinner text="행사를 불러오는 중" />}
      {events && shown.length === 0 && <Empty>{events.length ? "이 단계의 행사가 없어요." : "아직 등록된 행사가 없어요. 행사 생성으로 시작하세요."}</Empty>}
      <div className="grid gap-3 md:grid-cols-2">
        {shown.map((e) => {
          const b = budgets[e.id];
          const stats = b ? [b.bep_budget != null && `손익분기점 ${b.bep_budget}개`, b.target_qty != null && `목표 ${b.target_qty}개`, `준비 ${b.prepared_total}개`].filter(Boolean).join(" · ") : "";
          return (
            <div key={e.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <span className="inline-block rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-700">{phaseLabel(e)}</span>
              <p className="mt-3 text-2xl font-bold">{e.name}</p>
              <p className="mt-2 text-sm text-neutral-500">{[fmtRange(e.start_date, e.end_date), e.location].filter(Boolean).join(" · ")}</p>
              <hr className="my-3 border-neutral-200" />
              {stats && <p className="text-sm text-neutral-700">{stats}</p>}
              <p className="mt-1 text-sm text-neutral-700">준비 체크리스트 {e.checklist_done} / {e.checklist_total} 완료</p>
              <Link href={`/events/${e.id}`} className="mt-3 inline-flex h-11 w-[200px] items-center rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white">행사 열기 ↗</Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
