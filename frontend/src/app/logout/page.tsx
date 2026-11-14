"use client";
// Figma 48 · 로그아웃 확인 / 49 · 로그아웃 완료
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { STORE_KEY } from "@/components/events/api";

export default function LogoutPage() {
  const router = useRouter();
  const [done, setDone] = useState(false);

  const logout = () => {
    try {
      localStorage.removeItem(STORE_KEY);
      localStorage.removeItem("mawd_current_event");
    } catch {}
    setDone(true);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f6fb] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <p className="text-2xl font-bold text-[#6d53f1]">BOOTHKIT</p>
        {done ? (
          <>
            <h1 className="mt-5 text-2xl font-bold text-black">로그아웃했어요</h1>
            <p className="mt-1 text-sm text-[#55545e]">다시 로그인하면 내 행사를 이어서 관리할 수 있어요.</p>
            <Link href="/login" className="mt-6 flex h-11 w-full items-center justify-center rounded-lg bg-[#6d53f1] text-sm font-semibold text-white hover:bg-[#5b42e0]">
              로그인
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-2xl font-bold text-black">로그아웃할까요?</h1>
            <p className="mt-1 text-sm text-[#55545e]">다시 로그인하면 내 행사에 접근할 수 있어요.</p>
            <div className="mt-6 space-y-2">
              <button onClick={logout} className="h-11 w-full rounded-lg bg-[#6d53f1] text-sm font-semibold text-white hover:bg-[#5b42e0]">로그아웃</button>
              <button onClick={() => router.back()} className="h-11 w-full rounded-lg border border-neutral-300 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50">취소</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
