"use client";
// Figma "BOOTHY" 사이드 메뉴 (node 20:7654): 로고 + 행사 선택 + 메뉴 8개. 폭 232px.
// 색: 보라 #6d53f1 (로고·선택된 메뉴), 회색 #9998a4 (선택 안 된 행사 이름).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, type EventOut } from "@/components/events/api";
// Figma에서 받은 아이콘 원본 (src/assets/nav). import하면 { src, width, height }가 들어온다.
import homeIcon from "@/assets/nav/home.svg";
import eventsIcon from "@/assets/nav/events.svg";
import budgetIcon from "@/assets/nav/budget.svg";
import productsIcon from "@/assets/nav/products.svg";
import operationsIcon from "@/assets/nav/operations.svg";
import promoIcon from "@/assets/nav/promo.svg";
import customersIcon from "@/assets/nav/customers.svg";
import reportIcon from "@/assets/nav/report.svg";
import chevronIcon from "@/assets/nav/chevron.svg";

// seg가 있는 메뉴는 "지금 보는 행사"의 탭으로 연결된다 (/events/{id}/{seg}).
// 행사가 하나도 없으면 행사 생성으로 보낸다.
const ITEMS: { label: string; icon: { src: string }; href?: string; seg?: string; also?: string[] }[] = [
  { label: "내 행사", icon: eventsIcon, href: "/events" },
  { label: "행사 개요", icon: homeIcon, href: "/home" },
  { label: "예산 손익", icon: budgetIcon, seg: "budget" },
  { label: "상품 관리", icon: productsIcon, seg: "stock", also: ["products"] },
  { label: "운영", icon: operationsIcon, seg: "schedule" },
  { label: "홍보", icon: promoIcon, seg: "promo" },
  { label: "고객", icon: customersIcon, seg: "customers" },
  { label: "리포트", icon: reportIcon, seg: "report" },
];

const PICK_KEY = "mawd_current_event"; // 사이드바에서 고른 행사 (행사 화면 밖에서도 유지)
function readPick(): string | null {
  try { return localStorage.getItem(PICK_KEY); } catch { return null; }
}
function savePick(id: string) {
  try { localStorage.setItem(PICK_KEY, id); } catch {}
}

// 지금 행사: 행사 화면이면 그 행사 → 사이드바에서 고른 행사 → 끝나지 않은 첫 행사.
function pickCurrent(events: EventOut[] | null, pathname: string, picked: string | null): EventOut | undefined {
  if (!events) return undefined;
  return (
    events.find((e) => pathname === `/events/${e.id}` || pathname.startsWith(`/events/${e.id}/`)) ??
    events.find((e) => e.id === picked) ??
    events.find((e) => e.status !== "done") ??
    events[0]
  );
}

