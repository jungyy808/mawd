"use client";
// Figma 45 · 전체 고객: 행사별 구독 현황 → 선택한 행사의 고객 관리로 이동
import Link from "next/link";
import { useEffect, useState } from "react";
import { type EventOut, api, fmtRange } from "@/components/events/api";
import { Empty, ErrorBox, Spinner } from "@/components/events/ui";

export default function AllCustomersPage() {
  const [events, setEvents] = useState<EventOut[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<EventOut[]>("/api/events").then(setEvents).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-[1128px]">
      <Link href="/settings" className="text-sm text-[#55545e] hover:underline">〈 설정</Link>
      <h1 className="mt-2 text-3xl font-bold text-black">전체 고객</h1>
      <p className="mt-2 text-base text-[#55545e]">행사별로 모은 구독 고객과 방문객 안내 페이지 상태를 확인해요.</p>
      {error && <div className="mt-6"><ErrorBox message={error} /></div>}
      {!events && !error && <Spinner text="불러오는 중" />}
      {events && events.length === 0 && <div className="mt-6"><Empty>아직 행사가 없어요.</Empty></div>}

      {events && events.length > 0 && (
        <section className="mt-6 rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <h2 className="text-lg font-bold text-black">행사별 구독 현황</h2>
          <ul className="mt-3 divide-y divide-neutral-100">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-semibold text-black">{e.name}</p>
                  <p className="mt-0.5 text-sm text-[#55545e]">
                    {fmtRange(e.start_date, e.end_date) || "날짜 미정"} ·{" "}
                    {e.subscribe_url ? "스티비 구독 폼 연결됨" : "구독 폼 미등록"} ·{" "}
                    {e.is_public ? "안내 페이지 공개 중" : "안내 페이지 비공개"}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-400">구독자 수는 스티비 연동 후 주소록 기준으로 표시돼요.</p>
                </div>
                <Link href={`/events/${e.id}/customers`} className="text-sm font-semibold text-[#6d53f1] hover:underline">이 행사의 고객 관리 ↗</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
