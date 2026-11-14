"use client";
// 네이버 파워링크 AI 캠페인 초안 (광고 화면 · 행사 홍보·광고 탭에서 같이 사용)
import { useEffect, useState } from "react";
import { type EventOut, api, publicOrigin, won } from "@/components/events/api";
import { Badge, Button, Card, ErrorBox, Field, Spinner, copyText as copyToClipboard, inputCls } from "@/components/events/ui";
import type { NaverDraft, NaverRegisterOut } from "./types";
import { saveContent } from "./Generated";

export default function DraftCard({ eventId }: { eventId?: string }) {
  const [events, setEvents] = useState<EventOut[]>([]);
  const [form, setForm] = useState({ event_id: "", goal: "행사 방문", product_name: "", daily_budget: 10000, landing_url: "", start_date: "", end_date: "", emphasis: "" });
  const [requestId, setRequestId] = useState(""); // 같은 초안의 신청 재시도는 같은 키 → 네이버에 중복 등록 안 됨
  const [draft, setDraft] = useState<NaverDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [approve, setApprove] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [reg, setReg] = useState<NaverRegisterOut | null>(null);
  const [savedFor, setSavedFor] = useState("");

  const register = async () => {
    if (!draft) return;
    setRegistering(true); setError("");
    try {
      const out = await api<NaverRegisterOut>("/api/ads/naver/register", {
        method: "POST",
        json: {
          request_id: requestId, campaign_name: draft.campaign_name, adgroup_name: draft.adgroup_name,
          keywords: draft.keywords.map(({ keyword, bid }) => ({ keyword, bid })),
          title: draft.title, description: draft.description, daily_budget: draft.daily_budget, landing_url: draft.landing_url,
        },
      });
      setReg(out);
      setApprove(false);
      // 신청 완료된 문구만 '생성한 항목'에 남긴다 (같은 초안 재시도는 한 번만)
      const evId = eventId || form.event_id;
      if (out.status === "ok" && evId && savedFor !== requestId) {
        setSavedFor(requestId);
        saveContent(evId, { kind: "powerlink", title: draft.title, body: draft.description, url: draft.landing_url, image_url: "", tags: draft.keywords.map((k) => k.keyword) }).catch(() => {});
      }
    } catch (e) { setError((e as Error).message); }
    finally { setRegistering(false); }
  };

  useEffect(() => {
    api<EventOut[]>("/api/events").then((evs) => {
      setEvents(evs);
      const ev = eventId ? evs.find((e) => e.id === eventId) : undefined;
      if (ev) setForm((f) => ({ ...f, event_id: ev.id, landing_url: `${publicOrigin()}/e/${ev.id}`, product_name: ev.products[0]?.name ?? "",
        end_date: ev.start_date ?? "", start_date: new Date().toISOString().slice(0, 10) }));
    }).catch(() => {});
  }, [eventId]);
  const pickEvent = (id: string) => {
    const ev = events.find((e) => e.id === id);
    setForm((f) => ({
      ...f, event_id: id,
      landing_url: id ? `${publicOrigin()}/e/${id}` : f.landing_url,
      product_name: f.product_name || ev?.products[0]?.name || "",
      end_date: ev?.start_date ?? f.end_date,
    }));
  };

  // 생성 전에 막을 것: 기간 역전, 일예산·강조 내용 누락
  const invalid = !form.emphasis.trim() ? "강조할 내용을 입력해 주세요." :
    form.daily_budget <= 0 ? "일예산을 입력해 주세요." :
    form.start_date && form.end_date && form.start_date > form.end_date ? "종료일이 시작일보다 빨라요." : "";

  const make = async () => {
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError("");
    setReg(null); setApprove(false); setAgreed(false);
    setRequestId(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()));
    try { setDraft(await api<NaverDraft>("/api/ads/naver/draft", { method: "POST", json: { ...form, event_id: form.event_id || null, start_date: form.start_date || null, end_date: form.end_date || null } })); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const copyText = () => {
    if (!draft) return;
    const t = [`캠페인: ${draft.campaign_name}`, `광고그룹: ${draft.adgroup_name}`, `제목: ${draft.title}`, `설명: ${draft.description}`,
      `키워드: ${draft.keywords.map((k) => `${k.keyword}(${k.bid}원)`).join(", ")}`, `일 예산: ${draft.daily_budget}원`, `연결 URL: ${draft.landing_url}`].join("\n");
    copyToClipboard(t).then((ok) => { if (!ok) window.prompt("아래 내용을 복사하세요 (⌘C)", t); });
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
        <Field label="일예산 (원)" required><input className={inputCls} type="number" value={form.daily_budget} onChange={(e) => setForm({ ...form, daily_budget: Number(e.target.value || 0) })} /></Field>
        <Field label="광고 기간 (KST)">
          <div className="flex items-center gap-2">
            <input className={inputCls} type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            <span className="text-neutral-400">~</span>
            <input className={inputCls} type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>
        </Field>
        <div className="md:col-span-2">
          <Field label="강조할 내용" required hint="예: 현장 한정 10% 할인, 신상 포켓 노트 첫 공개, 2개 구매 시 스티커 증정">
            <input className={inputCls} placeholder="광고 문구에서 꼭 말하고 싶은 것" value={form.emphasis} onChange={(e) => setForm({ ...form, emphasis: e.target.value })} />
          </Field>
        </div>
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
        <div className="mt-6 space-y-5 rounded-2xl border border-[#6d53f1]/20 bg-gradient-to-b from-[#6d53f1]/[0.04] to-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#6d53f1] px-3 py-1 text-xs font-semibold text-white">AI 초안</span>
            <span className="text-sm text-neutral-500">네이버 파워링크 · 검색 결과에 이렇게 보여요</span>
            {draft.is_fallback && <Badge tone="amber">AI 연결이 불안정해 기본 초안이에요</Badge>}
          </div>

          {/* 네이버 검색 결과 미리보기 */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 border-b border-neutral-100 pb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-[#03c75a] text-xs font-black text-white">N</span>
              <span className="flex-1 truncate rounded-full border-2 border-[#03c75a] px-3 py-1 text-sm text-neutral-700">{draft.keywords[0]?.keyword ?? draft.title}</span>
            </div>
            <p className="text-xs text-neutral-500">파워링크 · <span className="text-neutral-400">광고</span></p>
            <p className="mt-1 text-lg font-semibold text-[#0b2bb5] hover:underline">{draft.title}</p>
            <p className="truncate text-sm text-[#03a94e]">{draft.landing_url || "연결 URL 미입력"}</p>
            <p className="mt-1 text-sm text-neutral-700">{draft.description}</p>
            <div className="mt-3 flex gap-3 text-xs">
              <span className={draft.title.length > 15 ? "text-red-600" : "text-neutral-400"}>제목 {draft.title.length}/15</span>
              <span className={draft.description.length > 45 ? "text-red-600" : "text-neutral-400"}>설명 {draft.description.length}/45</span>
            </div>
          </div>

          {/* 캠페인 구성 */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["캠페인", draft.campaign_name],
              ["광고그룹", draft.adgroup_name],
              ["일 예산", won(draft.daily_budget)],
              ["추천 지역", draft.region_suggestion || "전국"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white p-3 ring-1 ring-neutral-200">
                <p className="text-xs text-neutral-500">{k}</p>
                <p className="mt-1 text-sm font-semibold break-keep text-neutral-900">{v}</p>
              </div>
            ))}
          </div>

          {/* 키워드 */}
          <div>
            <p className="mb-2 text-sm font-semibold">키워드 {draft.keywords.length}개 <span className="font-normal text-neutral-500">· 클릭당 입찰가</span></p>
            <div className="flex flex-wrap gap-2">
              {draft.keywords.map((k) => (
                <span key={k.keyword} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-[#6d53f1]/30">
                  <span className="font-medium">{k.keyword}</span>
                  <span className="tabular-nums text-[#6d53f1]">{won(k.bid)}</span>
                  {k.monthly_search != null && <span className="text-xs text-neutral-500">월 {k.monthly_search.toLocaleString("ko-KR")}회</span>}
                </span>
              ))}
            </div>
            {draft.keywords.every((k) => k.monthly_search == null) && (
              <p className="mt-2 text-xs text-neutral-500">네이버 계정을 연결하면 키워드별 실제 월간 검색수가 함께 보여요.</p>
            )}
          </div>

          {draft.warnings.length > 0 && <ul className="space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{draft.warnings.map((w) => <li key={w}>• {w}</li>)}</ul>}
          <div className="flex flex-wrap gap-2">
            {!reg && <Button onClick={() => { setApprove(true); setAgreed(false); }} disabled={approve}>광고 신청하기</Button>}
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
                <Button onClick={register} disabled={!agreed || registering}>{registering ? "신청 중…" : "승인하고 신청"}</Button>
                <Button variant="ghost" onClick={() => setApprove(false)}>취소</Button>
              </div>
            </div>
          )}

          {reg && (
            <div className={`rounded-lg border p-4 text-sm ${reg.status === "ok" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <p className="font-semibold">
                {reg.status === "ok" ? "신청 완료 · 중지 상태로 등록됨" : reg.status === "partial" ? "일부만 등록됐어요" : "신청하지 못했어요"}
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
              {reg.status === "ok" && draft && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg bg-white p-4">
                    <p className="font-semibold text-black">캠페인 세부 · 중지 상태로 등록됨</p>
                    <dl className="mt-2 divide-y divide-neutral-100 text-xs">
                      <div className="py-1.5"><dt className="text-neutral-500">캠페인 / 광고그룹</dt><dd className="font-medium">{draft.campaign_name} / {draft.adgroup_name}</dd></div>
                      <div className="py-1.5"><dt className="text-neutral-500">등록 결과</dt><dd className="font-medium">캠페인 1 · 그룹 1 · 키워드 {draft.keywords.length} · 소재 1</dd></div>
                      <div className="py-1.5"><dt className="text-neutral-500">일예산 / 계획 기간</dt><dd className="font-medium">{won(draft.daily_budget)} / {form.start_date || "-"} ~ {form.end_date || "-"}</dd></div>
                      <div className="py-1.5"><dt className="text-neutral-500">검수 상태</dt><dd className="font-medium">소재 검토 중 (네이버 검수 후 노출 가능)</dd></div>
                    </dl>
                  </div>
                  <div className="rounded-lg bg-white p-4">
                    <p className="font-semibold text-black">집행 확인</p>
                    <p className="mt-2 text-xs text-neutral-600">등록과 실제 집행은 달라요. 지금은 중지 상태라 광고비가 나가지 않아요.</p>
                    <p className="mt-1 text-xs text-neutral-600">집행하려면 네이버 광고 관리자에서 권한·소재 검수 상태를 확인한 뒤 직접 켜 주세요. MAWD는 집행을 켜지 않아요.</p>
                    <a href={reg.manage_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-[#6d53f1] px-3 py-2 text-xs font-semibold text-white">집행 승인 검토 ↗</a>
                  </div>
                </div>
              )}
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
