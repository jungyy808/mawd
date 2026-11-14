"use client";
// 첫 화면: store_id가 있으면 홈, 없으면 로그인으로 보낸다.
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { STORE_KEY } from "@/components/events/api";

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    let id: string | null = null;
    try { id = localStorage.getItem(STORE_KEY); } catch {}
    router.replace(id ? "/home" : "/login");
  }, [router]);
  return null;
}
