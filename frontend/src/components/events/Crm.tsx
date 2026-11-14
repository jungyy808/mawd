"use client";
// Figma 26 · 행사 문의 관리 / 채널톡 자동화 규칙 / 자동 응답 테스트 · 이메일 발송 / AI 본문 초안 / 발송 검토
import { useEffect, useState } from "react";
import { type EventOut, api, publicOrigin } from "@/components/events/api";
import { Badge, Button, Card, CopyButton, ErrorBox, Field, inputCls } from "@/components/events/ui";

type Rule = { id: string; keyword: string; answer: string; active: boolean };
type TestOut = { result: "auto" | "review"; rule: Rule | null; answer: string; reason: string };

type Inquiry = { id: string; name: string; at: string; messages: { from: "user" | "bot" | "manager"; text: string }[] };
type Reply = { status: "auto" | "review" | "sent"; text: string; reason: string; sentAt?: string };

// 채널톡 Open API 키가 없어 시연용 예시 문의를 쓴다 (키가 생기면 /open/v5/user-chats 조회로 교체)
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
    <Card title="문의 목록" right={<span className="text-xs text-neutral-500">이 행사로 들어온 문의</span>}>
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
                  <div className="mt-2 flex gap-2">
                    <Button onClick={() => { setReplies((p) => ({ ...p, [open]: { status: "sent", text: draft.trim(), reason: "운영자가 검토 후 답변을 보냈어요.", sentAt: now() } })); setConfirm(false); }}>전송</Button>
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
  const [storeUrl, setStoreUrl] = useState("");
  const [storeSaved, setStoreSaved] = useState(false);
  const [storeErr, setStoreErr] = useState("");
  useEffect(() => {
    api<{ store: { store_url?: string } }>("/api/stores/me").then((r) => {
      const u = r.store.store_url ?? "";
      setStoreUrl(u); setStoreSaved(!!u); if (u) setUrl((x) => x || u);
    }).catch(() => {});
  }, []);
  const saveStoreUrl = async () => {
    setStoreErr("");
    if (!isHttps(storeUrl.trim())) { setStoreErr("https:// 로 시작하는 주소를 넣어 주세요."); return; }
    try {
      await api("/api/stores/me", { method: "PATCH", json: { store_url: storeUrl.trim() } });
      setStoreSaved(true); setUrl(storeUrl.trim());
    } catch (e) { setStoreErr((e as Error).message); }
  };
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
      {error && <ErrorBox message={error} />}

      <Card title="온라인 스토어 링크" right={storeSaved ? <Badge tone="green">저장 완료</Badge> : undefined}>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1">
            <Field label="온라인 스토어 URL"><input className={inputCls} value={storeUrl} onChange={(e) => { setStoreUrl(e.target.value); setStoreSaved(false); }} placeholder="https://smartstore.naver.com/…" /></Field>
          </div>
          <Button onClick={saveStoreUrl} disabled={storeSaved || !storeUrl.trim()}>{storeSaved ? "저장됨 ✓" : "저장"}</Button>
        </div>
        {storeErr && <p className="mt-1 text-xs text-red-600">{storeErr}</p>}
        <p className="mt-2 text-xs text-neutral-500">저장하면 이메일 초안의 ‘온라인 스토어 보기’ 버튼 링크로 자동으로 들어가요.</p>
      </Card>

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
              <dt>대상</dt><dd>이 행사에서 구독한 수신 동의 고객 (수신 거부·미동의 제외)</dd>
              <dt>수신 거부</dt><dd>메일 하단에 수신 거부 링크가 자동으로 들어가요</dd>
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
                <div className="mt-3 flex gap-2">
                  <Button onClick={submit} disabled={whenBad}>{mode === "now" ? "발송 요청" : "예약하기"}</Button>
                  <Button variant="ghost" onClick={() => setMode(null)}>취소</Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card title="발송 결과">
        {results.length === 0 ? (
          <p className="text-sm text-neutral-500">아직 보낸 이메일이 없어요. 보내면 요청 접수 → 발송 완료(또는 실패)까지 여기서 확인할 수 있어요.</p>
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
        <p className="mt-3 text-xs text-neutral-500">발송 상태는 잠시 후 자동으로 갱신돼요.</p>
      </Card>
    </div>
  );
}


export function ApiStatus({ onGo }: { onGo: (tab: "inquiry" | "email") => void }) {
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-lg bg-neutral-50 p-3"><p className="text-xs text-neutral-500">{label}</p><p className="mt-0.5 text-sm font-medium">{value}</p></div>
  );
  return (
    <div className="space-y-4">
      <div><h2 className="text-xl font-bold">연결된 서비스</h2><p className="mt-1 text-sm text-neutral-600">이메일 발송과 문의 받기에 쓰는 서비스를 연결해요.</p></div>
      <Card title="스티비 · 이메일" right={<Badge tone="gray">연결 안 됨</Badge>}>
        <div className="space-y-2">
          <Row label="연결 상태" value="아직 연결하지 않았어요" />
          <Row label="할 수 있는 것" value="부스 QR로 모은 구독 고객에게 후속 이메일 보내기" />
          <Button onClick={() => onGo("email")}>이메일 탭 열기</Button>
        </div>
      </Card>
      <Card title="채널톡 · 문의" right={<Badge tone="gray">연결 안 됨</Badge>}>
        <div className="space-y-2">
          <Row label="연결 상태" value="아직 연결하지 않았어요" />
          <Row label="할 수 있는 것" value="방문객 문의를 행사별로 모아 보고 자주 묻는 질문에 자동으로 답하기" />
          <Button onClick={() => onGo("inquiry")}>문의 자동화 설정</Button>
        </div>
      </Card>
    </div>
  );
}

export function QrPrint({ ev, brand, onClose }: { ev: EventOut; brand: string; onClose: () => void }) {
  const target = ev.subscribe_url || `${publicOrigin()}/e/${ev.id}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&data=${encodeURIComponent(target)}`;
  const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
  const print = () => {
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    w.document.write(`<html><head><title>${esc(ev.name)} QR</title><style>body{font-family:sans-serif;text-align:center;padding:48px}h1{font-size:32px;margin:12px 0 24px}p{color:#555}</style></head><body>
      <p>${esc(brand)} · ${esc(ev.name)}</p><h1>${esc(brand)} 소식 받아보기</h1><img src="${qr}" width="320" height="320" onload="setTimeout(()=>window.print(),300)"/>
      <p style="margin-top:24px;font-size:18px;color:#111">QR을 스캔하고 이메일을 등록해 주세요.</p></body></html>`);
    w.document.close();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold">부스 QR 인쇄 미리보기</h2>
        <p className="mt-1 text-sm text-neutral-600">이 안내물을 인쇄해 부스에 비치해 주세요.</p>
        <div className="mt-4 rounded-xl border border-neutral-200 p-5 text-center">
          <p className="text-xs text-neutral-500">{brand} · {ev.name}</p>
          <p className="mt-2 text-lg font-bold">{brand} 소식 받아보기</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="부스 QR" className="mx-auto mt-3 h-40 w-40" />
          <p className="mt-3 text-sm font-medium">QR을 스캔하고 이메일을 등록해 주세요.</p>
        </div>
        <p className="mt-3 text-xs text-neutral-500">{ev.subscribe_url ? "스티비 구독 폼으로 연결돼요." : "구독 폼이 없어 방문객 안내 페이지로 연결돼요. 구독 폼을 등록하면 그 주소로 바뀌어요."}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={print}>인쇄하기</Button>
          <Button variant="secondary" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </div>
  );
}
