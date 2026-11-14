"use client";
// Figma: 홈 (node 20:3476). 행사 이름 + D-day, 보라 상자(지금 할 일 · 다가오는 마감), 상품별 카드.
// 데이터는 GET /api/home (지금은 더미, is_sample: true).
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, dLabel } from "@/components/events/api";
import { ErrorBox, Spinner } from "@/components/events/ui";
// Figma에서 받은 원본 (src/assets/home)
import dividerLine from "@/assets/home/divider.svg";
import lineBlue from "@/assets/home/line-blue.svg";
import lineGreen from "@/assets/home/line-green.svg";
import lineOrange from "@/assets/home/line-orange.svg";
import linePink from "@/assets/home/line-pink.svg";
import todoCircle from "@/assets/home/todo-circle.svg";

interface HomeOut {
  event: { id: string; name: string; start_date: string | null; end_date: string | null; d_day: number | null } | null;
  todos: { id: string; title: string; done: boolean }[];
  deadlines: { id: string; title: string; due_date: string | null; d_day: number | null }[];
  products: { id: string; name: string; image_url: string | null; cards: { id: string }[] }[];
  is_sample: boolean;
}

// 상품 열 색 (Figma 순서: 연두 · 분홍 · 주황 · 파랑). 상품이 4개를 넘으면 처음부터 다시 쓴다.
// heights: 상품 사진 카드 아래 빈 카드들의 높이. Figma에 카드 내용이 아직 없어 높이만 따라 했다.
const COLUMNS = [
  { bg: "bg-[#cffa79]", line: lineGreen, heights: [92, 127] },
  { bg: "bg-[#ffcdee]", line: linePink, heights: [125, 92] },
  { bg: "bg-[#f7ac88]", line: lineOrange, heights: [149, 67] },
  { bg: "bg-[#bac7eb]", line: lineBlue, heights: [110, 127] },
];

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

  const { event, todos, deadlines, products } = home;

  return (
    // 본문 여백(26px)에 더해 Figma 위치(사이드 메뉴에서 51px, 위에서 46px)에 맞춘다.
    <div className="sm:px-[25px] sm:pt-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:pl-2">
        <h1 className="text-[32px] leading-normal font-bold text-black">{event ? event.name : "홈"}</h1>
        {event && event.d_day !== null && (
          <span className="rounded-[44px] bg-[#6d53f1] px-5 py-[5px] text-2xl leading-normal font-bold whitespace-nowrap text-white">
            {dLabel(event.d_day)}
          </span>
        )}
      </div>

      {!event && (
        <p className="mt-4 text-sm text-sub">
          아직 등록된 행사가 없어요.{" "}
          <Link href="/events/new" className="font-medium text-[#6d53f1] underline">
            첫 행사 등록하기
          </Link>
        </p>
      )}

      <section className="mt-[14px] flex flex-col gap-8 rounded-[20px] bg-[#6d53f1] px-[35px] pt-[29px] pb-[40px] text-white md:min-h-[275px] md:flex-row md:gap-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl leading-normal font-bold">지금 할 일</h2>
          {todos.length === 0 ? (
            <p className="mt-[33px] text-base font-medium opacity-80">지금 할 일이 없어요.</p>
          ) : (
            <ul className="mt-[33px] flex flex-col gap-5">
              {todos.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={!!done[t.id]}
                    onClick={() => setDone((d) => ({ ...d, [t.id]: !d[t.id] }))}
                    className="flex items-center gap-[13px] text-left text-base leading-normal font-medium"
                  >
                    {/* 흰 동그라미는 그대로 두고, 체크하면 안에 보라색 작은 원을 띄운다 */}
                    <span className="relative flex shrink-0 items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={todoCircle.src} alt="" />
                      {done[t.id] && <span className="absolute size-[10px] rounded-full bg-[#6d53f1]" />}
                    </span>
                    <span className={done[t.id] ? "line-through opacity-60" : ""}>{t.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 가운데 세로 선: 가로 선 원본을 90도 돌려 쓴다 (Figma와 같은 방식) */}
        <div className="hidden w-0 items-center justify-center self-stretch pt-[46px] md:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dividerLine.src} alt="" className="max-w-none rotate-90" />
        </div>

        <div className="min-w-0 flex-1 md:pl-[30px]">
          <h2 className="text-2xl leading-normal font-bold">다가오는 마감</h2>
          {deadlines.length === 0 ? (
            <p className="mt-[33px] text-base font-medium opacity-80">다가오는 마감이 없어요.</p>
          ) : (
            <ul className="mt-[33px] flex flex-col gap-5 text-base leading-normal font-medium md:pl-[5px]">
              {deadlines.map((d) => (
                <li key={d.id} className="flex">
                  <span className="w-[74px] shrink-0 whitespace-nowrap">{dLabel(d.d_day)}</span>
                  <span className="min-w-0">{d.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-11 grid grid-cols-2 gap-x-[50px] gap-y-10 lg:grid-cols-4">
        {products.map((p, i) => {
          const col = COLUMNS[i % COLUMNS.length];
          const bar = (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={col.line.src} alt="" className="absolute bottom-[12px] left-1/2 -translate-x-1/2" />
          );
          return (
            <div key={p.id} className="min-w-0">
              <h2 className="truncate text-xl leading-normal font-semibold text-black">{p.name}</h2>
              <div className="mt-[18px] flex flex-col gap-5">
                {/* 첫 카드: 위는 상품 사진 자리(회색), 아래는 열 색 */}
                <div className={`relative h-[250px] overflow-hidden rounded-[15px] ${col.bg}`}>
                  <div
                    className="h-[163px] bg-[#e4e4e4] bg-cover bg-center"
                    style={p.image_url ? { backgroundImage: `url(${p.image_url})` } : undefined}
                  />
                  {bar}
                </div>
                {p.cards.map((c, n) => (
                  <div
                    key={c.id}
                    className={`relative rounded-[15px] ${col.bg}`}
                    style={{ height: col.heights[n % col.heights.length] }}
                  >
                    {bar}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
