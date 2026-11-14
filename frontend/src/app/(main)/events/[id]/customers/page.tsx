"use client";
// Figma 37.2 CRM 마케팅 · 37.5 문의 관리 · 부스 QR·구독
import { useEvent } from "@/components/events/EventShell";
import { VisitorPage } from "@/components/events/sections";
import { Card } from "@/components/events/ui";

export default function CustomersPage() {
  const { ev, patch } = useEvent();
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <VisitorPage ev={ev} patch={patch} />
      <div className="space-y-4">
        <Card title="문의 응대 · 채널톡">
          <p className="text-sm text-neutral-600">플러그인 키를 넣으면 방문객 안내 페이지에 상담 버튼이 생겨요. 문의 내역은 채널톡 관리자에서 확인합니다.</p>
          <a href="https://desk.channel.io" target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm underline">채널톡 관리자 열기 ↗</a>
        </Card>
        <Card title="구독·후속 이메일 · 스티비">
          <p className="text-sm text-neutral-600">부스 QR로 들어온 방문객이 수신 동의하면 스티비 주소록에 모여요. 행사 후 감사 이메일은 스티비에서 발송합니다.</p>
          <a href="https://stibee.com" target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm underline">스티비 열기 ↗</a>
        </Card>
      </div>
    </div>
  );
}
