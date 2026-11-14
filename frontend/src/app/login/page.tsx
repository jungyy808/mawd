"use client";
// Figma 46 · 로그인 / 47 · 로그인 확인 필요
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { STORE_KEY, api } from "@/components/events/api";
import { inputCls } from "@/components/events/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailed("");
    try {
      const r = await api<{ store_id: string }>("/api/stores/login", { method: "POST", json: { email: email.trim(), password } });
      localStorage.setItem(STORE_KEY, r.store_id);
      try { localStorage.removeItem("mawd_current_event"); } catch {}
      router.replace("/home");
    } catch (err) {
      setFailed((err as Error).message || "이메일 또는 비밀번호를 확인하고 다시 시도하세요.");
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f6fb] px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-7 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <p className="text-2xl font-bold text-[#6d53f1]">BOOTHY</p>
        <h1 className="mt-5 text-2xl font-bold text-black">로그인</h1>
        <p className="mt-1 text-sm text-[#55545e]">내 행사에 접근하려면 운영자 계정으로 로그인하세요.</p>
        <div className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">이메일</span>
            <input type="email" autoComplete="email" className={inputCls} placeholder="owner@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">비밀번호</span>
            <input type="password" autoComplete="current-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {failed && <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{failed}</p>}
          <button type="submit" disabled={busy || !email.trim() || !password}
            className="h-11 w-full rounded-lg bg-[#6d53f1] text-sm font-semibold text-white hover:bg-[#5b42e0] disabled:opacity-40">
            {busy ? "확인 중…" : failed ? "다시 로그인" : "로그인"}
          </button>
        </div>
        <p className="mt-5 text-center text-sm text-[#55545e]">
          처음이에요? <Link href="/onboarding" className="font-semibold text-[#6d53f1] hover:underline">브랜드 등록하고 시작하기</Link>
        </p>
      </form>
    </main>
  );
}
