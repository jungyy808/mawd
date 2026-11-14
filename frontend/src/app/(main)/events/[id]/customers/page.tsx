"use client";
// Figma 37.5 문의 관리(기본 진입) · 이메일 발송 · 부스 QR·구독
import { useState } from "react";
import { EmailSend, Inquiries } from "@/components/events/Crm";
import { useEvent } from "@/components/events/EventShell";
import { VisitorPage } from "@/components/events/sections";

const TABS = [["inquiry", "문의 관리"], ["email", "이메일 발송"], ["qr", "부스 QR·구독"]] as const;

export default function CustomersPage() {
  const { ev, patch } = useEvent();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("inquiry");
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === k ? "bg-[#6d53f1] text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}>{l}</button>
        ))}
      </div>
      {tab === "inquiry" && <Inquiries ev={ev} />}
      {tab === "email" && <EmailSend ev={ev} />}
      {tab === "qr" && <VisitorPage ev={ev} patch={patch} />}
    </div>
  );
}
