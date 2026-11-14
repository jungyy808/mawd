"use client";
// Figma 20:3481 행사 생성
// 링크(또는 행사명)로 공고 찾기 → 공고 고르기 → 아래 "가져온 행사 정보"에 채우기 → 다음으로(행사 저장 후 판매 상품 선택)
// 공고를 못 찾아도 아래 칸에 직접 입력해서 그대로 진행할 수 있다.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import arrowIcon from "@/assets/events/arrow-up-right.svg";
import dashIcon from "@/assets/events/range-dash.svg";
import {
  ApiError, type EventIn, type EventOut, type EventType, type ImportCandidate, type ImportField, type ImportResult, type ImportSearchOut,
  TYPE_LABEL, api, fmtRange,
} from "@/components/events/api";
import { Button, ErrorBox } from "@/components/events/ui";

type Step = "idle" | "searching" | "pick" | "reading" | "failed";

const EMPTY: EventIn = {
  name: "", type: "popup", start_date: null, end_date: null, location: "", hours: "", apply_deadline: "",
  load_in_time: "", fee: "", booth_size: "", expected_visitors: 0, source_url: "", status: "planning",
};

const fieldCls =
  "h-12 w-full rounded-[9px] bg-[#d9d9d9] px-4 text-[20px] text-black placeholder:font-medium placeholder:text-[#6e6d79] focus:outline-none focus:ring-2 focus:ring-[#6d53f1]";
const halfCls = `${fieldCls} min-w-0 flex-1 sm:w-[228px] sm:flex-none`;
const primaryBtn =
  "inline-flex h-11 shrink-0 items-center justify-center gap-[10px] whitespace-nowrap rounded-[7px] bg-[#6d53f1] text-base font-semibold text-white transition hover:bg-[#5b42e0] disabled:cursor-not-allowed disabled:opacity-40";

const isLink = (v: string) => /^(https?:\/\/|www\.)/i.test(v);

// "11:00–19:00" ↔ 시작·종료 두 칸 (운영 시간, 반입 시간). 둘로 나눌 수 없는 표기는 첫 칸에 그대로 둔다.
function splitRange(text: string): [string, string] {
  const parts = text.split(/\s*[–—~-]\s*/);
  return parts.length === 2 ? [parts[0], parts[1]] : [text, ""];
}
const joinRange = (from: string, to: string) => [from.trim(), to.trim()].filter(Boolean).join("–");

function Row({ label, check, children }: { label: string; check?: boolean; children: ReactNode }) {
  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-base font-semibold text-black">
        {label}
        {check && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">확인 필요</span>}
      </p>
      {children}
    </div>
  );
}

function Dash() {
  return <img src={dashIcon.src} alt="" width={18} height={2} className="shrink-0" />;
}

