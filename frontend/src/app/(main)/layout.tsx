import { Suspense } from "react";
import ServiceMenu from "@/components/nav/ServiceMenu";
import SideNav from "@/components/nav/SideNav";

// 왼쪽 사이드 메뉴(Figma BOOTHY, 232px) + 본문. 본문은 최대 1180px, 여백 26px (모바일 16px).
// 좁은 화면(md 미만)에서는 사이드 메뉴를 숨기고 기존 상단 메뉴를 쓴다.
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="md:hidden">
        <ServiceMenu />
      </div>
      <div className="flex flex-1">
        {/* usePathname은 동적 경로(events/[id] 등)에서 프리렌더 때 멈추므로 Suspense로 감싼다. */}
        <Suspense fallback={<div className="hidden w-[232px] shrink-0 bg-white md:block" />}>
          <SideNav />
        </Suspense>
        <main className="min-w-0 flex-1 p-4 sm:p-[26px]">
          <div className="mx-auto w-full max-w-[1180px]">{children}</div>
        </main>
      </div>
    </>
  );
}
