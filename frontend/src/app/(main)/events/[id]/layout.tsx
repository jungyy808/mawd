// useParams()를 Suspense 안에서 쓰기 위한 래퍼 (Next 16 요구사항)
import { Suspense } from "react";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
