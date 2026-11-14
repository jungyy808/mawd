"use client";
// Figma: 행사 생성 · 공고 링크/행사명 → 공고 후보 찾기 → 사용자가 고르기 → 정보 채우기 → 검토
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IMPORT_KEY, type ImportCandidate, type ImportResult, type ImportSearchOut, api } from "@/components/events/api";
import { Button, Card, Field, PageHeader, inputCls } from "@/components/events/ui";

type Step = "form" | "searching" | "pick" | "reading" | "failed";

function Loading({ title, desc }: { title: string; desc: string }) {
  return (
    <Card>
      <div className="flex flex-col items-center py-12 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#6d53f1]/20 border-t-[#6d53f1]" />
        <p className="mt-5 text-lg font-semibold">{title}</p>
        <p className="mt-1 text-sm text-neutral-500">{desc}</p>
      </div>
    </Card>
  );
}

export default function EventNewPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [failed, setFailed] = useState("");
  const [cands, setCands] = useState<ImportCandidate[]>([]);
  const [picked, setPicked] = useState<string>("");

  const search = async () => {
    setStep("searching");
    setFailed("");
    try {
      const r = await api<ImportSearchOut>("/api/events/import/search", { method: "POST", json: { url, query } });
      if (r.status === "failed" || r.candidates.length === 0) {
        setFailed(r.message);
        setStep("failed");
        return;
      }
      setCands(r.candidates);
      setPicked(r.candidates[0].url);
      setStep("pick");
    } catch (e) {
      setFailed((e as Error).message);
      setStep("failed");
    }
  };

  const read = async () => {
    const chosen = cands.filter((c) => c.url === picked);
    setStep("reading");
    try {
      const r = await api<ImportResult>("/api/events/import", { method: "POST", json: { url, query, candidates: chosen } });
      if (r.status === "failed" || !r.draft) {
        setFailed(r.message);
        setStep("failed");
      } else {
        sessionStorage.setItem(IMPORT_KEY, JSON.stringify({ ...r, url: url || chosen[0]?.url || "" }));
        router.push("/events/new/review");
      }
    } catch (e) {
      setFailed((e as Error).message);
      setStep("failed");
    }
  };

  const manual = () => {
    sessionStorage.setItem(IMPORT_KEY, JSON.stringify({ manual: true, url: url || picked, query }));
    router.push("/events/new/review");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader crumb="EVT / 행사 생성" title="행사 생성" desc="참가하려는 행사의 모집·참가 안내 페이지에서 정보를 가져옵니다." />
      <p className="mb-4 text-sm text-neutral-500">
        <span className={step === "form" || step === "searching" ? "font-semibold text-neutral-900" : ""}>1 공고 찾기</span>
        　→　<span className={step === "pick" || step === "reading" ? "font-semibold text-neutral-900" : ""}>2 공고 고르기</span>
        　→　3 정보 확인　→　4 판매 상품
      </p>

      {step === "searching" && <Loading title="공고를 찾는 중" desc="입력한 링크와 행사명으로 공개된 모집 공고를 찾고 있어요. 5~15초 정도 걸려요." />}
      {step === "reading" && <Loading title="행사 정보를 채우는 중" desc="고른 공고에서 행사명·기간·장소·신청 마감 등을 읽고 있어요. 15~40초 정도 걸려요." />}

      {step === "failed" && (
        <Card title="공고를 찾지 못했어요">
          <p className="text-sm text-neutral-600">{failed}</p>
          <p className="mt-3 text-sm text-neutral-500">공고가 비공개이거나 로그인이 필요하거나, 링크가 만료됐을 수 있어요. 입력한 내용은 그대로 있어요.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setStep(cands.length ? "pick" : "form")}>{cands.length ? "다른 공고 고르기" : "검색어 바꾸기"}</Button>
            <Button onClick={manual}>행사 정보 직접 입력</Button>
          </div>
        </Card>
      )}

      {step === "form" && (
        <Card title="참가할 행사 찾기">
          <div className="space-y-4">
            <Field label="행사명" hint="예: 서울일러스트레이션페어, 연남동 플리마켓 셀러 모집">
              <input className={inputCls} placeholder="예: 연남 겨울 팝업 참가자 모집" value={query} onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (url.trim() || query.trim()) && search()} />
            </Field>
            <Field label="모집·참가 안내 링크 (선택)" hint="링크가 있으면 더 정확하게 찾아요">
              <input className={inputCls} placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            </Field>
            <Button onClick={search} disabled={!url.trim() && !query.trim()} className="h-11 w-full">공고 찾기</Button>
          </div>
        </Card>
      )}

      {step === "pick" && (
        <Card title={`찾은 공고 ${cands.length}개`} right={<Button variant="ghost" onClick={() => setStep("form")}>다시 검색</Button>}>
          <p className="-mt-2 mb-3 text-sm text-neutral-500">참가하려는 행사의 공고를 골라 주세요. 연도와 장소를 꼭 확인하세요.</p>
          <ul className="space-y-2" role="radiogroup">
            {cands.map((c) => {
              const on = picked === c.url;
              return (
                <li key={c.url}>
                  <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${on ? "border-[#6d53f1] bg-[#6d53f1]/5 ring-1 ring-[#6d53f1]" : "border-neutral-200 bg-white hover:border-neutral-400"}`}>
                    <input type="radio" name="cand" className="mt-1 h-4 w-4 accent-[#6d53f1]" checked={on} onChange={() => setPicked(c.url)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-neutral-900">{c.title}</span>
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
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={read} disabled={!picked} className="h-11">이 공고로 정보 채우기</Button>
            <button onClick={manual} className="text-sm text-neutral-600 underline">원하는 공고가 없어요 · 직접 입력</button>
          </div>
        </Card>
      )}

      {step === "form" && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button onClick={manual} className="text-neutral-600 underline">공고가 없나요? 직접 입력</button>
          <Button variant="ghost" href="/events">내 행사로 돌아가기</Button>
        </div>
      )}
    </div>
  );
}
