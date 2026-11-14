"use client";
// Figma: 행사 정보표 검토 / 행사 정보 직접 입력
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type EventIn, type EventOut, IMPORT_KEY, type ImportResult, api } from "@/components/events/api";
import { Badge, Button, Card, ErrorBox, PageHeader, inputCls } from "@/components/events/ui";

const EMPTY: EventIn = {
  name: "", type: "popup", start_date: null, end_date: null, location: "", hours: "", apply_deadline: "",
  load_in_time: "", fee: "", booth_size: "", expected_visitors: 0, source_url: "", status: "planning",
};

const ROWS: { key: keyof EventIn; label: string; required?: boolean; type?: "date" | "number" | "select"; placeholder?: string }[] = [
  { key: "name", label: "행사명", required: true, placeholder: "행사명 입력" },
  { key: "type", label: "행사 유형", required: true, type: "select" },
  { key: "start_date", label: "시작일", required: true, type: "date" },
  { key: "end_date", label: "종료일", required: true, type: "date" },
  { key: "location", label: "장소", required: true, placeholder: "주소 또는 행사장 입력" },
  { key: "hours", label: "운영 시간", placeholder: "예: 11:00–19:00" },
  { key: "apply_deadline", label: "참가 신청 마감", placeholder: "예: 2026-11-27 18:00" },
  { key: "load_in_time", label: "반입 시간", placeholder: "예: 09:00–10:00" },
  { key: "fee", label: "참가비", placeholder: "금액 또는 무료" },
  { key: "booth_size", label: "부스 크기", placeholder: "예: 2m × 2m" },
  { key: "expected_visitors", label: "예상 방문객", type: "number", placeholder: "명" },
];

type Stored = (ImportResult & { url?: string }) | { manual: true; url?: string; query?: string };

export default function EventReviewPage() {
  const router = useRouter();
  const [data, setData] = useState<Stored | null>(null);
  const [form, setForm] = useState<EventIn>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem(IMPORT_KEY);
    if (!raw) {
      router.replace("/events/new");
      return;
    }
    const d = JSON.parse(raw) as Stored;
    setData(d);
    if ("manual" in d) setForm({ ...EMPTY, name: d.query ?? "", source_url: d.url ?? "" });
    else if (d.draft) setForm({ ...EMPTY, ...d.draft });
  }, [router]);

  if (!data) return null;
  const imported = !("manual" in data) ? data : null;
  const statusOf = (k: keyof EventIn) => imported?.fields.find((f) => f.key === k)?.status;

  const set = (k: keyof EventIn, v: string) =>
    setForm((f) => ({ ...f, [k]: k === "expected_visitors" ? Number(v || 0) : k.endsWith("_date") ? v || null : v }));

  const missingRequired = ROWS.filter((r) => r.required && !form[r.key]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const ev = await api<EventOut>("/api/events", { method: "POST", json: form });
      sessionStorage.removeItem(IMPORT_KEY);
      router.push(`/events/${ev.id}/products`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        crumb="EVT / 행사 생성"
        title={imported ? "가져온 행사 정보 검토" : "행사 정보 직접 입력"}
        desc={imported ? "공고에서 찾은 내용을 확인하고 비어 있는 항목은 직접 입력하세요." : "필수 항목을 입력한 뒤 판매 브랜드와 상품을 선택하세요."}
      />

      {imported && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <p className="font-medium text-neutral-900">공고 출처</p>
              <p className="mt-1 text-neutral-500">
                분석 결과 {imported.fields.filter((f) => f.status === "found").length}개 / 확인 필요{" "}
                {imported.fields.filter((f) => f.status === "missing").length}개
              </p>
            </div>
            <Button variant="secondary" href="/events/new">다른 링크 사용</Button>
          </div>
          {imported.sources.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {imported.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-sky-700 underline">{s.title || s.url}</a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card title="행사 정보표">
        <div className="overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="w-40 px-3 py-2">항목</th>
                <th className="px-3 py-2">입력값</th>
                {imported && <th className="w-28 px-3 py-2">출처·상태</th>}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => {
                const st = statusOf(r.key);
                const val = form[r.key];
                return (
                  <tr key={r.key} className="border-t border-neutral-100">
                    <td className="px-3 py-2 font-medium text-neutral-700">
                      {r.label} {r.required && <span className="text-xs text-neutral-400">· 필수</span>}
                    </td>
                    <td className="px-3 py-2">
                      {r.type === "select" ? (
                        <select className={inputCls} value={String(val)} onChange={(e) => set(r.key, e.target.value)}>
                          <option value="popup">팝업스토어</option>
                          <option value="market">마켓</option>
                          <option value="booth">부스</option>
                        </select>
                      ) : (
                        <input
                          className={inputCls}
                          type={r.type === "number" ? "number" : r.type === "date" ? "date" : "text"}
                          placeholder={r.placeholder}
                          value={val === null || val === 0 ? "" : String(val)}
                          onChange={(e) => set(r.key, e.target.value)}
                        />
                      )}
                    </td>
                    {imported && (
                      <td className="px-3 py-2">
                        {st === "found" ? <Badge tone="green">공고</Badge> : <Badge tone="amber">확인 필요</Badge>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-neutral-500">자동 입력된 값도 수정할 수 있습니다.</p>
        {error && <div className="mt-3"><ErrorBox message={error} /></div>}
        <div className="mt-5 flex items-center justify-between gap-2">
          <p className="text-xs text-neutral-500">
            {missingRequired.length ? `필수 항목을 채우면 판매 설정으로 이동합니다: ${missingRequired.map((r) => r.label).join(", ")}` : ""}
          </p>
          <Button onClick={save} disabled={!form.name.trim() || saving}>
            {saving ? "저장 중…" : "확인하고 판매 설정 →"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
