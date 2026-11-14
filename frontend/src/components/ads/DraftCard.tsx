"use client";
// 네이버 파워링크 AI 캠페인 초안 (광고 화면 · 행사 홍보·광고 탭에서 같이 사용)
import { useEffect, useState } from "react";
import { type EventOut, api, publicOrigin, won } from "@/components/events/api";
import { Badge, Button, Card, ErrorBox, Field, Spinner, inputCls } from "@/components/events/ui";
import type { NaverDraft, NaverRegisterOut } from "./types";

export default function DraftCard({ eventId }: { eventId?: string }) {
  const [events, setEvents] = useState<EventOut[]>([]);
  const [form, setForm] = useState({ event_id: "", goal: "행사 방문", product_name: "", daily_budget: 10000, landing_url: "" });
  const [draft, setDraft] = useState<NaverDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [approve, setApprove] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [reg, setReg] = useState<NaverRegisterOut | null>(null);

  const register = async () => {
    if (!draft) return;
    setRegistering(true); setError("");
    try {
      setReg(await api<NaverRegisterOut>("/api/ads/naver/register", {
        method: "POST",
        json: {
          campaign_name: draft.campaign_name, adgroup_name: draft.adgroup_name,
          keywords: draft.keywords.map(({ keyword, bid }) => ({ keyword, bid })),
          title: draft.title, description: draft.description, daily_budget: draft.daily_budget, landing_url: draft.landing_url,
        },
      }));
      setApprove(false);
    } catch (e) { setError((e as Error).message); }
    finally { setRegistering(false); }
  };

  useEffect(() => {
    api<EventOut[]>("/api/events").then((evs) => {
      setEvents(evs);
      const ev = eventId ? evs.find((e) => e.id === eventId) : undefined;
      if (ev) setForm((f) => ({ ...f, event_id: ev.id, landing_url: `${publicOrigin()}/e/${ev.id}`, product_name: ev.products[0]?.name ?? "" }));
    }).catch(() => {});
  }, [eventId]);
  const pickEvent = (id: string) => {
    const ev = events.find((e) => e.id === id);
    setForm((f) => ({
      ...f, event_id: id,
      landing_url: id ? `${publicOrigin()}/e/${id}` : f.landing_url,
      product_name: f.product_name || ev?.products[0]?.name || "",
    }));
  };

  const make = async () => {
    setBusy(true); setError("");
    setReg(null); setApprove(false); setAgreed(false);
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
        {!eventId && <Field label="연결할 행사">
          <select className={inputCls} value={form.event_id} onChange={(e) => pickEvent(e.target.value)}>
            <option value="">선택 안 함</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>}
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
      {(() => {
        const sel = events.find((e) => e.id === form.event_id);
        if (!sel || sel.is_public) return null;
        return (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <span className="flex-1">이 행사의 방문객 안내 페이지가 아직 <b>공개 전</b>이에요. 광고를 눌러 들어온 사람에게 &quot;공개되지 않은 행사&quot;로 보여요.</span>
            <Button variant="secondary" onClick={async () => {
              try {
                await api(`/api/events/${sel.id}`, { method: "PATCH", json: { is_public: true } });
                setEvents((evs) => evs.map((e) => (e.id === sel.id ? { ...e, is_public: true } : e)));
              } catch (e) { setError((e as Error).message); }
            }}>안내 페이지 공개</Button>
          </div>
        );
      })()}
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
            {!reg && <Button onClick={() => { setApprove(true); setAgreed(false); }} disabled={approve}>네이버에 중지 상태로 등록</Button>}
            <Button variant="secondary" onClick={copyText}>{copied ? "복사됨 ✓" : "초안 복사"}</Button>
          </div>

          {approve && !reg && (
            <div className="rounded-lg border-2 border-[#6d53f1]/40 bg-[#6d53f1]/5 p-4 text-sm">
              <p className="font-semibold">파워링크 등록 승인</p>
              <ul className="mt-2 space-y-1 text-neutral-700">
                <li>캠페인 · {draft.campaign_name}</li>
                <li>광고그룹 · {draft.adgroup_name} · 키워드 {draft.keywords.length}개</li>
                <li>일 예산 · {won(draft.daily_budget)}</li>
                <li>연결 URL · <span className="break-all">{draft.landing_url || "없음 (광고 문구는 등록되지 않아요)"}</span></li>
              </ul>
              <label className="mt-3 flex items-start gap-2">
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>네이버에 <b>중지 상태</b>로 등록되며 광고비는 나가지 않아요. 집행은 네이버 광고 관리자에서 제가 직접 켭니다.</span>
              </label>
              <div className="mt-3 flex gap-2">
                <Button onClick={register} disabled={!agreed || registering}>{registering ? "등록 중…" : "승인하고 등록"}</Button>
                <Button variant="ghost" onClick={() => setApprove(false)}>취소</Button>
              </div>
            </div>
          )}

          {reg && (
            <div className={`rounded-lg border p-4 text-sm ${reg.status === "ok" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <p className="font-semibold">
                {reg.status === "ok" ? "등록 완료" : reg.status === "partial" ? "일부만 등록됐어요" : "등록하지 못했어요"}
                {reg.is_sample && <Badge tone="amber">샘플</Badge>}
              </p>
              <ul className="mt-2 space-y-1">
                {reg.steps.map((s) => (
                  <li key={s.step} className="flex gap-2">
                    <span className={s.ok ? "text-emerald-700" : "text-red-600"}>{s.ok ? "✓" : "✕"}</span>
                    <span className="font-medium">{s.step}</span>
                    {s.message && <span className="min-w-0 break-all text-neutral-600">· {s.message}</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-neutral-700">{reg.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" href={reg.manage_url}>네이버 광고 관리자 열기 ↗</Button>
                {reg.status !== "ok" && <Button variant="ghost" onClick={() => { setReg(null); setApprove(true); setAgreed(false); }}>다시 시도</Button>}
              </div>
            </div>
          )}
          <p className="text-xs text-neutral-500">MAWD는 광고비를 쓰지 않아요. 등록은 항상 중지 상태이고, 집행은 네이버 광고 관리자에서 직접 켜야 해요.</p>
        </div>
      )}
    </Card>
  );
}
