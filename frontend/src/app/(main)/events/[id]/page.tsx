"use client";
// Figma 03 · 행사 상세 · 개요
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type BudgetOut, type ChecklistOut, type EventStatus, api, notifyEventDeleted, won } from "@/components/events/api";
import { useEvent } from "@/components/events/EventShell";
import { Card, inputCls } from "@/components/events/ui";
import { Checklist } from "@/components/events/sections";

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-neutral-900">{value}</p>
      <p className="mt-2 text-xs text-neutral-500">{sub}</p>
    </div>
  );
}

function Go({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return primary ? (
    <Link href={href} className="inline-flex h-11 w-full max-w-[260px] items-center rounded-lg bg-[#6d53f1] px-3 text-sm font-medium text-white">{children} ↗</Link>
  ) : (
    <Link href={href} className="block text-sm font-medium text-neutral-900 hover:underline">{children} ↗</Link>
  );
}

export default function EventOverviewPage() {
  const { ev, patch, reload } = useEvent();
  const router = useRouter();
  const [b, setB] = useState<BudgetOut | null>(null);
  const [ck, setCk] = useState<ChecklistOut | null>(null);
  const base = `/events/${ev.id}`;

  useEffect(() => {
    api<BudgetOut>(`/api/events/${ev.id}/budget`).then(setB).catch(() => {});
    api<ChecklistOut>(`/api/events/${ev.id}/checklist`).then(setCk).catch(() => {});
  }, [ev.id]);

  const short = ev.products.filter((p) => p.shortage > 0);
  const extra = b?.target_qty && b.target_qty > b.prepared_total ? b.target_qty - b.prepared_total : 0;
  const nextTodo = ck?.items.find((i) => i.status !== "done");

  const remove = async () => {
    if (!confirm("이 행사를 삭제할까요? 예산·판매 기록·체크리스트도 같이 지워져요.")) return;
    await api(`/api/events/${ev.id}`, { method: "DELETE" });
    notifyEventDeleted(ev.id);
    router.push("/events");
  };

  return (
    <div className="space-y-4">
      {b && !b.has_budget ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#6d53f1] px-6 py-6 text-white">
          <div>
            <p className="text-xl font-bold">예산 입력하고 손익분기점을 알아봐요.</p>
            <p className="mt-1 text-sm text-white/80">참가비·운송비 같은 지출과 상품 원가를 넣으면 몇 개를 팔아야 하는지 바로 계산해 드려요.</p>
          </div>
          <Link href={`/events/${ev.id}/budget?edit=1`} className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-[#6d53f1]">예산 입력하기</Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {b && b.sold_qty > 0 ? (
            <Kpi label="손익분기까지" value={b.remaining_to_bep != null ? `${b.remaining_to_bep}개` : "-"} sub={b.remaining_to_bep === 0 ? "손익분기를 넘었어요" : `지금까지 ${b.sold_qty}개 판매 · 향후 판매 비중 가정`} />
          ) : (
            <Kpi label="손익분기점" value={b?.bep_budget != null ? `${b.bep_budget}개` : "-"} sub={b?.prepared_total ? "준비 수량의 판매 구성 기준" : "상품·원가를 넣으면 계산돼요"} />
          )}
          <Kpi label="목표 판매량" value={b?.target_qty != null ? `${b.target_qty}개` : "-"} sub={b?.target_profit ? `목표 이익 ${won(b.target_profit)}` : "예산·손익에서 목표 이익 입력"} />
          <Kpi label="예산" value={b ? won(b.budget) : "-"} sub={b ? `지급한 행사비 ${won(b.actual_total)}` : ""} />
          <Kpi label="행사 재고 계획" value={b ? `${b.prepared_total}개` : "-"} sub={extra ? `목표까지 ${extra}개 추가 계획 필요` : "판매 상품 준비 수량 합계"} />
        </div>
      )}
      {b?.has_budget && <p className="-mt-2 text-xs text-neutral-500">예상치는 준비 수량을 전부 판매한다고 가정한 값이에요.</p>}

      <Card title="다음 할 일">
        <div className="space-y-3">
          <Go href={`${base}/budget`} primary>예산·손익 계획 확인</Go>
          {short.map((p) => <Go key={p.product_id} href={`${base}/stock`}>{p.name} 부족 수량·발주 확인</Go>)}
          {nextTodo && <Go href={`${base}/schedule`}>{nextTodo.d_label} · {nextTodo.title}</Go>}
          <Go href={`${base}/stock`}>현장 판매 기록</Go>
        </div>
      </Card>

      <Checklist id={ev.id} onChange={reload} />

      <Card title="행사 준비와 고객 관리">
        <div className="space-y-3">
          <Go href={`${base}/schedule`}>행사 운영 캘린더 (발주·입고·준비·현장)</Go>
          <Go href={`${base}/customers`}>부스 QR과 이메일 구독</Go>
          <Go href={`${base}/report`}>행사 성과·후속 이메일</Go>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-sm">
        <label className="flex items-center gap-2 whitespace-nowrap text-neutral-600">
          행사 상태
          <select className={`${inputCls} w-auto`} value={ev.status} onChange={(e) => patch({ status: e.target.value as EventStatus })}>
            <option value="planning">계획 중</option><option value="preparing">준비 중</option><option value="done">종료</option>
          </select>
        </label>
        <button onClick={remove} className="rounded-lg border border-red-200 px-3 py-2 font-medium text-red-600 hover:bg-red-50">행사 삭제</button>
      </div>
    </div>
  );
}
