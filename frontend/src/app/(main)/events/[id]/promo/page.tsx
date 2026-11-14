"use client";
// Figma 37.1 광고·콘텐츠 (행사 홍보·광고 탭)
import Link from "next/link";
import DraftCard from "@/components/ads/DraftCard";
import { useEvent } from "@/components/events/EventShell";
import { Card } from "@/components/events/ui";

function LinkCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="block rounded-xl border border-neutral-200 bg-white p-4 hover:border-neutral-400">
      <p className="font-semibold">{title} ↗</p>
      <p className="mt-1 text-sm text-neutral-500">{desc}</p>
    </Link>
  );
}

export default function PromoPage() {
  const { ev } = useEvent();
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <LinkCard href="/content" title="행사 콘텐츠" desc="블로그·인스타 원고를 AI로 작성" />
        <LinkCard href="/ads/naver" title="네이버 파워링크 성과" desc="계정 연결·최근 7일 성과" />
        <LinkCard href="/ads/demo?p=meta" title="메타 광고 데모" desc="인스타그램 광고 미리보기" />
        <LinkCard href="/ads/demo?p=daangn" title="당근 광고 데모" desc="동네 광고 미리보기" />
      </div>
      <DraftCard eventId={ev.id} />
      <Card title="광고 연결 URL">
        <p className="text-sm text-neutral-600">광고와 콘텐츠의 링크는 이 행사의 방문객 안내 페이지로 연결하세요. 공개 설정은 고객 관리 탭에서 할 수 있어요.</p>
        <p className="mt-2 break-all text-sm font-medium">/e/{ev.id}</p>
      </Card>
    </div>
  );
}
