"use client";
// 네이버 검색광고 계정 연결 (홍보 탭 맨 위에서 바로 연결·해제)
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/components/events/api";
import { Badge, Button, ErrorBox, inputCls } from "@/components/events/ui";
import type { AdChannel } from "./types";

export default function NaverConnect({ onChange }: { onChange?: (c: AdChannel) => void }) {
  const [ch, setCh] = useState<AdChannel | null>(null);
  const [cid, setCid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const apply = (c: AdChannel) => { setCh(c); onChange?.(c); };
  useEffect(() => {
    api<AdChannel[]>("/api/ads/channels").then((cs) => { const n = cs.find((c) => c.platform === "naver"); if (n) apply(n); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setBusy(true); setError("");
    try { apply(await api<AdChannel>("/api/ads/naver/connect", { method: "POST", json: { customer_id: cid } })); setCid(""); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const disconnect = async () => {
    if (!confirm("네이버 계정 연결을 해제할까요?")) return;
    try { apply(await api<AdChannel>("/api/ads/naver/connect", { method: "DELETE" })); } catch (e) { setError((e as Error).message); }
  };

  if (!ch) return <div className="h-[76px] animate-pulse rounded-xl bg-white ring-1 ring-neutral-200" />;
  const ok = ch.status === "connected";

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-neutral-200">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#03c75a] text-sm font-black text-white">N</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            네이버 검색광고 계정
            {ok ? <Badge tone="green">연결됨 ****{ch.customer_id_tail}</Badge> : ch.status === "permission_needed" ? <Badge tone="amber">권한 확인 필요</Badge> : <Badge>연결 안 됨</Badge>}
            {ch.mode === "sample" && <Badge tone="amber">예시 화면</Badge>}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {ok ? ch.message || "캠페인·성과 조회와 중지 상태 등록을 할 수 있어요." : "연결하면 실제 키워드 검색수와 성과를 보고, 캠페인을 중지 상태로 등록할 수 있어요."}
          </p>
        </div>
        {ok ? (
          <div className="flex gap-2">
            <Button variant="secondary" href="/ads/naver">성과 보기 ↗</Button>
            <Button variant="ghost" onClick={disconnect}>연결 해제</Button>
          </div>
        ) : (
          <div className="flex w-full gap-2 sm:w-auto">
            <input className={`${inputCls} sm:w-44`} placeholder="광고 계정 번호 (숫자)" value={cid} onChange={(e) => setCid(e.target.value.replace(/\D/g, ""))} />
            <Button onClick={connect} disabled={cid.length < 3 || busy}>{busy ? "확인 중…" : "연결"}</Button>
          </div>
        )}
      </div>
      {!ok && (
        <p className="mt-2 text-xs text-neutral-500">
          광고 계정 번호는 네이버 광고 관리자 오른쪽 위 계정 이름 아래에서 확인할 수 있어요.{" "}
          <Link href="https://manage.searchad.naver.com" target="_blank" className="underline">네이버 광고 열기 ↗</Link>
        </p>
      )}
      {error && <div className="mt-2"><ErrorBox message={error} /></div>}
    </div>
  );
}
