"use client";
// 행사 상세 공통 틀: 헤더(단계·행사명) + 탭 7개 (Figma 03 · 행사 상세)
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { type EventOut, api, fmtRange, phaseLabel } from "@/components/events/api";
import { ErrorBox, Spinner } from "@/components/events/ui";

type Ctx = { ev: EventOut; reload: () => Promise<void>; patch: (b: Partial<EventOut>) => Promise<void> };
const EventCtx = createContext<Ctx | null>(null);
export function useEvent(): Ctx {
  const c = useContext(EventCtx);
  if (!c) throw new Error("useEvent must be used inside EventShell");
  return c;
}

const TABS = [
  { seg: "", label: "개요" },
  { seg: "budget", label: "예산·손익" },
  { seg: "stock", label: "상품 관리", also: ["products"] },
  { seg: "schedule", label: "일정 캘린더" },
  { seg: "promo", label: "홍보·광고" },
  { seg: "customers", label: "고객 관리" },
  { seg: "report", label: "성과·리포트" },
];

export default function EventShell({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const [ev, setEv] = useState<EventOut | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try { setEv(await api<EventOut>(`/api/events/${id}`)); }
    catch (e) { setError((e as Error).message); }
  }, [id]);
  useEffect(() => { reload(); }, [reload]);
  const patch = useCallback(async (b: Partial<EventOut>) => {
    setEv(await api<EventOut>(`/api/events/${id}`, { method: "PATCH", json: b }));
  }, [id]);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!ev) return <Spinner text="행사를 불러오는 중" />;

  const base = `/events/${id}`;
  const current = pathname.slice(base.length).split("/")[1] ?? "";

  // 판매 상품 설정은 행사 생성의 한 단계라 행사 헤더·탭 없이 화면만 보여 준다 (Figma 20:3486)
  if (current === "products") {
    return <EventCtx.Provider value={{ ev, reload, patch }}>{children}</EventCtx.Provider>;
  }

  return (
    <EventCtx.Provider value={{ ev, reload, patch }}>
      <div className="mx-auto max-w-[1128px]">
        <Link href="/events" className="block text-sm text-neutral-700">〈 내 행사</Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-neutral-900">{ev.name}</h1>
          <span className="rounded-full bg-[#6d53f1] px-4 py-1 text-sm font-semibold text-white">{phaseLabel(ev).replace("준비 중 · ", "")}</span>
        </div>
        <p className="mt-2 mb-0 text-sm text-neutral-500 md:mb-6">
          {[fmtRange(ev.start_date, ev.end_date), ev.location].filter(Boolean).join(" · ")}
        </p>
        <nav className="mt-4 mb-5 grid grid-cols-4 gap-1.5 md:hidden">
          {TABS.map((t) => {
            const active = current === t.seg || (t.also?.includes(current) ?? false);
            return (
              <Link
                key={t.label}
                href={t.seg ? `${base}/${t.seg}` : base}
                className={`flex h-10 items-center justify-center rounded-lg border text-[13px] font-medium whitespace-nowrap ${
                  active ? "border-[#6d53f1] bg-[#6d53f1] text-white" : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </div>
    </EventCtx.Provider>
  );
}
