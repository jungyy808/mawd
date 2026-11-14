"use client";
// Figma: ADS / 광고 — 채널 연결 상태
import { useEffect, useState } from "react";
import { api } from "@/components/events/api";
import { Badge, Button, Card, ErrorBox, PageHeader, Spinner } from "@/components/events/ui";
import { type AdChannel, STATUS_TEXT } from "@/components/ads/types";

export default function AdsPage() {
  const [channels, setChannels] = useState<AdChannel[] | null>(null);
  const [error, setError] = useState("");
  const load = () => api<AdChannel[]>("/api/ads/channels").then(setChannels).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader crumb="ADS / 광고" title="광고" desc="연결한 광고 계정의 성과를 보고, AI가 캠페인 초안을 만들어 드려요. 실제 집행·결제는 각 광고 관리자에서 합니다." />
      {error && <ErrorBox message={error} onRetry={load} />}
      {!channels && !error && <Spinner text="광고 채널을 불러오는 중" />}
      <div className="grid gap-3 md:grid-cols-3">
        {channels?.map((c) => (
          <Card key={c.platform}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-neutral-500">{c.product}</p>
              </div>
              <Badge tone={c.status === "connected" ? "green" : c.status === "permission_needed" ? "amber" : "gray"}>{STATUS_TEXT[c.status]}</Badge>
            </div>
            <p className="mt-3 min-h-10 text-sm text-neutral-600">
              {c.message || (c.customer_id_tail ? `계정 ****${c.customer_id_tail}` : "")}
            </p>
            <div className="mt-2 flex items-center gap-2">
              {c.mode === "sample" && <Badge tone="amber">샘플 데이터</Badge>}
              {c.mode === "demo" && <Badge>데모</Badge>}
              {c.mode === "live" && <Badge tone="green">실연동</Badge>}
            </div>
            <Button className="mt-4 w-full" variant={c.platform === "naver" ? "primary" : "secondary"} href={c.platform === "naver" ? "/ads/naver" : `/ads/demo?p=${c.platform}`}>
              {c.platform === "naver" ? "성과 보기 · 초안 만들기" : "데모 보기"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
