"use client";
// Figma 44 행사 마감 리포트
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { type AiReportOut, type ReportOut, api, fmtDate, signedWon, won } from "@/components/events/api";
import { useEvent } from "@/components/events/EventShell";
import { Button, Card, ErrorBox, Spinner } from "@/components/events/ui";

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "red" | "green" }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${tone === "red" ? "text-red-600" : tone === "green" ? "text-emerald-700" : ""}`}>{value}</p>
      <p className="mt-2 text-xs text-neutral-500">{sub}</p>
    </div>
  );
}

export default function ReportPage() {
  const { ev } = useEvent();
  const [r, setR] = useState<ReportOut | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => { api<ReportOut>(`/api/events/${ev.id}/report`).then(setR).catch((e) => setError(e.message)); }, [ev.id]);
  useEffect(load, [load]);
  const [ai, setAi] = useState<AiReportOut | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const makeAi = async () => {
    setAiBusy(true); setAiErr("");
    try { setAi(await api<AiReportOut>(`/api/events/${ev.id}/report/ai`, { method: "POST", timeoutMs: 90000 })); }
    catch (e) { setAiErr((e as Error).message); } finally { setAiBusy(false); }
  };

  if (!r) return error ? <ErrorBox message={error} onRetry={load} /> : <Spinner text="리포트를 만드는 중" />;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">행사 마감 리포트</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="현장 매출" value={won(r.revenue)} sub={`판매 ${r.sold_qty}개`} />
        <Kpi label="실제 행사 손익" value={signedWon(r.profit)} sub={r.basis} tone={r.profit < 0 ? "red" : "green"} />
        <Kpi label="판매 목표 달성률" value={r.achievement_rate != null ? `${Math.round(r.achievement_rate * 100)}%` : "미설정"}
          sub={r.target_is_set ? `목표 ${r.target_qty}개 중 ${r.sold_qty}개 판매` : "예산·손익에서 목표 이익을 정하면 계산돼요"} />
        <Kpi label="재고 잔량" value={`${r.remaining_qty}개`} sub={r.stock.map((s) => `${s.name} ${s.remaining}`).join(" · ") || "-"} />
      </div>

      {Object.keys(r.by_payment).length > 0 && (
        <p className="text-sm text-neutral-600">결제 수단 · {Object.entries(r.by_payment).map(([k, v]) => `${k} ${won(v)}`).join(" · ")}</p>
      )}
      <Card title="상품별 판매">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-neutral-500"><tr><th className="py-1">상품</th><th className="text-right">확보</th><th className="text-right">판매</th><th className="text-right">잔여</th><th className="text-right">매출</th><th className="pl-4">발주·입고</th></tr></thead>
          <tbody>
            {r.stock.map((s) => (
              <tr key={s.product_id} className="border-t border-neutral-100">
                <td className="py-2 font-medium">{s.name}</td>
                <td className="text-right tabular-nums">{s.prepared_qty + (s.received_qty ?? 0)}</td>
                <td className="text-right tabular-nums">{s.sold_qty}</td>
                <td className="text-right tabular-nums">{s.remaining}</td>
                <td className="text-right tabular-nums">{won(s.sold_qty * s.price)}</td>
                <td className="pl-4 text-xs text-neutral-600">
                  {(r.orders ?? []).filter((o) => o.product_id === s.product_id).map((o, i) => (
                    <p key={i}>{fmtDate(o.order_date)} 발주 {o.qty}개 → {o.status === "received" ? `${fmtDate(o.received_date)} 입고 ${o.received_qty}개` : `${fmtDate(o.expected_date)} 입고 예정`}</p>
                  ))}
                  {!(r.orders ?? []).some((o) => o.product_id === s.product_id) && <span className="text-neutral-400">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="다음 행사를 위한 AI 리포트" right={<Button onClick={makeAi} disabled={aiBusy}>{aiBusy ? "분석 중…" : ai ? "다시 만들기" : "AI 리포트 만들기"}</Button>}>
        {!ai && !aiErr && <p className="text-sm text-neutral-600">판매 순위·판매율·매출 비중·잔량과 실제 발주·입고 시점으로 다음 행사 제안을 만들어요.</p>}
        {aiErr && <ErrorBox message={aiErr} onRetry={makeAi} />}
        {ai?.status === "insufficient" && (
          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">데이터가 부족해요. 아래를 먼저 확인해 주세요.</p>
            <ul className="mt-1 list-disc pl-5">{ai.missing.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        )}
        {ai?.status === "ok" && (
          <div className="space-y-3">
            {ai.suggestions.map((g, i) => (
              <div key={i} className="rounded-xl border border-neutral-200 p-4">
                <p className="font-semibold text-black">{i + 1}. {g.title}</p>
                <dl className="mt-2 grid grid-cols-[64px_1fr] gap-y-1 text-sm">
                  <dt className="text-neutral-500">근거</dt><dd className="font-medium text-[#6d53f1]">{g.evidence}</dd>
                  <dt className="text-neutral-500">다음 행동</dt><dd>{g.action}</dd>
                  {g.assumption && <><dt className="text-neutral-500">가정</dt><dd className="text-neutral-600">{g.assumption}</dd></>}
                </dl>
              </div>
            ))}
            {ai.missing.length > 0 && <p className="text-xs text-neutral-500">확인 필요 · {ai.missing.join(" · ")}</p>}
            {ai.is_fallback && <p className="text-xs text-neutral-500">AI 응답이 없어 집계 숫자로 만든 기본 제안을 보여줘요.</p>}
          </div>
        )}
      </Card>

      <Card title="구독과 후속 연락">
        <p className="text-sm text-neutral-600">수신에 동의한 행사 주소록을 대상으로 스티비에서 감사 이메일을 발송합니다.</p>
        <Link href={`/events/${ev.id}/customers`} className="mt-2 inline-block text-sm font-medium underline">QR·구독 관리 ↗</Link>
      </Card>

      <Card title="다음 행사에 반영">
        {r.target_qty != null ? (
          <p className="font-semibold">목표 {r.target_qty}개 중 {r.sold_qty}개 판매 · 차이 {r.gap_qty}개</p>
        ) : (
          <p className="font-semibold">판매 {r.sold_qty}개</p>
        )}
        <p className="mt-1 text-sm text-neutral-600">다음 행사 계획에서 비용·상품 판매 비중·준비 수량을 다시 검토합니다.</p>
        <Link href={`/events/${ev.id}/budget`} className="mt-2 inline-block text-sm font-medium underline">비용과 판매 가정 확인 ↗</Link>
      </Card>
    </div>
  );
}
