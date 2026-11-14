"use client";
// Figma: 방문객용 행사 안내 (모바일 우선, 사이드바 없음). 부스 QR · 광고 · 블로그/인스타 링크로 들어옴
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL, ApiError, type EventOut, type PublicEvent, TYPE_LABEL, api, fmtRange, getStoreId, won } from "@/components/events/api";

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

// 주인 미리보기: 공개 전이어도 브랜드 주인(store_id 있음)이면 행사 정보로 미리 보여준다.
// api()는 store 오류 때 온보딩으로 보내므로 여기서는 fetch를 직접 쓴다.
async function ownerPreview(id: string): Promise<{ ev: PublicEvent; raw: EventOut } | null> {
  const sid = getStoreId();
  if (!sid) return null;
  try {
    const h = { "X-Store-Id": sid };
    const [er, sr] = await Promise.all([fetch(`${API_URL}/api/events/${id}`, { headers: h }), fetch(`${API_URL}/api/stores/me`, { headers: h })]);
    if (!er.ok || !sr.ok) return null;
    const raw: EventOut = await er.json();
    const j = await sr.json();
    const st = j.store ?? j; // /api/stores/me 응답은 { store_id, store: {...} }
    return {
      raw,
      ev: {
        id: raw.id, brand_name: st.name ?? "", brand_intro: st.intro ?? "", name: raw.name, type: raw.type,
        start_date: raw.start_date, end_date: raw.end_date, hours: raw.hours, location: raw.location, notice: raw.notice ?? "",
        products: raw.products.map((p) => ({ name: p.name, price: p.price, selling_point: "" })),
        subscribe_url: raw.subscribe_url ?? "", chat_plugin_key: raw.chat_plugin_key ?? "",
      },
    };
  } catch {
    return null;
  }
}

export default function PublicEventPage() {
  const { id } = useParams<{ id: string }>();
  const [ev, setEv] = useState<PublicEvent | null>(null);
  const [preview, setPreview] = useState(false);
  const [notPublic, setNotPublic] = useState(false);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    api<PublicEvent>(`/api/public/events/${id}`)
      .then(setEv)
      .catch(async (e) => {
        if (e instanceof ApiError && e.status === 404) {
          const p = await ownerPreview(id);
          if (p) { setEv(p.ev); setPreview(true); return; }
          setNotPublic(true);
          return;
        }
        setError(e.message);
      });
  }, [id]);
  useEffect(() => { if (ev?.chat_plugin_key && !preview) loadChannelTalk(ev.chat_plugin_key); }, [ev, preview]);

  const publish = async () => {
    setPublishing(true);
    try {
      await api(`/api/events/${id}`, { method: "PATCH", json: { is_public: true } });
      setEv(await api<PublicEvent>(`/api/public/events/${id}`));
      setPreview(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  if (notPublic) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center text-neutral-900">
        <p className="text-2xl font-bold text-[#6d53f1]">BOOTHY</p>
        <p className="mt-6 text-lg font-semibold">아직 공개되지 않은 행사예요</p>
        <p className="mt-2 text-sm text-neutral-500">행사 안내가 준비되면 이 주소에서 볼 수 있어요.<br />링크를 받은 곳에서 잠시 후 다시 열어 주세요.</p>
      </main>
    );
  }
  if (error) return <main className="mx-auto max-w-md p-6 text-center text-sm text-neutral-500">{error}</main>;
  if (!ev) return <main className="mx-auto max-w-md p-6 text-center text-sm text-neutral-400">불러오는 중…</main>;

  return (
    <main className="mx-auto min-h-screen max-w-md bg-white px-5 pb-16 pt-8 text-neutral-900">
      {preview && (
        <div className="-mx-5 -mt-8 mb-6 bg-[#6d53f1] px-5 py-3 text-sm text-white">
          <p className="font-semibold">미리보기 · 아직 방문객에게 공개되지 않았어요</p>
          <p className="mt-0.5 text-white/80">브랜드 주인에게만 보이는 화면이에요.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={publish} disabled={publishing} className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#6d53f1] disabled:opacity-60">
              {publishing ? "공개하는 중…" : "지금 공개하기"}
            </button>
            <Link href={`/events/${id}/customers`} className="rounded-md border border-white/60 px-3 py-1.5 text-xs font-semibold">공개 설정으로 ↗</Link>
          </div>
        </div>
      )}
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