export default function EventNewPage() {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [notice, setNotice] = useState("");
  const [cands, setCands] = useState<ImportCandidate[]>([]);
  const [picked, setPicked] = useState("");
  const [form, setForm] = useState<EventIn>(EMPTY);
  const [hoursFrom, setHoursFrom] = useState("");
  const [hoursTo, setHoursTo] = useState("");
  const [loadFrom, setLoadFrom] = useState("");
  const [loadTo, setLoadTo] = useState("");
  const [fields, setFields] = useState<ImportField[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [mine, setMine] = useState<EventOut[]>([]);
  // 같은 저장 재요청(더블클릭·네트워크 재시도)은 같은 키 → 서버가 행사를 한 번만 만든다
  const requestId = useRef(""); // 처음 저장할 때 만들고, 재시도에는 같은 값을 쓴다 (렌더 중에 만들면 빌드가 막힘)
  const [dupId, setDupId] = useState("");

  // 이미 등록한 행사와 겹치는 공고 찾기: 같은 공고 주소이거나, 공고 제목에 내 행사 이름이 들어 있으면
  useEffect(() => { api<EventOut[]>("/api/events").then(setMine).catch(() => {}); }, []);
  const norm = (t: string) => t.replace(/[\s·×\-_()[\]]/g, "").toLowerCase();
  const already = (c: ImportCandidate) =>
    mine.find((e) => (e.source_url && e.source_url === c.url) || (norm(e.name).length >= 4 && norm(c.title).includes(norm(e.name))));
  const pickedCand = cands.find((c) => c.url === picked);
  const pickedDup = pickedCand ? already(pickedCand) : undefined;

  const busy = step === "searching" || step === "reading";
  const input = link.trim();
  // 칸 하나로 링크·행사명을 모두 받는다. 링크면 링크로만, 아니면 행사명으로만 찾는다.
  const linkUrl = isLink(input) ? (/^www\./i.test(input) ? `https://${input}` : input) : "";
  const urlErr = (() => {
    if (!linkUrl) return "";
    try {
      if (!new URL(linkUrl).hostname.includes(".")) throw new Error();
      return "";
    } catch {
      return "올바른 링크인지 확인해 주세요. https://로 시작하는 공고 주소를 붙여넣거나, 링크 대신 행사명을 입력하세요.";
    }
  })();
  const searchBody = () => (linkUrl ? { url: linkUrl, query: "" } : { url: "", query: input });

  const fail = (message: string) => {
    setNotice(message);
    setStep("failed");
  };

  const search = async () => {
    if (!input || busy || urlErr) return;
    setStep("searching");
    setNotice("");
    try {
      const r = await api<ImportSearchOut>("/api/events/import/search", { method: "POST", json: searchBody() });
      if (r.status === "failed" || r.candidates.length === 0) return fail(r.message);
      setCands(r.candidates);
      setPicked(r.candidates[0].url);
      setStep("pick");
    } catch (e) {
      fail((e as Error).message);
    }
  };

  const read = async () => {
    const chosen = cands.filter((c) => c.url === picked);
    setStep("reading");
    try {
      const r = await api<ImportResult>("/api/events/import", { method: "POST", json: { ...searchBody(), candidates: chosen } });
      if (r.status === "failed" || !r.draft) return fail(r.message);
      const draft = { ...EMPTY, ...r.draft };
      if (!draft.source_url) draft.source_url = linkUrl || (chosen[0]?.url ?? "");
      const [from, to] = splitRange(draft.hours);
      const [inFrom, inTo] = splitRange(draft.load_in_time);
      setForm(draft);
      setHoursFrom(from);
      setHoursTo(to);
      setLoadFrom(inFrom);
      setLoadTo(inTo);
      setFields(r.fields);
      setCands([]);
      setStep("idle");
    } catch (e) {
      fail((e as Error).message);
    }
  };

  const set = <K extends keyof EventIn>(k: K, v: EventIn[K]) => setForm((f) => ({ ...f, [k]: v }));
  // 가져온 뒤에만 표시: 공고에서 못 찾았고 아직 비어 있는 항목
  const check = (...keys: (keyof EventIn)[]) =>
    keys.some((k) => fields.find((f) => f.key === k)?.status === "missing" && !(k === "hours" ? hoursFrom || hoursTo : k === "load_in_time" ? loadFrom || loadTo : form[k]));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    setDupId("");
    try {
      if (!requestId.current) requestId.current = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const json = { ...form, hours: joinRange(hoursFrom, hoursTo), load_in_time: joinRange(loadFrom, loadTo), request_id: requestId.current, allow_duplicate: false };
      const ev = await api<EventOut>("/api/events", { method: "POST", json });
      router.push(`/events/${ev.id}/products`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "duplicate_event") setDupId(e.message.match(/ev_[a-z0-9]+/)?.[0] ?? "");
      setError((e as Error).message.replace(/\s*\(ev_[a-z0-9]+\)/, ""));
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[1093px] pb-10 md:ml-[33px] md:mt-5">
      <h1 className="text-[32px] font-bold leading-[38px] text-black">행사 생성</h1>
      <p className="mt-3 text-[20px] font-medium leading-6 text-[#6e6d79]">참가하려는 행사의 모집·참가 안내 페이지에서 정보를 가져와요</p>

      <section className="mt-[55px] rounded-[15px] bg-white px-5 pb-5 pt-7 shadow-[0px_0px_18px_2px_rgba(0,0,0,0.09)] sm:px-[35px]">
        <h2 className="text-[20px] font-semibold leading-6 text-black">행사 링크로 시작하기</h2>
        <input
          className={`${fieldCls} mt-5`}
          placeholder="행사 링크 붙여넣기"
          aria-label="행사 링크 또는 행사명"
          value={link}
          disabled={busy}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && search()}
        />

        {urlErr && <p className="mt-2 text-xs text-red-600">{urlErr}</p>}

        {busy && (
          <div className="mt-5 flex items-center gap-3 text-sm text-[#6e6d79]" role="status">
            <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#6d53f1]/20 border-t-[#6d53f1]" />
            {step === "searching"
              ? "공개된 모집 공고를 찾고 있어요. 5~15초 정도 걸려요."
              : "고른 공고에서 행사명·기간·장소·신청 마감 등을 읽고 있어요. 15~40초 정도 걸려요."}
          </div>
        )}

        {step === "failed" && (
          <p className="mt-5 text-sm text-neutral-600">
            {notice || "공고를 찾지 못했어요."} 공고가 비공개이거나 링크가 만료됐을 수 있어요. 링크 대신 행사명으로 다시 찾거나, 아래 칸에 직접 입력해도 돼요.
          </p>
        )}

        {step === "pick" && (
          <div className="mt-5">
            <p className="mb-3 text-sm text-[#6e6d79]">공고 {cands.length}개를 찾았어요. 참가하려는 행사의 공고를 골라 주세요. 연도와 장소를 꼭 확인하세요.</p>
            <ul className="space-y-2" role="radiogroup">
              {cands.map((c) => {
                const on = picked === c.url;
                return (
                  <li key={c.url}>
                    <label className={`flex cursor-pointer gap-3 rounded-[9px] border p-3 transition ${on ? "border-[#6d53f1] bg-[#6d53f1]/5 ring-1 ring-[#6d53f1]" : "border-neutral-200 bg-white hover:border-neutral-400"}`}>
                      <input type="radio" name="cand" className="mt-1 h-4 w-4 accent-[#6d53f1]" checked={on} onChange={() => setPicked(c.url)} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 font-semibold text-neutral-900">
                          {c.title}
                          {already(c) && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">이미 등록한 행사</span>}
                        </span>
                        <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-neutral-500">
                          <span className="text-[#03a94e]">{c.hostname}</span>
                          {c.date && <span>{c.date}</span>}
                          <a href={c.url} target="_blank" rel="noreferrer" className="underline" onClick={(e) => e.stopPropagation()}>원문 보기 ↗</a>
                        </span>
                        {c.description && <span className="mt-1 line-clamp-2 block text-sm text-neutral-600">{c.description}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {pickedDup && (
              <div className="mt-4 rounded-[9px] border border-amber-300 bg-amber-50 p-4 text-sm" role="alert">
                <p className="font-semibold text-amber-900">이미 등록한 행사예요</p>
                <p className="mt-1 text-amber-800">
                  「{pickedDup.name}」 {fmtRange(pickedDup.start_date, pickedDup.end_date)} 행사로 이미 등록돼 있어요. 같은 행사는 한 번만 등록할 수 있어요. 등록한 행사로 이동하거나 다른 공고를 골라 주세요.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button href={`/events/${pickedDup.id}`}>등록한 행사로 가기</Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-[29px] flex justify-end">
          {step === "pick" ? (
            <button type="button" onClick={read} disabled={!picked || !!pickedDup} className={`${primaryBtn} px-[14px]`}>
              <img src={arrowIcon.src} alt="" width={14} height={14} />
              이 공고로 정보 채우기
            </button>
          ) : (
            <button type="button" onClick={search} disabled={!input || busy || !!urlErr} className={`${primaryBtn} px-[14px]`}>
              <img src={arrowIcon.src} alt="" width={14} height={14} />
              {busy ? "가져오는 중…" : "행사 정보 가져오기"}
            </button>
          )}
        </div>
      </section>

      <h2 className="mt-[52px] text-[20px] font-semibold leading-6 text-black">가져온 행사 정보</h2>
      <section className="mt-5 space-y-6 rounded-[15px] bg-white px-5 pb-[49px] pt-[29px] sm:px-[35px]">
        <Row label="행사명" check={check("name")}>
          <input className={fieldCls} placeholder="행사명 입력" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Row>
        <Row label="유형">
          <select className={fieldCls} value={form.type} onChange={(e) => set("type", e.target.value as EventType)}>
            {(Object.keys(TYPE_LABEL) as EventType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </Row>
        <Row label="기간" check={check("start_date", "end_date")}>
          <div className="flex items-center gap-5">
            <input type="date" aria-label="시작일" className={halfCls} value={form.start_date ?? ""} onChange={(e) => set("start_date", e.target.value || null)} />
            <Dash />
            <input type="date" aria-label="종료일" className={halfCls} value={form.end_date ?? ""} onChange={(e) => set("end_date", e.target.value || null)} />
          </div>
        </Row>
        <Row label="장소" check={check("location")}>
          <input className={fieldCls} placeholder="주소 또는 행사장 입력" value={form.location} onChange={(e) => set("location", e.target.value)} />
        </Row>
        <Row label="운영 시간" check={check("hours")}>
          <div className="flex items-center gap-5">
            <input aria-label="운영 시작 시간" className={halfCls} placeholder="11:00" value={hoursFrom} onChange={(e) => setHoursFrom(e.target.value)} />
            <Dash />
            <input aria-label="운영 종료 시간" className={halfCls} placeholder="19:00" value={hoursTo} onChange={(e) => setHoursTo(e.target.value)} />
          </div>
        </Row>
        <Row label="참가 신청 마감" check={check("apply_deadline")}>
          <input className={`${fieldCls} sm:w-[228px]`} placeholder="2026-11-27 18:00" value={form.apply_deadline} onChange={(e) => set("apply_deadline", e.target.value)} />
        </Row>
        <Row label="반입 시간" check={check("load_in_time")}>
          <div className="flex items-center gap-5">
            <input aria-label="반입 시작 시간" className={halfCls} placeholder="09:00" value={loadFrom} onChange={(e) => setLoadFrom(e.target.value)} />
            <Dash />
            <input aria-label="반입 종료 시간" className={halfCls} placeholder="10:00" value={loadTo} onChange={(e) => setLoadTo(e.target.value)} />
          </div>
        </Row>
        <Row label="참가비" check={check("fee")}>
          <input className={`${fieldCls} sm:w-[228px]`} placeholder="금액 또는 무료" value={form.fee} onChange={(e) => set("fee", e.target.value)} />
        </Row>
      </section>

      {error && <div className="mt-4"><ErrorBox message={error} /></div>}
      {dupId && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" href={`/events/${dupId}`}>이미 있는 행사로 가기</Button>
        </div>
      )}
      <div className="mt-7 flex justify-end">
        <button type="button" onClick={save} disabled={!form.name.trim() || saving || busy} className={`${primaryBtn} w-[162px]`}>
          {saving ? "저장 중…" : "다음으로"}
        </button>
      </div>
    </div>
  );
}
