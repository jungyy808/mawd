"use client";
// Figma 37.5 문의 관리(기본 진입) · 이메일 발송 · 부스 QR·구독(인쇄 미리보기) · 고객 관리 API 연동
import { useEffect, useState } from "react";
import { ApiStatus, EmailSend, Inquiries, QrPrint } from "@/components/events/Crm";
import { api } from "@/components/events/api";
import { useEvent } from "@/components/events/EventShell";
import { VisitorPage } from "@/components/events/sections";
import { Button } from "@/components/events/ui";

const TABS = [["inquiry", "문의 관리"], ["email", "이메일 발송"], ["qr", "부스 QR·구독"], ["api", "연결 서비스"]] as const;
type Tab = (typeof TABS)[number][0];

export default function CustomersPage() {
  const { ev, patch } = useEvent();
  const [tab, setTab] = useState<Tab>("inquiry");
  const [printing, setPrinting] = useState(false);
  const [brand, setBrand] = useState("");
  useEffect(() => { api<{ store: { name: string } }>("/api/stores/me").then((r) => setBrand(r.store.name)).catch(() => {}); }, []);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === k ? "bg-[#6d53f1] text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}>{l}</button>
        ))}
      </div>
      {tab === "inquiry" && <Inquiries ev={ev} />}
      {tab === "email" && <EmailSend ev={ev} />}
      {tab === "qr" && (
        <div className="space-y-3">
          <div className="flex justify-end"><Button onClick={() => setPrinting(true)}>부스 QR 인쇄 미리보기</Button></div>
          <VisitorPage ev={ev} patch={patch} />
        </div>
      )}
      {tab === "api" && <ApiStatus onGo={setTab} />}
      {printing && <QrPrint ev={ev} brand={brand || "내 브랜드"} onClose={() => setPrinting(false)} />}
    </div>
  );
}
