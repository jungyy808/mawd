"use client";
// Figma: S06 홈대시보드 (행사 홈). 데이터는 GET /api/home (지금은 더미, is_sample: true).
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type EventStatus, STATUS_LABEL, dLabel } from "@/components/events/api";
import { ErrorBox, Spinner } from "@/components/events/ui";

interface HomeEvent {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  booth_no: string;
  d_day: number | null;
  progress: number; // 0~1
  status: EventStatus;
}
interface HomeTodo {
  id: string;
  title: string;
  due_date: string | null;
  done: boolean;
}
interface HomeCard {
  key: string;
  title: string;
  headline: string;
  rows: { label: string; value: string }[];
  href: string;
}
interface HomeOut {
  event: HomeEvent | null;
  todo_total: number;
  todos: HomeTodo[];
  cards: HomeCard[];
  is_sample: boolean;
}

// "2026-12-20" → "12/20"
const md = (d: string | null) => (d ? d.slice(5, 10).replace("-", "/") : "");

// "12/20~21 · B-17"
function eventMeta(e: HomeEvent) {
  let range = "날짜 미정";
  if (e.start_date) {
    range = md(e.start_date);
    if (e.end_date && e.end_date !== e.start_date) {
      const sameMonth = e.end_date.slice(0, 7) === e.start_date.slice(0, 7);
      range += `~${sameMonth ? e.end_date.slice(8, 10) : md(e.end_date)}`;
    }
  }
  return e.booth_no ? `${range} · ${e.booth_no}` : range;
}

export default function HomePage() {
  const [home, setHome] = useState<HomeOut | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Record<string, boolean>>({});

  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    api<HomeOut>("/api/home")
      .then((h) => {
        if (!alive) return;
        setHome(h);
        setDone(Object.fromEntries(h.todos.map((t) => [t.id, t.done])));
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [reload]);

  const retry = () => {
    setError("");
    setReload((n) => n + 1);
  };

  if (error) return <ErrorBox message={error} onRetry={retry} />;
  if (!home) return <Spinner text="홈을 불러오는 중" />;

  const { event, todos, cards } = home;
  const percent = event ? Math.round(event.progress * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-sub">
            내 행사{event ? ` / ${event.name}` : ""} / 행사 홈
          </p>
          <h1 className="mt-2 flex items-center gap-2 text-[28px] leading-tight font-bold">
            행사 홈
            {home.is_sample && (
              <span className="rounded-md bg-chip px-2 py-0.5 text-xs font-medium text-sub">예시</span>
            )}
          </h1>
          <p className="mt-2 text-sm text-sub">진행 상황과 필요한 업무를 확인하고 카드 위치를 바꿔보세요.</p>
        </div>
        <button
          type="button"
          className="h-[42px] rounded-lg border border-line bg-white px-12 text-sm font-bold"
        >
          대시보드 편집
        </button>
      </div>

      {event ? (
        <section className="flex flex-wrap items-center gap-x-10 gap-y-4 rounded-xl border border-line bg-white px-6 py-5">
          <div>
            <p className="text-base font-medium">{event.name}</p>
            <p className="mt-3 text-[40px] leading-none font-bold">{dLabel(event.d_day) || "일정 미정"}</p>
          </div>
          <div className="min-w-[240px] flex-1">
            <p className="text-xs text-sub">전체 준비 진행률</p>
            <div className="mt-3 flex items-center gap-3">
              <div
                role="progressbar"
                aria-label="전체 준비 진행률"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2.5 flex-1 overflow-hidden rounded-full bg-chip"
              >
                <div className="h-full rounded-full bg-ink" style={{ width: `${percent}%` }} />
              </div>
              <span className="text-sm font-bold">{percent}%</span>
            </div>
          </div>
          <div className="min-w-[200px]">
            <p className="text-xs text-sub">{eventMeta(event)}</p>
            <span className="mt-3 inline-flex h-7 min-w-[104px] items-center justify-center rounded-full bg-chip px-4 text-xs font-medium text-sub">
              {STATUS_LABEL[event.status]}
            </span>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-line bg-white p-10 text-center text-sm text-sub">
          아직 등록된 행사가 없어요.
          <div className="mt-4">
            <Link href="/events/new" className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">
              첫 행사 등록하기
            </Link>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-line bg-white px-6 py-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">지금 확인할 일</h2>
          <span className="inline-flex h-7 min-w-[86px] items-center justify-center rounded-full bg-ink px-4 text-xs font-bold text-white">
            {home.todo_total}건
          </span>
        </div>
        {todos.length === 0 ? (
          <p className="mt-5 text-sm text-sub">지금 확인할 일이 없어요.</p>
        ) : (
          <ul className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-3">
            {todos.map((t) => (
              <li key={t.id}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={!!done[t.id]}
                    onChange={(e) => setDone((d) => ({ ...d, [t.id]: e.target.checked }))}
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-ink"
                  />
                  <span>
                    <span className={`block text-sm font-medium ${done[t.id] ? "text-sub line-through" : ""}`}>
                      {t.title}
                    </span>
                    {t.due_date && <span className="mt-2 block text-[11px] text-sub">마감 {md(t.due_date)}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-bold">내 요약 카드</h2>
          <span className="text-xs text-sub">카드 추가·숨김·순서 편집</span>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <article key={c.key} className="flex min-h-[168px] flex-col rounded-xl border border-line bg-white p-5">
              <div className="flex items-center gap-2.5">
                <CardIcon name={c.key} />
                <h3 className="flex-1 text-[15px] font-bold">{c.title}</h3>
                <DragDots />
              </div>
              <p className="mt-4 border-b border-line pb-3 text-[17px] font-bold">{c.headline}</p>
              <dl className="mt-3 flex flex-col gap-2">
                {c.rows.map((r) => (
                  <div key={r.label} className="flex justify-between text-xs">
                    <dt className="text-sub">{r.label}</dt>
                    <dd className="font-bold">{r.value}</dd>
                  </div>
                ))}
              </dl>
              <Link href={c.href} className="mt-auto self-end pt-2 text-[11px] text-sub hover:text-ink">
                상세 보기 ›
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

// 카드 오른쪽 위 점 6개 (순서 바꾸기 손잡이 자리. 드래그는 아직 없음)
function DragDots() {
  return (
    <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden className="text-sub">
      {[3, 10, 17].map((y) => [3, 11].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
    </svg>
  );
}

const ICONS: Record<string, string> = {
  // 상자
  orders: "M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 0v18M4 7l8 4 8-4",
  // 확성기
  promo: "M4 10v4h3l8 4V6l-8 4H4Zm3 4 1 5h2",
  // 문서
  ai_inbox: "M6 3h9l4 4v14H6V3Zm3 8h7M9 15h7",
  // 달력
  deadlines: "M4 6h16v14H4V6Zm0 4h16M8 3v4M16 3v4",
  // 막대 그래프
  budget: "M4 20h16M7 20v-7M12 20V5M17 20v-10",
  // 격자
  onsite: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z",
};

function CardIcon({ name }: { name: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 text-sub"
    >
      <path d={ICONS[name] ?? ICONS.onsite} />
    </svg>
  );
}
