// 행사 상세 공통 틀 (헤더 + 탭). useParams/usePathname 때문에 Suspense 필요 (Next 16)
import { Suspense } from "react";
import EventShell from "@/components/events/EventShell";

// 행사 화면은 브라우저에서 데이터를 불러오므로 instant navigation 검사를 끈다 (개발 모드 Insight 알림 제거)
export const instant = false;
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <EventShell>{children}</EventShell>
    </Suspense>
  );
}
