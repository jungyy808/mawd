"use client";
// Figma: 블로그·인스타 게시물 만들기 → 네이버 블로그 · 이미지와 글 / 인스타그램 · 이미지와 캡션 → 초안 저장 완료 · 캘린더 반영
import { useRef, useState } from "react";
import { api } from "@/components/events/api";
import { useEvent } from "@/components/events/EventShell";
import { Badge, Button, Card, CopyButton, ErrorBox, Field, inputCls } from "@/components/events/ui";
import { Body, saveContent } from "@/components/ads/Generated";

type Blog = { title: string; body: string; tags: string[]; cta: string };
type Insta = { caption: string; hashtags: string[]; shot_list: string[] };
type ContentOut = { blog: Blog | null; instagram: Insta | null; image_url: string | null; is_fallback: boolean };
type Channel = "all" | "blog" | "instagram";

const hash = (t: string[]) => t.map((x) => (x.startsWith("#") ? x : `#${x}`)).join(" ");

function daysBefore(start: string, day: string) {
  return Math.round((new Date(start).getTime() - new Date(day).getTime()) / 86400000);
}

function Actions({ onSave, onSchedule, saved, scheduled, canSchedule }: {
  onSave: () => Promise<void>; onSchedule: (d: string) => Promise<void>; saved: boolean; scheduled: string; canSchedule: boolean;
}) {
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<void>) => { setBusy(true); try { await f(); } finally { setBusy(false); } };
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
      <Button onClick={() => run(onSave)} disabled={busy || saved}>{saved ? "초안 저장됨 ✓" : "초안 저장"}</Button>
      {canSchedule ? (
        <>
          <div className="w-44"><input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={inputCls} aria-label="발행일" /></div>
          <Button variant="secondary" onClick={() => run(() => onSchedule(day))} disabled={busy || !day || scheduled === day}>
            {scheduled === day && day ? "캘린더에 추가됨 ✓" : "캘린더에 발행 일정 추가"}
          </Button>
        </>
      ) : (
        <span className="text-xs text-neutral-500">행사 시작일을 넣으면 발행 일정을 캘린더에 추가할 수 있어요.</span>
      )}
    </div>
  );
}

