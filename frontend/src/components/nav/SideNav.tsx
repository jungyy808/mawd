"use client";
// Figma "BOOTHY" 사이드 메뉴 (node 20:7654): 로고 + 행사 선택 + 메뉴 8개. 폭 232px.
// 색: 보라 #6d53f1 (로고·선택된 메뉴), 회색 #9998a4 (선택 안 된 행사 이름).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  { label: "홈", icon: homeIcon, href: "/home" },
  { label: "내 행사", icon: eventsIcon, href: "/events" },
  { label: "예산 손익", icon: budgetIcon, seg: "budget" },
  { label: "상품 관리", icon: productsIcon, seg: "stock", also: ["products"] },
  { label: "운영", icon: operationsIcon, seg: "schedule" },
  { label: "홍보", icon: promoIcon, seg: "promo" },
  { label: "고객", icon: customersIcon, seg: "customers" },
  { label: "리포트", icon: reportIcon, seg: "report" },
];

// 지금 보는 행사: 행사 화면이면 그 행사, 아니면 끝나지 않은 첫 행사.
function pickCurrent(events: EventOut[] | null, pathname: string): EventOut | undefined {
  if (!events) return undefined;
  return events.find((e) => pathname.startsWith(`/events/${e.id}`)) ?? events.find((e) => e.status !== "done") ?? events[0];
}

export default function SideNav() {
  const pathname = usePathname() ?? "";
  const [events, setEvents] = useState<EventOut[] | null>(null);

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

  const current = pickCurrent(events, pathname);
  const base = current ? `/events/${current.id}` : "";
  // 행사 안에서 지금 보고 있는 탭 (예: /events/ev_1/budget → "budget", 개요면 "")
  const tab = base && pathname.startsWith(base) ? (pathname.slice(base.length).split("/")[1] ?? "") : null;

  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 overflow-y-auto bg-white pt-[34px] pb-6 md:block">
      <Link href="/home" className="ml-[33px] block w-fit text-2xl leading-normal font-bold text-[#6d53f1]">
        BOOTHY
      </Link>
      <EventSwitcher events={events} current={current} />
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

// 행사 선택 상자: 맨 위가 지금 보는 행사, 아래는 다른 행사. 화살표로 접고 편다.
function EventSwitcher({ events, current }: { events: EventOut[] | null; current: EventOut | undefined }) {
  const [open, setOpen] = useState(true);

  if (!events) return <div className="mt-[27px] mr-[17px] ml-[21px] h-[51px] rounded-[7px] bg-[#6d53f1]/10" />;
  const others = events.filter((e) => e.id !== current?.id);

  return (
    <div className="mt-[27px] mr-[17px] ml-[21px] rounded-[7px] bg-[#6d53f1]/10 pt-[14px] pr-[13px] pb-[15px] pl-[18px] text-base leading-normal">
      {current ? (
        <div className="flex items-center gap-2">
          <Link href={`/events/${current.id}`} className="min-w-0 flex-1 truncate font-semibold text-black">
            {current.name}
          </Link>
          {others.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label="다른 행사 목록"
              className="flex h-5 w-5 shrink-0 items-center justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={chevronIcon.src} alt="" className={open ? "rotate-90 -scale-x-100" : "rotate-180"} />
            </button>
          )}
        </div>
      ) : (
        <Link href="/events/new" className="block font-semibold text-black">
          ＋ 첫 행사 등록하기
        </Link>
      )}
      {open && others.length > 0 && (
        <ul className="mt-[22px] flex flex-col gap-[14px] font-medium text-[#9998a4]">
          {others.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className="block truncate hover:text-black">
                {e.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
