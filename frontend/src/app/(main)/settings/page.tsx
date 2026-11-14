"use client";
// Figma 29 · 설정: 내 계정 · 공통 관리 · 파트너 연동
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/components/events/api";
import { Button, ErrorBox, Spinner, inputCls } from "@/components/events/ui";

type Me = { store_id: string; email: string; store: { name: string; category: string } };
type Integration = { key: string; name: string; status: "ready" | "not_connected" | "error"; status_label: string; check: string };
type AdChannel = { platform: string; name: string; mode: string; status: string; message: string };

const PURPLE = "#6d53f1";

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <h2 className="text-lg font-bold text-black">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-neutral-300"}`} />;
}

function Partner({ name, status, ok, check, link }: { name: string; status: string; ok: boolean; check: string; link?: { href: string; label: string } }) {
  return (
    <section className="flex flex-col rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <h3 className="text-base font-bold text-black">{name}</h3>
      <dl className="mt-3 divide-y divide-neutral-100 text-sm">
        <div className="pb-3"><dt className="text-xs font-semibold text-neutral-500">상태</dt><dd className="mt-1 text-neutral-800"><Dot ok={ok} />{status}</dd></div>
        <div className="pt-3"><dt className="text-xs font-semibold text-neutral-500">확인</dt><dd className="mt-1 text-neutral-700">{check}</dd></div>
      </dl>
      {link && (
        <Link href={link.href} className="mt-4 w-fit rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium hover:border-[#6d53f1] hover:text-[#6d53f1]">
          {link.label} ↗
        </Link>
      )}
    </section>
  );
}

// 가입 때 이메일을 안 넣은 계정: 여기서 로그인 정보를 등록해야 로그아웃 후 다시 들어올 수 있다.
function LoginSetup({ onDone }: { onDone: (m: Me) => void }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setBusy(true); setErr("");
    try { onDone(await api<Me>("/api/stores/me/login", { method: "PUT", json: { email: email.trim(), password: pw } })); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm">
      <p className="font-semibold text-amber-800">로그인 이메일이 없어요. 등록해야 로그아웃한 뒤 다시 들어올 수 있어요.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <input type="email" className={`${inputCls} max-w-[240px]`} placeholder="owner@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" className={`${inputCls} max-w-[200px]`} placeholder="비밀번호 8자 이상" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button onClick={save} disabled={busy || !email.trim() || pw.length < 8}>{busy ? "저장 중…" : "로그인 정보 저장"}</Button>
      </div>
      {err && <p className="mt-2 text-red-700">{err}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [parts, setParts] = useState<Integration[]>([]);
  const [naver, setNaver] = useState<AdChannel | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Me>("/api/stores/me").then(setMe).catch((e) => setError(e.message));
    api<Integration[]>("/api/stores/me/integrations").then(setParts).catch(() => {});
    api<AdChannel[]>("/api/ads/channels").then((l) => setNaver(l.find((c) => c.platform === "naver") ?? null)).catch(() => {});
  }, []);

  const p = (k: string) => parts.find((x) => x.key === k);
  const naverOk = naver?.status === "connected";

  return (
    <div className="mx-auto max-w-[1128px]">
      <h1 className="text-3xl font-bold text-black">설정</h1>
      <p className="mt-2 text-base text-[#55545e]">계정과 브랜드 정보, 외부 서비스 연결을 관리해요.</p>
      {error && <div className="mt-6"><ErrorBox message={error} /></div>}
      {!me && !error && <Spinner text="불러오는 중" />}

      {me && (
        <div className="mt-8 space-y-5">
          <Box title="내 계정">
            <p className="font-semibold text-black">{me.store.name} 운영자</p>
            <p className="mt-1 text-sm text-[#55545e]">{me.email || "이메일 미등록"} · 로그인 중</p>
            {!me.email && <LoginSetup onDone={setMe} />}
            <Link href="/logout" className="mt-4 inline-flex h-10 items-center rounded-lg border border-neutral-300 px-5 text-sm font-medium hover:bg-neutral-50">로그아웃</Link>
          </Box>

          <Box title="공통 관리">
            <div className="flex flex-wrap gap-3">
              <Link href="/settings/brand" className="inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold text-white" style={{ background: PURPLE }}>브랜드·상품 관리</Link>
              <Link href="/settings/customers" className="inline-flex h-11 items-center rounded-lg border border-[#6d53f1] px-5 text-sm font-semibold text-[#6d53f1] hover:bg-[#6d53f1]/5">전체 고객 관리</Link>
            </div>
          </Box>

          <h2 className="pt-2 text-lg font-bold text-black">파트너 연동</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {p("liner") && <Partner name={p("liner")!.name} status={p("liner")!.status_label} ok={p("liner")!.status === "ready"} check={p("liner")!.check} />}
            {p("channeltalk") && <Partner name={p("channeltalk")!.name} status={p("channeltalk")!.status_label} ok={false} check={p("channeltalk")!.check} />}
            {p("stibee") && <Partner name={p("stibee")!.name} status={p("stibee")!.status_label} ok={false} check={p("stibee")!.check}
              link={{ href: "/settings/customers", label: "구독·이메일 관리" }} />}
            <Partner name="광고 계정" ok={naverOk}
              status={naver ? `네이버 파워링크 ${naverOk ? "연결됨" : "연결 안 됨"} · 메타/당근 준비 중` : "확인 중…"}
              check={naverOk ? "캠페인 성과를 보고 광고를 중지 상태로 등록할 수 있어요" : "네이버 광고 계정 번호로 연결하면 성과를 보고 광고를 등록할 수 있어요"}
              link={{ href: "/ads/naver", label: "광고 계정 설정" }} />
          </div>
        </div>
      )}
    </div>
  );
}