export default function ContentPage() {
  const { ev } = useEvent();
  const [channel, setChannel] = useState<Channel>("all");
  const [desc, setDesc] = useState("");
  const [keyword, setKeyword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [out, setOut] = useState<ContentOut | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [sched, setSched] = useState<Record<string, string>>({});
  const [aiImg, setAiImg] = useState("");
  const [imgBusy, setImgBusy] = useState(false);
  const [imgErr, setImgErr] = useState("");

  // 사진을 안 올렸으면 LINER Images API로 대표·피드 이미지를 만든다 (30초~1분 이상 걸릴 수 있음)
  const makeImage = async () => {
    setImgBusy(true); setImgErr("");
    try {
      const r = await api<{ image_url: string }>("/api/content/image", {
        method: "POST", timeoutMs: 200000,
        json: { event_id: ev.id, channel: channel === "blog" ? "blog" : "instagram", hint: [desc, keyword].filter(Boolean).join(" · ") },
      });
      setAiImg(r.image_url);
    } catch (e) {
      setImgErr((e as Error).message);
    } finally {
      setImgBusy(false);
    }
  };

  const generate = async () => {
    if (!desc.trim()) { setError("어떤 내용을 알릴지 적어 주세요."); return; }
    setBusy(true); setError(""); setSaved({}); setSched({}); setAiImg("");
    const fd = new FormData();
    fd.append("description", desc.trim());
    fd.append("channel", channel);
    fd.append("goal_keyword", keyword.trim());
    fd.append("event_id", ev.id);
    if (file) fd.append("image", file);
    try {
      setOut(await api<ContentOut>("/api/content", { method: "POST", body: fd, timeoutMs: 90000 }));
    } catch (e) {
      setError((e as Error).message); // 입력은 그대로 유지
    } finally {
      setBusy(false);
    }
  };

  const schedule = async (key: string, title: string, day: string) => {
    if (!ev.start_date || !day) return;
    await api(`/api/events/${ev.id}/checklist`, { method: "POST", json: { title, d_minus: daysBefore(ev.start_date, day), category: "홍보" } });
    setSched((s) => ({ ...s, [key]: day }));
  };

  const img = out?.image_url || aiImg;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">블로그·인스타 게시물 만들기</h2>
        <Button variant="ghost" href={`/events/${ev.id}/promo`}>〈 홍보·광고로</Button>
      </div>

      <Card title="무엇을 만들까요?">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([["all", "블로그 + 인스타"], ["blog", "네이버 블로그"], ["instagram", "인스타그램"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setChannel(k)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${channel === k ? "bg-[#6d53f1] text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}>{l}</button>
            ))}
          </div>
          <p className="rounded-lg bg-[#6d53f1]/5 px-3 py-2 text-xs text-[#6d53f1]">
            {ev.name} · {ev.start_date ?? "날짜 미정"} · {ev.location || "장소 미정"}
            {ev.products.length > 0 && ` · 상품 ${ev.products.map((p) => p.name).join(", ")}`} 정보를 같이 참고해요.
          </p>
          <Field label="요구사항" required hint="예: 겨울 한정 포켓 노트 첫 공개, 방문 시 스티커 증정을 강조해 주세요">
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className={inputCls} placeholder="무엇을 알리고 싶은지 한두 문장으로 적어 주세요" />
          </Field>
          <Field label="키워드" hint="선택 · 예: 연남동 팝업, 다꾸">
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} className={inputCls} />
          </Field>
          <Field label="상품 이미지" hint="선택 · jpg/png/webp, 5MB 이하">
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
              {file && <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }} className="text-xs text-neutral-500 underline">빼기</button>}
            </div>
          </Field>
          {error && <ErrorBox message={error} />}
          <Button onClick={generate} disabled={busy}>{busy ? "AI가 작성 중… (20초 정도)" : out ? "다시 만들기" : "AI로 만들기"}</Button>
        </div>
      </Card>

      {out && !out.image_url && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#6d53f1]/30 bg-[#6d53f1]/5 px-5 py-4">
          <div className="text-sm">
            <p className="font-semibold text-[#6d53f1]">{aiImg ? "AI 이미지를 넣었어요" : "올린 사진이 없어요"}</p>
            <p className="mt-0.5 text-neutral-600">{imgErr || (imgBusy ? "LINER가 이미지를 그리는 중이에요. 1분 정도 걸릴 수 있어요." : "행사·상품 정보로 대표·피드 이미지를 AI로 만들 수 있어요.")}</p>
          </div>
          <Button onClick={makeImage} disabled={imgBusy}>{imgBusy ? "이미지 만드는 중…" : aiImg ? "이미지 다시 만들기" : "AI로 이미지 만들기"}</Button>
        </div>
      )}

      {out?.is_fallback && <p className="text-sm text-amber-700">AI 응답이 없어 기본 예시 문구로 채웠어요. 고쳐서 쓰거나 다시 만들어 보세요.</p>}

      {out?.blog && (
        <Card title="네이버 블로그 · 이미지와 글" right={<Badge tone="blue">미리보기</Badge>}>
          {img && <img src={img} alt="" className="mb-4 max-h-72 w-full rounded-lg object-cover" />}
          <p className="text-xl font-bold">{out.blog.title}</p>
          <div className="mt-3"><Body text={out.blog.body} /></div>
          {out.blog.cta && <p className="mt-3 text-sm font-semibold text-[#6d53f1]">{out.blog.cta}</p>}
          <p className="mt-3 text-sm text-neutral-500">{hash(out.blog.tags)}</p>
          <div className="mt-3"><CopyButton text={`${out.blog.title}\n\n${out.blog.body}\n\n${out.blog.cta}\n\n${hash(out.blog.tags)}`} label="글 전체 복사" /></div>
          <Actions
            saved={!!saved.blog} scheduled={sched.blog ?? ""} canSchedule={!!ev.start_date}
            onSave={async () => {
              const b = out.blog!;
              await saveContent(ev.id, { kind: "blog", title: b.title, body: b.cta ? `${b.body}\n\n${b.cta}` : b.body, url: "", image_url: img, tags: b.tags });
              setSaved((s) => ({ ...s, blog: true }));
            }}
            onSchedule={(d) => schedule("blog", `블로그 게시 · ${out.blog!.title}`, d)}
          />
        </Card>
      )}

      {out?.instagram && (
        <Card title="인스타그램 · 이미지와 캡션" right={<Badge tone="blue">미리보기</Badge>}>
          <div className="grid gap-4 md:grid-cols-[280px_1fr]">
            {img ? <img src={img} alt="" className="aspect-square w-full rounded-lg object-cover" /> : <div className="flex aspect-square items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-400">이미지를 첨부하면 피드 미리보기에 보여요</div>}
            <div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{out.instagram.caption}</p>
              <p className="mt-3 text-sm text-[#6d53f1]">{hash(out.instagram.hashtags)}</p>
              {out.instagram.shot_list.length > 0 && (
                <div className="mt-4 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
                  <p className="mb-1 font-semibold">촬영 구성</p>
                  <ol className="list-decimal space-y-0.5 pl-4">{out.instagram.shot_list.map((s, i) => <li key={i}>{s}</li>)}</ol>
                </div>
              )}
              <div className="mt-3"><CopyButton text={`${out.instagram.caption}\n\n${hash(out.instagram.hashtags)}`} label="캡션 복사" /></div>
            </div>
          </div>
          <Actions
            saved={!!saved.insta} scheduled={sched.insta ?? ""} canSchedule={!!ev.start_date}
            onSave={async () => {
              const g = out.instagram!;
              await saveContent(ev.id, { kind: "instagram", title: "", body: g.caption, url: "", image_url: img, tags: g.hashtags });
              setSaved((s) => ({ ...s, insta: true }));
            }}
            onSchedule={(d) => schedule("insta", `인스타 게시 · ${out.instagram!.caption.slice(0, 20)}`, d)}
          />
        </Card>
      )}

      {out && <p className="text-xs text-neutral-500">실제 게시는 네이버 블로그·인스타그램에서 직접 해 주세요. 저장한 초안은 홍보·광고 탭의 ‘생성한 항목’에서 다시 볼 수 있어요.</p>}
    </div>
  );
}
