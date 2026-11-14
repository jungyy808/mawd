import Link from "next/link";
import { Suspense } from "react";
import ServiceNav, { ServiceNavFallback } from "./ServiceNav";

// Figma "서비스 메뉴": 로고 + (홈 · 설정). 높이 54px, 아래 1px 구분선.
// 로그인·온보딩처럼 메뉴가 없는 화면(Figma "인증 상단")은 showNav={false}로 쓴다.
export default function ServiceMenu({ showNav = true }: { showNav?: boolean }) {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-[54px] w-full max-w-[1180px] items-center gap-3 p-4">
        <Link
          href="/home"
          className="shrink-0 text-base leading-normal font-bold whitespace-nowrap text-ink"
        >
          AI 마케터
        </Link>
        <div className="flex-1" />
        {showNav && (
          // usePathname은 동적 경로(events/[id] 등)에서 프리렌더 때 멈추므로 Suspense로 감싼다.
          <Suspense fallback={<ServiceNavFallback />}>
            <ServiceNav />
          </Suspense>
        )}
      </div>
    </header>
  );
}
