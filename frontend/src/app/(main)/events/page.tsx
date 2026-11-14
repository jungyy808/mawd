"use client";
// Figma: EVT / 행사 > 행사 목록
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type EventOut, STATUS_LABEL, TYPE_LABEL, dLabel, fmtRange } from "@/components/events/api";
import { Badge, Button, Empty, ErrorBox, PageHeader, Spinner } from "@/components/events/ui";

export default function EventListPage() {
  const [events, setEvents] = useState<EventOut[] | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    api<EventOut[]>("/api/events").then(setEvents).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const upcoming = events?.filter((e) => e.status !== "done") ?? [];
  const done = events?.filter((e) => e.status === "done") ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumb="EVT / 행사"
        title="행사"
        desc="팝업·부스의 준비 현황과 홍보 일정을 확인합니다."
        action={<Button href="/events/new">＋ 행사 생성</Button>}
      />
      {error && <ErrorBox message={error} onRetry={load} />}
      {!events && !error && <Spinner text="행사를 불러오는 중" />}
      {events && events.length === 0 && (
        <Empty>
          아직 등록된 행사가 없어요.
          <div className="mt-4">
            <Button href="/events/new">첫 행사 등록하기</Button>
          </div>
        </Empty>
      )}
      {upcoming.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-neutral-500">다가오는 행사</h2>
          <div className="grid gap-3 md:grid-cols-2">{upcoming.map((e) => <EventCard key={e.id} e={e} />)}</div>
        </>
      )}
      {done.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold text-neutral-500">지난 행사</h2>
          <div className="grid gap-3 md:grid-cols-2">{done.map((e) => <EventCard key={e.id} e={e} />)}</div>
        </>
      )}
    </div>
  );
}

function EventCard({ e }: { e: EventOut }) {
  const progress = e.checklist_total ? Math.round((e.checklist_done / e.checklist_total) * 100) : 0;
  return (
    <Link href={`/events/${e.id}`} className="block rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-400">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-neutral-900">{e.name}</p>
          <p className="mt-1 text-sm text-neutral-500">
            {fmtRange(e.start_date, e.end_date)} · {e.location || "장소 미정"}
          </p>
        </div>
        {e.d_day !== null && e.d_day >= 0 && <Badge tone="blue">{dLabel(e.d_day)}</Badge>}
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
        <Badge>{TYPE_LABEL[e.type]}</Badge>
        <Badge tone={e.status === "preparing" ? "amber" : e.status === "done" ? "green" : "gray"}>{STATUS_LABEL[e.status]}</Badge>
        <span className="ml-auto">
          준비 {e.checklist_done} / {e.checklist_total} 완료
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full bg-neutral-900" style={{ width: `${progress}%` }} />
      </div>
    </Link>
  );
}