export default function SideNav() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [events, setEvents] = useState<EventOut[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => { setPicked(readPick()); }, []);
  useEffect(() => {
    let alive = true;
    api<EventOut[]>("/api/events")
      .then((list) => alive && setEvents(list))
      .catch(() => alive && setEvents([]));
    return () => {
      alive = false;
    };
    // 새 행사를 만들거나 지웠을 때 목록이 바뀌도록 경로가 바뀔 때마다 다시 불러온다.
  }, [pathname]);

  const current = pickCurrent(events, pathname, picked);
  const base = current ? `/events/${current.id}` : "";
  // 행사 안에서 지금 보고 있는 탭 (예: /events/ev_1/budget → "budget", 개요면 "")
  const tab = base && (pathname === base || pathname.startsWith(`${base}/`)) ? (pathname.slice(base.length).split("/")[1] ?? "") : null;

  // 행사를 고르면: 행사 화면을 보고 있었으면 같은 메뉴로, 아니면 화면은 그대로 두고 선택만 바꾼다.
  const choose = (id: string) => {
    savePick(id);
    setPicked(id);
    if (tab !== null) router.push(tab ? `/events/${id}/${tab === "products" ? "stock" : tab}` : `/events/${id}`);
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 overflow-y-auto bg-white pt-[34px] pb-6 md:block">
      <Link href="/home" className="ml-[33px] block w-fit text-2xl leading-normal font-bold text-[#6d53f1]">
        BOOTHY
      </Link>
      <EventSwitcher events={events} current={current} onChoose={choose} />
      <nav aria-label="서비스 메뉴" className="mt-[27px] mr-[17px] ml-[21px] flex flex-col gap-[27px]">
        {ITEMS.map(({ label, icon, href: fixed, seg, also }) => {
          const href = seg ? (current ? `${base}/${seg}` : events ? "/events/new" : undefined) : fixed;
          const active = seg
            ? tab === seg || (!!also && tab !== null && also.includes(tab))
            : fixed === "/events"
              ? pathname === "/events" || pathname.startsWith("/events/new") || tab === ""
              : !!fixed && (pathname === fixed || pathname.startsWith(`${fixed}/`));
          const cls = `flex h-11 items-center rounded-[7px] pl-3 text-base leading-normal ${
            active ? "bg-[#6d53f1] font-semibold text-white" : "font-medium text-black"
          } ${href && !active ? "hover:bg-[#6d53f1]/10" : ""}`;
          const inner = (
            <>
              <span className="flex w-6 shrink-0 justify-center">
                {/* Figma에서 받은 아이콘 그대로. 색만 필터로 바꾼다 (선택: 흰색, 나머지: 검정). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={icon.src} alt="" className={active ? "brightness-0 invert" : "brightness-0"} />
              </span>
              <span className="ml-[17px] whitespace-nowrap">{label}</span>
            </>
          );
          return href ? (
            <Link key={label} href={href} aria-current={active ? "page" : undefined} className={cls}>
              {inner}
            </Link>
          ) : (
            <span key={label} aria-disabled="true" className={`${cls} cursor-default`}>
              {inner}
            </span>
          );
        })}
      </nav>
    </aside>
  );
}

// 행사 선택 상자 (Figma: 행사 선택): 지금 행사 이름을 누르면 목록이 열리고, 고르면 그 행사로 바뀐다.
function EventSwitcher({ events, current, onChoose }: { events: EventOut[] | null; current: EventOut | undefined; onChoose: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!events) return <div className="mt-[27px] mr-[17px] ml-[21px] h-[51px] rounded-[7px] bg-[#6d53f1]/10" />;
  if (!current) {
    return (
      <Link href="/events/new" className="mt-[27px] mr-[17px] ml-[21px] block rounded-[7px] bg-[#6d53f1]/10 px-[18px] py-[14px] font-semibold text-black">
        ＋ 첫 행사 등록하기
      </Link>
    );
  }
  const others = events.filter((e) => e.id !== current.id);

  return (
    <div ref={box} className="relative mt-[27px] mr-[17px] ml-[21px] text-base leading-normal">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="행사 선택"
        className="flex w-full items-center gap-2 rounded-[7px] bg-[#6d53f1]/10 py-[12px] pr-[13px] pl-[18px] text-left hover:bg-[#6d53f1]/15"
      >
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-black">{current.name}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <span className={`flex shrink-0 transition ${open ? "rotate-180" : ""}`}>
          <img src={chevronIcon.src} alt="" className="rotate-90 -scale-x-100" />
        </span>
      </button>
      {open && (
        <ul role="listbox" className="absolute top-full right-0 left-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-[7px] border border-neutral-200 bg-white py-1 shadow-lg">
          <li role="option" aria-selected="true" className="flex items-center gap-2 px-4 py-2.5 font-semibold text-[#6d53f1]">
            <span className="min-w-0 flex-1 truncate">{current.name}</span>✓
          </li>
          {others.map((e) => (
            <li key={e.id} role="option" aria-selected="false">
              <button type="button" onClick={() => { onChoose(e.id); setOpen(false); }} className="block w-full truncate px-4 py-2.5 text-left font-medium text-[#55545e] hover:bg-[#6d53f1]/10 hover:text-black">
                {e.name}
              </button>
            </li>
          ))}
          <li className="border-t border-neutral-100">
            <Link href="/events/new" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-black hover:bg-[#6d53f1]/10">
              ＋ 새 행사 만들기
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}
