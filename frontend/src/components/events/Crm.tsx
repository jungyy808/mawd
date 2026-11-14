"use client";
// Figma 26 · 행사 문의 관리 / 채널톡 자동화 규칙 / 자동 응답 테스트 · 이메일 발송 / AI 본문 초안 / 발송 검토
import { useEffect, useState } from "react";
import { type EventOut, api } from "@/components/events/api";
import { Badge, Button, Card, CopyButton, ErrorBox, Field, inputCls } from "@/components/events/ui";

type Rule = { id: string; keyword: string; answer: string; active: boolean };
type TestOut = { result: "auto" | "review"; rule: Rule | null; answer: string; reason: string };

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">{title}</p>
      <div className="mt-1 space-y-1 text-amber-800">{children}</div>
    </div>
  );
}

export function Inquiries({ ev }: { ev: EventOut }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [kw, setKw] = useState("");
  const [ans, setAns] = useState("");
  const [msg, setMsg] = useState("");
  const [test, setTest] = useState<TestOut | null>(null);
  const [error, setError] = useState("");
  const base = `/api/events/${ev.id}/crm/rules`;

  useEffect(() => { api<{ rules: Rule[] }>(base).then((r) => setRules(r.rules)).catch((e) => setError(e.message)); }, [base]);

  const run = async (f: () => Promise<{ rules: Rule[] } | undefined>) => {
    setError("");
    try { const r = await f(); if (r) setRules(r.rules); } catch (e) { setError((e as Error).message); }
  };
  const add = () => run(async () => { const r = await api<{ rules: Rule[] }>(base, { method: "POST", json: { keyword: kw, answer: ans } }); setKw(""); setAns(""); return r; });
  const toggle = (r: Rule) => run(() => api<{ rules: Rule[] }>(`${base}/${r.id}`, { method: "PATCH", json: { active: !r.active } }));
  const remove = (r: Rule) => run(async () => { await api(`${base}/${r.id}`, { method: "DELETE" }); return { rules: rules.filter((x) => x.id !== r.id) }; });
  const runTest = async () => {
    setError("");
    try { setTest(await api<TestOut>(`${base}/test`, { method: "POST", json: { message: msg } })); } catch (e) { setError((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <Notice title="채널톡 연결 전 · 상담 목록은 아직 불러올 수 없어요">
        <p>상담 목록·답변 전송은 채널톡 Open API 키가 필요해요. Open API는 채널톡 <b>유료 플랜</b>에서만 발급돼요 (설정 → 보안 및 개발 → API → 새 인증 키).</p>
        <p>지금은 플러그인 키로 방문객 안내 페이지에 상담 버튼을 달고, 자동 응답 규칙을 미리 만들어 테스트할 수 있어요.</p>
        <a href="https://desk.channel.io" target="_blank" rel="noreferrer" className="inline-block font-semibold underline">채널톡 관리자 열기 ↗</a>
      </Notice>
      {error && <ErrorBox message={error} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="채널톡 자동화 규칙" right={<span className="text-xs text-neutral-500">켜진 규칙만 응답</span>}>
          <ul className="divide-y divide-neutral-100">
            {rules.length === 0 && <li className="py-2 text-sm text-neutral-500">아직 규칙이 없어요. 주차·결제·위치처럼 반복되는 문의부터 만들어 보세요.</li>}
            {rules.map((r) => (
              <li key={r.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">‘{r.keyword}’ 포함</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggle(r)} className={`rounded-full px-3 py-1 text-xs font-semibold ${r.active ? "bg-[#6d53f1] text-white" : "bg-neutral-200 text-neutral-600"}`}>{r.active ? "켜짐" : "꺼짐"}</button>
                    <button onClick={() => remove(r)} className="text-xs text-neutral-400 hover:text-red-600">삭제</button>
                  </div>
                </div>
                <p className="mt-1 text-neutral-600">→ {r.answer}</p>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
            <Field label="문의에 이 단어가 있으면" hint="쉼표로 여러 개 · 예: 주차, 주차장"><input className={inputCls} value={kw} onChange={(e) => setKw(e.target.value)} /></Field>
            <Field label="자동 응답"><textarea rows={2} className={inputCls} value={ans} onChange={(e) => setAns(e.target.value)} placeholder="예: 건물 지하 주차장 1시간 무료예요." /></Field>
            <Button onClick={add} disabled={!kw.trim() || !ans.trim()}>규칙 추가</Button>
          </div>
        </Card>

        <Card title="자동 응답 테스트">
          <Field label="방문객 문의 예시"><input className={inputCls} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="예: 주차 가능한가요?" /></Field>
          <Button className="mt-2" onClick={runTest} disabled={!msg.trim()}>테스트</Button>
          {test && (
            <div className={`mt-4 rounded-lg p-4 text-sm ${test.result === "auto" ? "bg-emerald-50" : "bg-neutral-100"}`}>
              <Badge tone={test.result === "auto" ? "green" : "gray"}>{test.result === "auto" ? "자동 응답" : "운영자 검토 대기"}</Badge>
              <p className="mt-2 text-neutral-700">{test.reason}</p>
              {test.answer && <p className="mt-2 rounded-lg bg-white p-3 font-medium">{test.answer}</p>}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function isHttps(u: string) {
  try { return new URL(u).protocol === "https:"; } catch { return false; }
}

export function EmailSend({ ev }: { ev: EventOut }) {
  const [purpose, setPurpose] = useState("방문 감사 · 온라인 스토어 안내");
  const [emphasis, setEmphasis] = useState("");
  const [tone, setTone] = useState("다정하게");
  const [sender, setSender] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fallback, setFallback] = useState(false);

  const draft = async () => {
    setBusy(true); setError("");
    try {
      const r = await api<{ subject: string; body: string; is_fallback: boolean }>(`/api/events/${ev.id}/crm/email/draft`, { method: "POST", json: { purpose, emphasis, tone } });
      setSubject(r.subject); setBody(r.body); setFallback(r.is_fallback);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const urlBad = url.trim() !== "" && !isHttps(url.trim());

  return (
    <div className="space-y-4">
      <Notice title="스티비 연결 전 · 실제 발송은 아직 안 돼요">
        <p>이메일 생성·발송·예약 API는 스티비 <b>프로 요금제 이상</b>, 구독자 조회는 <b>스탠다드 이상</b>에서만 쓸 수 있어요.</p>
        <p>지금은 본문을 만들어 복사한 뒤 스티비에서 직접 보낼 수 있어요. 구독 폼은 ‘부스 QR·구독’ 탭에서 연결해요{ev.subscribe_url ? " (연결됨)" : ""}.</p>
        <a href="https://stibee.com" target="_blank" rel="noreferrer" className="inline-block font-semibold underline">스티비 열기 ↗</a>
      </Notice>
      {error && <ErrorBox message={error} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="AI 본문 초안">
          <div className="space-y-3">
            <Field label="목적" required><input className={inputCls} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></Field>
            <Field label="강조 내용"><input className={inputCls} value={emphasis} onChange={(e) => setEmphasis(e.target.value)} placeholder="예: 스토어 첫 구매 10% 할인 코드 BOOTHY10" /></Field>
            <Field label="말투"><input className={inputCls} value={tone} onChange={(e) => setTone(e.target.value)} /></Field>
            <Button onClick={draft} disabled={busy || !purpose.trim()}>{busy ? "작성 중…" : subject ? "다시 만들기" : "AI로 본문 만들기"}</Button>
            <p className="text-xs text-neutral-500">AI에는 행사·상품 정보만 보내고 구독자 주소는 보내지 않아요.</p>
          </div>
        </Card>

        <Card title="발송 검토">
          <div className="space-y-3">
            <Field label="발신자"><input className={inputCls} value={sender} onChange={(e) => setSender(e.target.value)} placeholder="스티비에서 인증한 발신 이메일" /></Field>
            <Field label="제목"><input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
            <Field label="본문"><textarea rows={8} className={inputCls} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
            <Field label="스토어 URL 버튼" hint={urlBad ? "https:// 로 시작하는 주소만 넣을 수 있어요" : "예: https://smartstore.naver.com/…"}>
              <input className={`${inputCls} ${urlBad ? "border-red-400" : ""}`} value={url} onChange={(e) => setUrl(e.target.value)} />
            </Field>
            {fallback && <p className="text-xs text-amber-700">AI 응답이 없어 기본 문구로 채웠어요.</p>}
            <dl className="grid grid-cols-[80px_1fr] gap-y-1 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
              <dt>대상</dt><dd>행사 주소록의 수신 동의자 (스티비 연결 후 인원 표시 · 수신 거부·미동의 제외)</dd>
              <dt>수신 거부</dt><dd>스티비가 메일 하단에 수신 거부 링크를 자동으로 넣어요</dd>
            </dl>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={`${subject}\n\n${body}${url && !urlBad ? `\n\n스토어 바로가기: ${url}` : ""}`} label="본문 복사" />
              <Button disabled>즉시 발송 · 스티비 연결 필요</Button>
              <Button variant="secondary" disabled>예약 발송</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
