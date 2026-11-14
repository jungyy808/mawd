"use client";
// Figma 41 행사 운영 캘린더 · Liner 체크리스트 (캘린더 대신 D-day 순 목록)
import { useEvent } from "@/components/events/EventShell";
import { Checklist } from "@/components/events/sections";
import { Card } from "@/components/events/ui";

export default function SchedulePage() {
  const { ev, reload } = useEvent();
  const rows = [
    ev.apply_deadline && ["참가 신청 마감", ev.apply_deadline],
    ev.load_in_time && ["반입", ev.load_in_time],
    ev.start_date && ["행사 시작", `${ev.start_date}${ev.hours ? ` · ${ev.hours}` : ""}`],
    ev.end_date && ["행사 종료", ev.end_date],
  ].filter(Boolean) as [string, string][];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Checklist id={ev.id} onChange={reload} />
      <Card title="주요 일정">
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">행사 정보에 날짜를 넣으면 여기에 표시돼요.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {rows.map(([k, v]) => (
              <li key={k} className="flex justify-between gap-2"><span className="text-neutral-500">{k}</span><span className="font-medium">{v}</span></li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
