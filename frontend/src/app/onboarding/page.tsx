"use client";
// 간단 가입 (브랜드 = 회원). 은님 온보딩 화면이 들어오면 교체.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { STORE_KEY, api } from "@/components/events/api";
import { Button, ErrorBox, Field, inputCls } from "@/components/events/ui";

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", category: "", intro: "", region: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try { if (localStorage.getItem(STORE_KEY)) router.replace("/events"); } catch {}
  }, [router]);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ store_id: string }>("/api/stores", { method: "POST", json: form });
      localStorage.setItem(STORE_KEY, r.store_id);
      router.replace("/events");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6">
        <p className="text-2xl font-bold text-[#6d53f1]">BOOTHY</p>
        <h1 className="mt-4 text-xl font-bold text-neutral-900">브랜드를 등록하고 시작하세요</h1>
        <p className="mt-1 text-sm text-neutral-500">팝업·마켓·부스 준비부터 손익, 홍보까지 한곳에서 관리해요.</p>
        <div className="mt-6 space-y-4">
          <Field label="브랜드 이름" required>
            <input className={inputCls} placeholder="예: 소소공방" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="업종" required>
            <input className={inputCls} placeholder="예: 문구·굿즈" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
          <Field label="브랜드 소개">
            <input className={inputCls} placeholder="예: 손그림으로 만드는 일상 기록 문구" value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} />
          </Field>
          <Field label="주 활동 지역">
            <input className={inputCls} placeholder="예: 서울 마포구" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          </Field>
          <Field label="로그인 이메일" required>
            <input type="email" autoComplete="email" className={inputCls} placeholder="owner@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="비밀번호" required hint="8자 이상">
            <input type="password" autoComplete="new-password" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          {error && <ErrorBox message={error} />}
          <Button onClick={submit} disabled={busy || !form.name.trim() || !form.category.trim() || !form.email.trim() || form.password.length < 8} className="h-11 w-full">
            {busy ? "등록 중…" : "시작하기"}
          </Button>
        </div>
        <p className="mt-5 text-center text-sm text-neutral-500">
          이미 계정이 있어요? <a href="/login" className="font-semibold text-[#6d53f1] hover:underline">로그인</a>
        </p>
      </div>
    </main>
  );
}
