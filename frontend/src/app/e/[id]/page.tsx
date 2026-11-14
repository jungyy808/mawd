"use client";
// Figma: 방문객용 행사 안내 (모바일 우선, 사이드바 없음). 부스 QR · 광고 · 블로그/인스타 링크로 들어옴
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { type PublicEvent, TYPE_LABEL, api, fmtRange, won } from "@/components/events/api";

type ChannelIOFn = ((...args: unknown[]) => void) & { q?: unknown[]; c?: (a: unknown) => void };
declare global { interface Window { ChannelIO?: ChannelIOFn; ChannelIOInitialized?: boolean } }

function loadChannelTalk(pluginKey: string) {
  if (!pluginKey || window.ChannelIOInitialized) return;
  const ch: ChannelIOFn = function (...args: unknown[]) { ch.c?.(args); };
  ch.q = [];
  ch.c = (a) => { ch.q!.push(a); };
  window.ChannelIO = ch;
  window.ChannelIOInitialized = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://cdn.channel.io/plugin/ch-plugin-web.js";
  document.head.appendChild(s);
  window.ChannelIO("boot", { pluginKey });
}

export default function PublicEventPage() {
  const { id } = useParams<{ id: string }>();
  const [ev, setEv] = useState<PublicEvent | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<PublicEvent>(`/api/public/events/${id}`).then(setEv).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => { if (ev?.chat_plugin_key) loadChannelTalk(ev.chat_plugin_key); }, [ev]);

  if (error) return <main className="mx-auto max-w-md p-6 text-center text-sm text-neutral-500">{error}</main>;
  if (!ev) return <main className="mx-auto max-w-md p-6 text-center text-sm text-neutral-400">불러오는 중…</main>;

  return (
    <main className="mx-auto min-h-screen max-w-md bg-white px-5 pb-16 pt-8 text-neutral-900">
      <p className="text-sm font-semibold text-neutral-500">{ev.brand_name}</p>
      <h1 className="mt-1 text-3xl font-bold leading-tight">{ev.name}</h1>
      <p className="mt-2 text-sm text-neutral-500">{ev.brand_name} · 방문객용 행사 안내</p>

      <section className="mt-6 rounded-2xl bg-neutral-50 p-5">
        <p className="text-xs font-semibold text-neutral-500">방문 안내</p>
        <p className="mt-2 text-lg font-semibold">{fmtRange(ev.start_date, ev.end_date)}</p>
        <p className="mt-1 text-sm text-neutral-600">{[ev.hours, ev.location].filter(Boolean).join(" · ") || "시간·장소는 곧 안내드려요"}</p>
        <p className="mt-1 text-xs text-neutral-500">{TYPE_LABEL[ev.type]}</p>
        {ev.location && (
          <a className="mt-3 inline-block text-sm underline" target="_blank" rel="noreferrer" href={`https://map.naver.com/p/search/${encodeURIComponent(ev.location)}`}>
            지도에서 장소 확인 ↗
          </a>
        )}
      </section>

      {ev.products.length > 0 && (
        <section className="mt-6">
          <p className="text-xs font-semibold text-neutral-500">현장 상품</p>
          <ul className="mt-2 divide-y divide-neutral-100">
            {ev.products.map((p) => (
              <li key={p.name} className="flex items-start justify-between py-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  {p.selling_point && <p className="text-sm text-neutral-500">{p.selling_point}</p>}
                </div>
                <p className="text-sm">{won(p.price)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ev.notice && (
        <section className="mt-6 rounded-2xl border border-neutral-200 p-4 text-sm">
          <p className="text-xs font-semibold text-neutral-500">자주 묻는 질문</p>
          <p className="mt-2 whitespace-pre-line">{ev.notice}</p>
        </section>
      )}

      {ev.brand_intro && <p className="mt-6 text-sm text-neutral-500">{ev.brand_intro}</p>}

      <div className="mt-8 space-y-3">
        {ev.subscribe_url && (
          <a href={ev.subscribe_url} target="_blank" rel="noreferrer" className="block rounded-xl bg-neutral-900 py-3 text-center font-medium text-white">
            행사 소식 받기 (구독 신청)
          </a>
        )}
        {ev.chat_plugin_key && (
          <button onClick={() => window.ChannelIO?.("showMessenger")} className="block w-full rounded-xl border border-neutral-300 py-3 text-center font-medium">
            궁금한 점 문의하기 (채널톡)
          </button>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-neutral-400">다음 팝업 소식과 행사 후기를 이메일로 받아보세요.</p>
    </main>
  );
}
