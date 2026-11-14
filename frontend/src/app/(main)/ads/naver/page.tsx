"use client";
// Figma: 네이버 파워링크 — 계정 연결 / 최근 성과 / AI 캠페인 초안
import { useCallback, useEffect, useState } from "react";
import { type EventOut, api, won } from "@/components/events/api";
import { Badge, Button, Card, ErrorBox, Field, PageHeader, Spinner, inputCls } from "@/components/events/ui";
import { SummaryTiles } from "@/components/ads/Summary";
import type { AdChannel, NaverDraft, NaverStats } from "@/components/ads/types";

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

function DraftCard() {
  const [events, setEvents] = useState<EventOut[]>([]);
  const [form, setForm] = useState({ event_id: "", goal: "행사 방문", product_name: "", daily_budget: 10000, landing_url: "" });
  const [draft, setDraft] = useState<NaverDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => { api<EventOut[]>("/api/events").then(setEvents).catch(() => {}); }, []);
  const pickEvent = (id: string) => {
    const ev = events.find((e) => e.id === id);
    setForm((f) => ({
      ...f, event_id: id,
      landing_url: id && typeof window !== "undefined" ? `${window.location.origin}/e/${id}` : f.landing_url,
      product_name: f.product_name || ev?.products[0]?.name || "",
    }));
  };

  const make = async () => {
    setBusy(true); setError("");
    try { setDraft(await api<NaverDraft>("/api/ads/naver/draft", { method: "POST", json: { ...form, event_id: form.event_id || null } })); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const copyText = () => {
    if (!draft) return;
    const t = [`캠페인: ${draft.campaign_name}`, `광고그룹: ${draft.adgroup_name}`, `제목: ${draft.title}`, `설명: ${draft.description}`,
      `키워드: ${draft.keywords.map((k) => `${k.keyword}(${k.bid}원)`).join(", ")}`, `일 예산: ${draft.daily_budget}원`, `연결 URL: ${draft.landing_url}`].join("\n");
    navigator.clipboard.writeText(t);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card title="AI 캠페인 초안">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="연결할 행사">
          <select className={inputCls} value={form.event_id} onChange={(e) => pickEvent(e.target.value)}>
            <option value="">선택 안 함</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>
        <Field label="목표">
          <select className={inputCls} value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })}>
            <option>행사 방문</option><option>상품 판매</option><option>브랜드 인지</option>
          </select>
        </Field>
        <Field label="광고 상품"><input className={inputCls} placeholder="예: 포켓 노트" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></Field>
        <Field label="일 예산 (원)"><input className={inputCls} type="number" value={form.daily_budget} onChange={(e) => setForm({ ...form, daily_budget: Number(e.target.value || 0) })} /></Field>
        <div className="md:col-span-2">
          <Field label="연결 URL" hint="행사를 고르면 방문객 안내 페이지 주소가 자동으로 들어가요">
            <input className={inputCls} placeholder="https://…" value={form.landing_url} onChange={(e) => setForm({ ...form, landing_url: e.target.value })} />
          </Field>
        </div>
      </div>
      <Button className="mt-4" onClick={make} disabled={busy}>{busy ? "초안 만드는 중…" : draft ? "초안 다시 만들기" : "초안 만들기"}</Button>
      {error && <div className="mt-3"><ErrorBox message={error} /></div>}

      {busy && <Spinner text="AI가 키워드와 광고 문구를 만드는 중" />}
      {draft && !busy && (
        <div className="mt-5 space-y-4 rounded-lg border border-neutral-200 p-4">
          {draft.is_fallback && <Badge tone="amber">AI 연결이 불안정해 기본 초안을 보여드려요</Badge>}
          <div className="rounded-lg bg-neutral-50 p-4">
            <p className="text-xs text-neutral-500">검색 결과 미리보기</p>
            <p className="mt-1 font-semibold text-sky-800">{draft.title}</p>
            <p className="text-xs text-emerald-700">{draft.landing_url || "연결 URL 미입력"}</p>
            <p className="mt-1 text-sm text-neutral-700">{draft.description}</p>
            <p className="mt-2 text-xs text-neutral-500">제목 {draft.title.length}/15자 · 설명 {draft.description.length}/45자</p>
          </div>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <p><span className="text-neutral-500">캠페인</span> {draft.campaign_name}</p>
            <p><span className="text-neutral-500">광고그룹</span> {draft.adgroup_name}</p>
            <p><span className="text-neutral-500">일 예산</span> {won(draft.daily_budget)}</p>
            {draft.region_suggestion && <p><span className="text-neutral-500">지역</span> {draft.region_suggestion}</p>}
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500"><tr><th className="py-1">키워드</th><th className="text-right">입찰가</th><th className="text-right">월간 검색수</th></tr></thead>
            <tbody>
              {draft.keywords.map((k) => (
                <tr key={k.keyword} className="border-t border-neutral-100">
                  <td className="py-1.5">{k.keyword}</td>
                  <td className="text-right tabular-nums">{won(k.bid)}</td>
                  <td className="text-right tabular-nums text-neutral-500">{k.monthly_search?.toLocaleString("ko-KR") ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {draft.warnings.length > 0 && <ul className="space-y-1 text-xs text-amber-700">{draft.warnings.map((w) => <li key={w}>• {w}</li>)}</ul>}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={copyText}>{copied ? "복사됨 ✓" : "초안 복사"}</Button>
            <Button variant="secondary" href="https://searchad.naver.com">네이버 광고 관리자에서 등록 ↗</Button>
          </div>
          <p className="text-xs text-neutral-500">MAWD는 광고를 직접 집행하지 않아요. 초안을 확인한 뒤 네이버 광고 관리자에서 등록하세요.</p>
        </div>
      )}
    </Card>
  );
}
