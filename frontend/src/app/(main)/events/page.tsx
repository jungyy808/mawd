"use client";
// Figma 디자인 · 내 행사 (BOOTHY)
import Link from "next/link";
import { useEffect, useState } from "react";
import { type BudgetOut, type EventOut, type Phase, api, fmtRange, phaseLabel, phaseOf } from "@/components/events/api";
import { Empty, ErrorBox, Spinner } from "@/components/events/ui";

const FILTERS: ("전체" | Phase)[] = ["전체", "준비 중", "운영 중", "종료"];
const PURPLE = "#6d53f1";

function Calendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export default function MyEventsPage() {
  const [events, setEvents] = useState<EventOut[] | null>(null);
  const [budgets, setBudgets] = useState<Record<string, BudgetOut>>({});
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("전체");
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);

  const show = (evs: EventOut[]) => {
    setEvents(evs);
    evs.forEach((e) => api<BudgetOut>(`/api/events/${e.id}/budget`).then((b) => setBudgets((m) => ({ ...m, [e.id]: b }))).catch(() => {}));
  };
  const load = () => {
    setError("");
    api<EventOut[]>("/api/events").then(show).catch((e) => setError(e.message));
  };
  // 서버가 예시 행사 3개(준비 중·운영 중·종료)를 저장하고 전체 목록을 돌려준다.
  const loadSample = () => {
    setSeeding(true);
    setError("");
    api<EventOut[]>("/api/events/sample", { method: "POST" })
      .then(show)
      .catch((e) => setError(e.message))
      .finally(() => setSeeding(false));
  };
  useEffect(load, []);

  const shown = (events ?? []).filter((e) => filter === "전체" || phaseOf(e) === filter);

  return (
    <div className="mx-auto max-w-[1128px]">
      <h1 className="text-3xl font-bold text-black">내 행사</h1>
      <p className="mt-2 text-base text-[#55545e]">진행할 행사를 선택해 준비와 홍보 업무를 관리하세요</p>

      <Link href="/events/new" className="mt-10 inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white" style={{ background: PURPLE }}>
        <span className="text-xl leading-none">＋</span> 행사 생성
      </Link>
      <hr className="mt-6 border-[#6d53f1]/30" />

      <div className="mt-4 mb-6 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1 text-xs font-medium text-white ${filter === f ? "" : "bg-[#c9c7d6] hover:bg-[#b5b2c6]"}`}
            style={filter === f ? { background: PURPLE } : undefined}
          >
            {f}
          </button>
        ))}
      </div>

      {error && <ErrorBox message={error} onRetry={load} />}
      {!events && !error && <Spinner text="행사를 불러오는 중" />}
      {events && shown.length === 0 && (
        <Empty>
          {events.length ? "이 단계의 행사가 없어요." : "아직 등록된 행사가 없어요. 행사 생성으로 시작하세요."}
          {events.length === 0 && (
            <button onClick={loadSample} disabled={seeding} className="mx-auto mt-4 block rounded-lg border border-[#6d53f1] px-4 py-2 text-sm font-semibold text-[#6d53f1] hover:bg-[#6d53f1]/10 disabled:opacity-40">
              {seeding ? "불러오는 중…" : "예시 행사로 둘러보기"}
            </button>
          )}
        </Empty>
      )}

      <div className="space-y-5">
        {shown.map((e) => {
          const b = budgets[e.id];
          const label = phaseLabel(e);
          const pill = label.startsWith("준비 중 · ") ? label.replace("준비 중 · ", "") : label;
          const stats = b
            ? [b.bep_budget != null && `손익분기점 ${b.bep_budget}개`, b.target_qty != null && `목표 ${b.target_qty}개`, `준비 ${b.prepared_total}개`].filter(Boolean).join(" · ")
            : "";
          return (
            <div key={e.id} className="rounded-2xl bg-white px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <span className="inline-block rounded-full px-4 py-1 text-sm font-semibold text-white" style={{ background: phaseOf(e) === "종료" ? "#9998a4" : PURPLE }}>
                {pill}
              </span>
              <p className="mt-3 text-xl font-bold text-black">{e.name}</p>
              <div className="mt-2 flex flex-wrap gap-x-12 gap-y-1 px-3 text-sm text-[#55545e]">
                <span>{fmtRange(e.start_date, e.end_date) || "날짜 미정"}</span>
                <span>{e.location || "장소 미정"}</span>
              </div>
              <hr className="mt-2 border-[#6d53f1]/30" />
              <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1 px-3 text-sm text-[#55545e]">
                  <p className="flex items-center gap-2 text-black"><Calendar /> 준비 체크리스트 {e.checklist_done} / {e.checklist_total} 완료</p>
                  {stats && <p>{stats}</p>}
                </div>
                <Link href={`/events/${e.id}`} className="inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white" style={{ background: PURPLE }}>
                  <span aria-hidden>↗</span> 행사 바로가기
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
