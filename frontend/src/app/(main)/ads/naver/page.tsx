"use client";
// Figma: 네이버 파워링크 — 계정 연결 / 최근 성과 / AI 캠페인 초안
import { useCallback, useEffect, useState } from "react";
import { api, won } from "@/components/events/api";
import { Badge, Button, Card, ErrorBox, Field, PageHeader, Spinner, inputCls } from "@/components/events/ui";
import { SummaryTiles } from "@/components/ads/Summary";
import type { AdChannel, NaverStats } from "@/components/ads/types";
import DraftCard from "@/components/ads/DraftCard";

export default function NaverAdsPage() {
  const [channel, setChannel] = useState<AdChannel | null>(null);
  const [stats, setStats] = useState<NaverStats | null>(null);
  const [days, setDays] = useState(7);
  const [cid, setCid] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [chs, st] = await Promise.all([api<AdChannel[]>("/api/ads/channels"), api<NaverStats>(`/api/ads/naver/stats?days=${days}`)]);
      setChannel(chs.find((c) => c.platform === "naver") ?? null);
      setStats(st);
    } catch (e) { setError((e as Error).message); }
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    try { setChannel(await api<AdChannel>("/api/ads/naver/connect", { method: "POST", json: { customer_id: cid } })); load(); }
    catch (e) { setError((e as Error).message); }
  };
  const disconnect = async () => {
    try { setChannel(await api<AdChannel>("/api/ads/naver/connect", { method: "DELETE" })); load(); }
    catch (e) { setError((e as Error).message); }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader crumb="ADS / 네이버 파워링크" title="네이버 파워링크" desc="검색광고 성과를 확인하고 행사 홍보용 캠페인 초안을 만듭니다." action={<Button variant="secondary" href="/ads">광고 홈</Button>} />
      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      <Card title="계정 연결" className="mb-4" right={channel && <Badge tone={channel.status === "connected" ? "green" : "gray"}>{channel.status === "connected" ? `연결됨 ****${channel.customer_id_tail}` : "연결 안 됨"}</Badge>}>
        {channel?.status === "connected" ? (
          <div className="flex items-center justify-between text-sm">
            <p className="text-neutral-600">{channel.message || "계정이 연결되어 있어요."}</p>
            <Button variant="ghost" onClick={disconnect}>연결 해제</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-60 flex-1">
              <Field label="CUSTOMER_ID" hint="네이버 검색광고 > 도구 > API 사용 관리에서 확인">
                <input className={inputCls} placeholder="예: 1234567" value={cid} onChange={(e) => setCid(e.target.value)} />
              </Field>
            </div>
            <Button onClick={connect} disabled={cid.trim().length < 3}>연결 확인</Button>
          </div>
        )}
      </Card>

      <Card
        title="최근 성과"
        className="mb-4"
        right={
          <div className="flex items-center gap-2">
            {stats?.is_sample && <Badge tone="amber">샘플 데이터</Badge>}
            <select className={`${inputCls} w-auto`} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>최근 7일</option><option value={14}>최근 14일</option><option value={30}>최근 30일</option>
            </select>
          </div>
        }
      >
        {!stats ? <Spinner text="성과를 불러오는 중" /> : (
          <>
            <p className="mb-3 text-xs text-neutral-500">{stats.since} ~ {stats.until} · 동기화 {stats.synced_at.slice(11, 16)}{stats.message ? ` · ${stats.message}` : ""}</p>
            <SummaryTiles s={stats.summary} />
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-xs text-neutral-500"><tr><th className="py-2">캠페인</th><th>상태</th><th className="text-right">일 예산</th><th className="text-right">노출</th><th className="text-right">클릭</th><th className="text-right">비용</th></tr></thead>
              <tbody>
                {stats.campaigns.map((c) => (
                  <tr key={c.id} className="border-t border-neutral-100">
                    <td className="py-2 font-medium">{c.name}</td>
                    <td><Badge tone={c.status.includes("운영") ? "green" : "gray"}>{c.status}</Badge></td>
                    <td className="text-right tabular-nums">{won(c.daily_budget)}</td>
                    <td className="text-right tabular-nums">{c.impressions.toLocaleString("ko-KR")}</td>
                    <td className="text-right tabular-nums">{c.clicks.toLocaleString("ko-KR")}</td>
                    <td className="text-right tabular-nums">{won(c.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!stats.conversion_tracking && <p className="mt-3 text-xs text-neutral-500">전환 추적이 설정되지 않아 구매 성과는 표시되지 않아요.</p>}
          </>
        )}
      </Card>

      <DraftCard />
    </div>
  );
}
