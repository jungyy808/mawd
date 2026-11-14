"use client";
// Figma: 메타·당근 광고 데모 (샘플 데이터, 연동 없음)
import { useEffect, useState } from "react";
import { api, won } from "@/components/events/api";
import { Badge, Button, Card, ErrorBox, PageHeader, Spinner } from "@/components/events/ui";
import { SummaryTiles } from "@/components/ads/Summary";
import type { DemoCampaign } from "@/components/ads/types";

const TABS = [{ key: "meta", label: "메타 (인스타그램)" }, { key: "daangn", label: "당근" }] as const;

export default function AdsDemoPage() {
  const [p, setP] = useState<"meta" | "daangn">("meta");
  const [demo, setDemo] = useState<DemoCampaign | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("p");
    if (q === "daangn" || q === "meta") setP(q);
  }, []);
  useEffect(() => {
    setDemo(null); setError("");
    api<DemoCampaign>(`/api/ads/demo/${p}`).then(setDemo).catch((e) => setError(e.message));
  }, [p]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader crumb="ADS / 데모" title="메타·당근 광고 미리보기" desc="API 연동 전 단계라 샘플 데이터로 화면만 보여드려요." action={<Button variant="secondary" href="/ads">광고 홈</Button>} />
      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setP(t.key)} className={`rounded-lg px-4 py-2 text-sm ${p === t.key ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}>{t.label}</button>
        ))}
      </div>
      {error && <ErrorBox message={error} />}
      {!demo && !error && <Spinner text="불러오는 중" />}
      {demo && (
        <Card title={demo.name} right={<Badge>데모 · 샘플 데이터</Badge>}>
          <div className="mb-4 grid gap-2 text-sm md:grid-cols-3">
            <p><span className="text-neutral-500">채널</span> {demo.channel}</p>
            <p><span className="text-neutral-500">목표</span> {demo.objective}</p>
            <p><span className="text-neutral-500">일 예산</span> {won(demo.daily_budget)}</p>
          </div>
          <div className="mb-4 rounded-lg bg-neutral-50 p-4 text-sm">
            <p className="text-xs text-neutral-500">광고 소재</p>
            <p className="mt-1 whitespace-pre-line">{demo.creative}</p>
          </div>
          <SummaryTiles s={demo.summary} />
          <p className="mt-3 text-xs text-neutral-500">{demo.status_message}</p>
        </Card>
      )}
    </div>
  );
}
