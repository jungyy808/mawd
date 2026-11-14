"use client";
// Figma 37.1 광고·콘텐츠 (행사 홍보·광고 탭)
import Link from "next/link";
import DraftCard from "@/components/ads/DraftCard";
import NaverConnect from "@/components/ads/NaverConnect";
import Generated from "@/components/ads/Generated";
import { publicOrigin } from "@/components/events/api";
import { useEvent } from "@/components/events/EventShell";
import { Card, CopyButton } from "@/components/events/ui";

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
      <NaverConnect />
      <div className="grid gap-3 md:grid-cols-4">
        <LinkCard href={`/events/${ev.id}/promo/content`} title="블로그·인스타 게시물 만들기" desc="행사·상품 정보로 글과 캡션을 AI로 작성" />
        <LinkCard href="/ads/naver" title="네이버 파워링크 성과" desc="계정 연결·최근 7일 성과" />
        <LinkCard href="/ads/demo?p=meta" title="메타 광고 데모" desc="인스타그램 광고 미리보기" />
        <LinkCard href="/ads/demo?p=daangn" title="당근 광고 데모" desc="동네 광고 미리보기" />
      </div>
      <DraftCard eventId={ev.id} />
      <Generated eventId={ev.id} />
      <Card title="광고·콘텐츠 연결 URL">
        <p className="text-sm text-neutral-600">광고와 블로그·인스타 링크는 이 행사의 방문객 안내 페이지로 연결하세요. 공개 설정은 고객 탭에서 할 수 있어요.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[#6d53f1]/5 p-3">
          <span className="min-w-0 flex-1 break-all text-sm font-medium text-[#6d53f1]">{publicOrigin()}/e/{ev.id}</span>
          <CopyButton text={`${publicOrigin()}/e/${ev.id}`} label="복사" />
          <a className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-neutral-200" href={`/e/${ev.id}`} target="_blank" rel="noreferrer">열어보기 ↗</a>
        </div>
      </Card>
    </div>
  );
}
