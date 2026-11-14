"use client";
// Figma: 행사 생성 · 공고 링크 → Liner로 가져오기 / 가져오기 상태와 직접 입력
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IMPORT_KEY, type ImportResult, api } from "@/components/events/api";
import { Button, Card, Field, PageHeader, inputCls } from "@/components/events/ui";

export default function EventNewPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string>("");

  const start = async () => {
    setLoading(true);
    setFailed("");
    try {
      const r = await api<ImportResult>("/api/events/import", { method: "POST", json: { url, query } });
      if (r.status === "failed" || !r.draft) {
        setFailed(r.message);
      } else {
        sessionStorage.setItem(IMPORT_KEY, JSON.stringify({ ...r, url }));
        router.push("/events/new/review");
      }
    } catch (e) {
      setFailed((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const manual = () => {
    sessionStorage.setItem(IMPORT_KEY, JSON.stringify({ manual: true, url, query }));
    router.push("/events/new/review");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <div className="flex flex-col items-center py-12 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
            <p className="mt-5 text-lg font-semibold">공고 정보를 가져오는 중</p>
            <p className="mt-1 text-sm text-neutral-500">Liner로 공개 공고를 확인하고 있어요. 15~40초 정도 걸려요.</p>
            <p className="text-sm text-neutral-500">확인된 행사 정보가 표에 채워지면 검토 화면으로 이동합니다.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader crumb="EVT / 행사 생성" title="행사 생성" desc="참가하려는 행사의 모집·참가 안내 페이지에서 정보를 가져옵니다." />
      <p className="mb-4 text-sm text-neutral-500">
        <span className="font-semibold text-neutral-900">1 행사 정보</span>　→　2 판매 브랜드·상품
      </p>

      {failed ? (
        <Card title="공고를 읽지 못했어요">
          <p className="text-sm text-neutral-600">{failed}</p>
          <p className="mt-3 text-sm text-neutral-500">
            공고가 비공개이거나 로그인이 필요하거나, 링크가 만료됐을 수 있습니다. 입력한 링크와 행사명은 유지됩니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setFailed("")}>링크 수정·다시 시도</Button>
            <Button onClick={manual}>행사 정보 직접 입력</Button>
          </div>
        </Card>
      ) : (
        <Card title="행사 링크로 시작">
          <div className="space-y-4">
            <Field label="모집·참가 안내 링크" hint="주최 측의 공개 행사 공고">
              <input className={inputCls} placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            </Field>
            <Field label="행사명" hint="같이 입력하면 더 정확하게 찾아요 (링크 없이 행사명만으로도 가능)">
              <input className={inputCls} placeholder="예: 연남 겨울 팝업 참가자 모집" value={query} onChange={(e) => setQuery(e.target.value)} />
            </Field>
            <Button onClick={start} disabled={!url.trim() && !query.trim()} className="w-full">
              Liner로 가져오기
            </Button>
            <p className="text-xs text-neutral-500">공고의 행사명·기간·장소·신청 마감 등을 가져옵니다. 확인 후 다음 단계로 이동합니다.</p>
          </div>
        </Card>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        <button onClick={manual} className="text-neutral-600 underline">링크가 없나요? 직접 입력</button>
        <Button variant="ghost" href="/events">행사 목록으로 돌아가기</Button>
      </div>
    </div>
  );
}
