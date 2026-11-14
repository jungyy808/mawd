// 행사 상세 공통 틀 (헤더 + 탭). useParams/usePathname 때문에 Suspense 필요 (Next 16)
import { Suspense } from "react";
import EventShell from "@/components/events/EventShell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <EventShell>{children}</EventShell>
    </Suspense>
  );
}
