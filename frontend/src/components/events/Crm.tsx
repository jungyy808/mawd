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

type Inquiry = { id: string; name: string; at: string; messages: { from: "user" | "bot" | "manager"; text: string }[] };
type Reply = { status: "auto" | "review" | "sent"; text: string; reason: string; sentAt?: string };

// 채널톡 Open API 키가 없어서 시연용 예시 문의를 쓴다 (화면에 ‘예시’로 표시)
const SAMPLE_INQUIRIES: Inquiry[] = [
  { id: "q1", name: "방문객 A", at: "12/05 10:12", messages: [{ from: "user", text: "주차 가능한가요? 차 가져가려고요." }] },
  { id: "q2", name: "방문객 B", at: "12/05 11:40", messages: [{ from: "user", text: "포켓 노트 다른 색도 현장에 있나요?" }] },
  { id: "q3", name: "방문객 C", at: "12/05 13:05", messages: [{ from: "user", text: "카드 결제 되나요?" }] },
];

function now() {
  const d = new Date();
  return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function InquiryBox({ ev, rulesVersion }: { ev: EventOut; rulesVersion: number }) {
  const [replies, setReplies] = useState<Record<string, Reply>>({});
  const [open, setOpen] = useState<string>(SAMPLE_INQUIRIES[0].id);
  const [draft, setDraft] = useState("");
  const [confirm, setConfirm] = useState(false);

  // 규칙이 바뀔 때마다 예시 문의를 다시 분류 (자동 응답 / 검토 대기)
  useEffect(() => {
    let alive = true;
    Promise.all(SAMPLE_INQUIRIES.map((q) =>
      api<TestOut>(`/api/events/${ev.id}/crm/rules/test`, { method: "POST", json: { message: q.messages[0].text } })
        .then((t) => [q.id, t] as const).catch(() => [q.id, null] as const),
    )).then((rows) => {
      if (!alive) return;
      setReplies((prev) => {
        const next = { ...prev };
        for (const [id, t] of rows) {
          if (prev[id]?.status === "sent" || !t) continue;
          next[id] = t.result === "auto" ? { status: "auto", text: t.answer, reason: t.reason } : { status: "review", text: "", reason: t.reason };
        }
        return next;
      });
    });
    return () => { alive = false; };
  }, [ev.id, rulesVersion]);

  const q = SAMPLE_INQUIRIES.find((x) => x.id === open)!;
  const r = replies[open];
  useEffect(() => { setDraft(replies[open]?.status === "review" ? "" : replies[open]?.text ?? ""); setConfirm(false); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = (x?: Reply) => (x?.status === "sent" ? "답변 전송됨" : x?.status === "auto" ? "자동 응답" : "검토 대기");
  const tone = (x?: Reply) => (x?.status === "sent" ? "green" : x?.status === "auto" ? "blue" : "amber") as "green" | "blue" | "amber";

  return (
    <Card title="문의 목록" right={<Badge tone="amber">예시 문의 · 채널톡 연결 전</Badge>}>
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <ul className="space-y-2">
          {SAMPLE_INQUIRIES.map((x) => (
            <li key={x.id}>
              <button onClick={() => setOpen(x.id)} className={`w-full rounded-lg border p-3 text-left text-sm ${open === x.id ? "border-[#6d53f1] bg-[#6d53f1]/5" : "border-neutral-200 hover:bg-neutral-50"}`}>
                <div className="flex items-center justify-between"><span className="font-semibold">{x.name}</span><Badge tone={tone(replies[x.id])}>{label(replies[x.id])}</Badge></div>
                <p className="mt-1 truncate text-neutral-600">{x.messages[0].text}</p>
                <p className="mt-1 text-xs text-neutral-400">{x.at} · {ev.name}</p>
              </button>
            </li>
          ))}
        </ul>

        <div className="rounded-xl bg-neutral-50 p-4">
          <p className="text-sm font-semibold">문의 상세 · {q.name}</p>
          <div className="mt-3 space-y-2 text-sm">
            {q.messages.map((m, i) => <p key={i} className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">{m.text}</p>)}
            {r?.status === "auto" && <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-[#6d53f1] px-3 py-2 text-white">{r.text}<span className="mt-1 block text-[10px] text-white/70">자동 응답 · 봇</span></p>}
            {r?.status === "sent" && <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-[#6d53f1] px-3 py-2 text-white">{r.text}<span className="mt-1 block text-[10px] text-white/70">담당자 답변 · {r.sentAt}</span></p>}
          </div>
          {r && <p className="mt-3 text-xs text-neutral-500">{r.reason}</p>}

          {r?.status === "review" && (
            <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4">
              <p className="text-sm font-semibold">담당자 검토</p>
              <textarea rows={3} className={inputCls} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="답변을 확인하고 입력하세요" />
              {!confirm ? (
                <Button onClick={() => setConfirm(true)} disabled={!draft.trim()}>답변 확인</Button>
              ) : (
                <div className="rounded-lg border border-[#6d53f1]/30 bg-white p-3 text-sm">
                  <p>이 답변을 {q.name}에게 보낼까요?</p>
                  <p className="mt-1 text-xs text-amber-700">채널톡 연결 전이라 실제로는 전송되지 않고 시연용으로 기록만 남아요.</p>
                  <div className="mt-2 flex gap-2">
                    <Button onClick={() => { setReplies((p) => ({ ...p, [open]: { status: "sent", text: draft.trim(), reason: "운영자가 검토 후 전송했어요 (시연 · 실제 전송 아님).", sentAt: now() } })); setConfirm(false); }}>전송</Button>
                    <Button variant="ghost" onClick={() => setConfirm(false)}>취소</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function Inquiries({ ev }: { ev: EventOut }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [kw, setKw] = useState("");
  const [ans, setAns] = useState("");
  const [msg, setMsg] = useState("");
  const [test, setTest] = useState<TestOut | null>(null);
  const [error, setError] = useState("");
  const [ver, setVer] = useState(0);
  const base = `/api/events/${ev.id}/crm/rules`;

  useEffect(() => { api<{ rules: Rule[] }>(base).then((r) => setRules(r.rules)).catch((e) => setError(e.message)); }, [base]);

  const run = async (f: () => Promise<{ rules: Rule[] } | undefined>) => {
    setError("");
    try { const r = await f(); if (r) setRules(r.rules); setVer((v) => v + 1); } catch (e) { setError((e as Error).message); }
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

      <InquiryBox ev={ev} rulesVersion={ver} />

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

type SendResult = { id: number; kind: "now" | "reserve"; subject: string; status: "accepted" | "reserved" | "failed"; at: string; when?: string };

function kstNowLocal() {
  const d = new Date(Date.now() + 9 * 3600000);
  return d.toISOString().slice(0, 16);
}

export function EmailSend({ ev }: { ev: EventOut }) {
  const [mode, setMode] = useState<"now" | "reserve" | null>(null);
  const [when, setWhen] = useState("");
  const [results, setResults] = useState<SendResult[]>([]);
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
  const ready = !!subject.trim() && !!body.trim() && !urlBad;
  const whenBad = mode === "reserve" && (!when || when <= kstNowLocal());
  const submit = () => {
    if (!mode) return;
    setResults((l) => [{ id: Date.now(), kind: mode, subject, status: mode === "now" ? "accepted" : "reserved", at: now(), when: mode === "reserve" ? when.replace("T", " ") : undefined }, ...l]);
    setMode(null);
  };

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
              <Button onClick={() => setMode("now")} disabled={!ready}>즉시 발송</Button>
              <Button variant="secondary" onClick={() => { setMode("reserve"); setWhen(""); }} disabled={!ready}>예약 발송</Button>
            </div>
            {mode && (
              <div className="rounded-xl border border-[#6d53f1]/40 bg-[#6d53f1]/5 p-4 text-sm">
                <p className="font-semibold">{mode === "now" ? "지금 발송할까요?" : "예약 발송할까요?"}</p>
                <ul className="mt-2 space-y-0.5 text-neutral-700">
                  <li>· 제목: {subject}</li>
                  <li>· 대상: {ev.name} 주소록 수신 동의자 (수신 거부·미동의 제외)</li>
                  <li>· 링크: {url.trim() || "없음"} · 수신 거부 안내 포함</li>
                </ul>
                {mode === "reserve" && (
                  <label className="mt-3 block">
                    <span className="text-xs text-neutral-600">발송 시각 (한국시간)</span>
                    <input type="datetime-local" className={`${inputCls} mt-1 max-w-[240px]`} value={when} onChange={(e) => setWhen(e.target.value)} />
                    {when && whenBad && <span className="mt-1 block text-xs text-red-600">지금보다 나중 시각을 골라 주세요.</span>}
                  </label>
                )}
                <p className="mt-3 text-xs text-amber-700">스티비 연결 전이라 실제로 보내지지 않고, 발송 결과 화면만 시연해요.</p>
                <div className="mt-3 flex gap-2">
                  <Button onClick={submit} disabled={whenBad}>{mode === "now" ? "발송 요청" : "예약하기"}</Button>
                  <Button variant="ghost" onClick={() => setMode(null)}>취소</Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card title="발송 결과" right={<Badge tone="amber">시연 · 실제 발송 아님</Badge>}>
        {results.length === 0 ? (
          <p className="text-sm text-neutral-500">아직 발송 요청이 없어요. 스티비가 연결되면 요청 접수 → 발송 완료(또는 실패)까지 상태를 조회해 보여줘요.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {results.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium">{x.subject}</p>
                  <p className="text-xs text-neutral-500">{x.kind === "now" ? `${x.at} 즉시 발송 요청` : `${x.when} 발송 예약 (요청 ${x.at})`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={x.status === "accepted" ? "blue" : x.status === "reserved" ? "green" : "red"}>
                    {x.status === "accepted" ? "발송 요청 접수" : x.status === "reserved" ? "예약됨" : "실패"}
                  </Badge>
                  {x.status === "reserved" && <button onClick={() => setResults((l) => l.filter((y) => y.id !== x.id))} className="text-xs text-neutral-400 hover:text-red-600">예약 취소</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-neutral-500">최종 발송 상태는 스티비 연결 후 이메일 ID로 조회해요. 상태가 불명확하면 조회한 뒤 다시 시도해요.</p>
      </Card>
    </div>
  );
}
