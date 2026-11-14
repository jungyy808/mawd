"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/home", label: "홈" },
  { href: "/settings", label: "설정" },
];

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="서비스 메뉴" className="flex shrink-0 items-center gap-3">
      {ITEMS.map(({ href, label }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-[37px] w-[57px] items-center justify-center rounded-md text-[13px] leading-normal font-medium whitespace-nowrap sm:w-[75px] ${
              active ? "bg-ink text-white" : "bg-chip text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// 행사 화면처럼 홈·설정이 아닌 곳에서는 둘 다 선택 안 된 상태 (Figma 03 · 행사 상세).
export default function ServiceNav() {
  return <NavLinks pathname={usePathname()} />;
}

// 경로를 아직 모를 때: 둘 다 선택 안 된 상태로 자리만 잡는다.
export function ServiceNavFallback() {
  return <NavLinks pathname={null} />;
}
