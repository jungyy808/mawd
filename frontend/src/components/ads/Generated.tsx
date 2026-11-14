"use client";
// Figma: 홍보·광고 · 생성한 항목 (MKT-02) — 완료된 파워링크 문구 · 블로그 글 · 인스타그램 게시물만 보여준다.
import { useEffect, useState } from "react";
import { api, fmtDate } from "@/components/events/api";
import { Badge, Button, Card, CopyButton, Empty } from "@/components/events/ui";

export type ContentKind = "powerlink" | "blog" | "instagram";
export type ContentItem = { id: string; kind: ContentKind; title: string; body: string; url: string; image_url: string; tags: string[]; created_at: string };

export const KIND_LABEL: Record<ContentKind, string> = { powerlink: "네이버 파워링크", blog: "네이버 블로그", instagram: "인스타그램" };
export const CONTENTS_CHANGED = "mawd:contents-changed";

export async function saveContent(eventId: string, item: Omit<ContentItem, "id" | "created_at">) {
  const out = await api<ContentItem>(`/api/events/${eventId}/contents`, { method: "POST", json: item });
  window.dispatchEvent(new Event(CONTENTS_CHANGED));
  return out;
}

/** 블로그 본문의 "## 소제목"은 굵게, 나머지는 문단으로 */
export function Body({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-neutral-800">
      {text.split("\n").map((l, i) =>
        l.startsWith("#") ? <p key={i} className="pt-2 font-bold text-black">{l.replace(/^#+\s*/, "")}</p> : l.trim() ? <p key={i}>{l}</p> : null,
      )}
    </div>
  );
}

function Detail({ c }: { c: ContentItem }) {
  if (c.kind === "powerlink")
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
        <p className="text-xs text-neutral-500">광고 · {c.url.replace(/^https?:\/\//, "")}</p>
        <p className="mt-1 text-base font-bold text-[#1a0dab]">{c.title}</p>
        <p className="mt-1 text-neutral-700">{c.body}</p>
        <dl className="mt-3 grid grid-cols-[72px_1fr] gap-y-1 text-xs text-neutral-600">
          <dt>제목</dt><dd>{c.title}</dd>
          <dt>설명</dt><dd>{c.body}</dd>
          <dt>연결 URL</dt><dd className="break-all">{c.url}</dd>
        </dl>
      </div>
    );
  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      {c.image_url ? <img src={c.image_url} alt="" className="aspect-square w-full rounded-lg object-cover" /> : <div className="flex aspect-square items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-400">이미지 없음</div>}
      <div className="min-w-0">
        {c.title && <p className="text-lg font-bold">{c.title}</p>}
        <div className="mt-2"><Body text={c.body} /></div>
        {c.tags.length > 0 && <p className="mt-3 text-sm text-[#6d53f1]">{c.tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")}</p>}
        <div className="mt-3"><CopyButton text={[c.title, c.body, c.tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")].filter(Boolean).join("\n\n")} label="전체 복사" /></div>
      </div>
    </div>
  );
}

export default function Generated({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [filter, setFilter] = useState<"all" | ContentKind>("all");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const load = () => api<{ items: ContentItem[] }>(`/api/events/${eventId}/contents`).then((r) => setItems(r.items)).catch(() => setItems([]));
    load();
    window.addEventListener(CONTENTS_CHANGED, load);
    return () => window.removeEventListener(CONTENTS_CHANGED, load);
  }, [eventId]);

  const remove = async (id: string) => {
    await api(`/api/events/${eventId}/contents/${id}`, { method: "DELETE" }).catch(() => {});
    setItems((l) => (l ?? []).filter((x) => x.id !== id));
  };

  const shown = (items ?? []).filter((c) => filter === "all" || c.kind === filter);
  return (
    <Card title="생성한 항목" right={<span className="text-xs text-neutral-500">완료된 결과만 보여요</span>}>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["all", "powerlink", "blog", "instagram"] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filter === k ? "bg-[#6d53f1] text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
            {k === "all" ? "전체" : KIND_LABEL[k]}
          </button>
        ))}
      </div>
      {items && shown.length === 0 && (
        <Empty>아직 생성한 항목이 없어요. 파워링크를 신청하거나 블로그·인스타 초안을 저장하면 여기에 모여요.</Empty>
      )}
      <ul className="divide-y divide-neutral-100">
        {shown.map((c) => (
          <li key={c.id} className="py-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={c.kind === "powerlink" ? "green" : "blue"}>{KIND_LABEL[c.kind]}</Badge>
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{c.title || c.body.slice(0, 40)}</p>
              <span className="text-xs text-neutral-500">{fmtDate(c.created_at)}</span>
              <Button variant="secondary" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? "접기" : "결과 보기"}</Button>
              <button onClick={() => remove(c.id)} className="text-xs text-neutral-400 hover:text-red-600">삭제</button>
            </div>
            {open === c.id && <div className="mt-3 rounded-xl bg-neutral-50 p-4"><Detail c={c} /></div>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
