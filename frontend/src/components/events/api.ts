// 행사·광고 화면 전용 API 클라이언트 (박정연)
// 은님의 lib/api.ts가 올라오면 거기로 바꿔도 되고, 이대로 써도 동작함.
// store_id 저장 키는 은님 lib/store.ts와 같아야 함 → 다르면 아래 STORE_KEY만 바꾸기
export const STORE_KEY = "mawd_store_id";
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function getStoreId(): string | null {
  if (typeof window === "undefined") return null;
  // 테스트용: 주소 뒤에 ?store=st_xxx 붙이면 저장됨
  const fromUrl = new URLSearchParams(window.location.search).get("store");
  if (fromUrl) localStorage.setItem(STORE_KEY, fromUrl);
  return localStorage.getItem(STORE_KEY);
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const { json, timeoutMs = 70000, headers, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const h: Record<string, string> = { ...(headers as Record<string, string>) };
  const sid = getStoreId();
  if (sid) h["X-Store-Id"] = sid;
  if (json !== undefined) h["Content-Type"] = "application/json";
  try {
    const res = await fetch(API_URL + path, {
      ...rest,
      headers: h,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      signal: ctrl.signal,
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data?.error ?? {};
      if (err.code === "store_not_found" || err.code === "store_id_missing") {
        window.localStorage.removeItem(STORE_KEY);
        window.location.href = "/onboarding";
      }
      throw new ApiError(res.status, err.code ?? "http_error", err.message ?? `요청 실패 (${res.status})`);
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === "AbortError") throw new ApiError(0, "timeout", "응답이 너무 오래 걸려요. 다시 시도해 주세요.");
    throw new ApiError(0, "network", "서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 타입 (backend/schemas.py와 같은 모양) ----------
export type EventType = "popup" | "market" | "booth";
export type EventStatus = "planning" | "preparing" | "done";

export interface EventIn {
  name: string;
  type: EventType;
  start_date: string | null;
  end_date: string | null;
  location: string;
  hours: string;
  apply_deadline: string;
  load_in_time: string;
  fee: string;
  booth_size: string;
  expected_visitors: number;
  source_url: string;
  status: EventStatus;
}

export interface EventProduct {
  product_id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  planned_qty: number;
  shortage: number;
}

export interface EventOut extends EventIn {
  id: string;
  d_day: number | null;
  checklist_done: number;
  checklist_total: number;
  is_public: boolean;
  subscribe_url: string;
  chat_plugin_key: string;
  notice: string;
  products: EventProduct[];
}

export interface ImportField {
  key: keyof EventIn;
  label: string;
  value: string | number | null;
  required: boolean;
  status: "found" | "missing";
}

export interface ImportResult {
  status: "ok" | "partial" | "failed";
  message: string;
  fields: ImportField[];
  draft: EventIn | null;
  sources: { title: string; url: string }[];
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  url: string;
  selling_point: string;
}

export interface PlanOut {
  expected_visitors: number;
  conditions: { purchase_rate: number; qty_per_purchase: number; buffer_qty: number };
  recommended_total: number;
  basis: string;
  products: { product_id: string; sku: string; name: string; stock: number; planned_qty: number; recommended_qty: number; shortage: number; basis: string }[];
  supplies: { id: string; name: string; needed: number; owned: number; shortage: number }[];
  warnings: string[];
}

export type CheckStatus = "todo" | "doing" | "done";
export interface ChecklistItem {
  id: string;
  title: string;
  d_minus: number | null;
  d_label: string;
  due_date: string | null;
  category: string;
  status: CheckStatus;
  source_url: string;
}
export interface ChecklistOut {
  done: number;
  total: number;
  items: ChecklistItem[];
  is_fallback: boolean;
  sources: { title: string; url: string }[];
}

export interface PublicEvent {
  id: string;
  brand_name: string;
  brand_intro: string;
  name: string;
  type: EventType;
  start_date: string | null;
  end_date: string | null;
  hours: string;
  location: string;
  notice: string;
  products: { name: string; price: number; selling_point: string }[];
  subscribe_url: string;
  chat_plugin_key: string;
}

// ---------- 공통 표시 ----------
export const TYPE_LABEL: Record<EventType, string> = { popup: "팝업스토어", market: "마켓", booth: "부스" };
export const STATUS_LABEL: Record<EventStatus, string> = { planning: "계획 중", preparing: "준비 중", done: "완료" };
export const won = (n: number) => `₩${(n ?? 0).toLocaleString("ko-KR")}`;
export const pct = (r: number) => `${(r * 100).toFixed(2).replace(/\.?0+$/, "")}%`;

export function fmtDate(d: string | null) {
  if (!d) return "날짜 미정";
  const [, m, day] = d.slice(0, 10).split("-");
  return `${Number(m)}.${day}`;
}
export function fmtRange(a: string | null, b: string | null) {
  if (!a) return "날짜 미정";
  return b && b !== a ? `${fmtDate(a)}–${fmtDate(b)}` : fmtDate(a);
}
export function dLabel(d: number | null) {
  if (d === null) return "";
  return d === 0 ? "D-DAY" : d > 0 ? `D-${d}` : `D+${-d}`;
}

export const IMPORT_KEY = "mawd_event_import"; // 가져오기 → 검토 화면 전달용 (sessionStorage)

// ---------- 행사 단계 (Figma: 준비 중 · 운영 중 · 종료) ----------
export type Phase = "준비 중" | "운영 중" | "종료";
export function phaseOf(ev: Pick<EventIn, "status" | "start_date" | "end_date">): Phase {
  const today = new Date().toISOString().slice(0, 10);
  if (ev.status === "done" || (ev.end_date && ev.end_date < today)) return "종료";
  if (ev.start_date && ev.start_date <= today && (!ev.end_date || today <= ev.end_date)) return "운영 중";
  return "준비 중";
}
export function phaseLabel(ev: EventOut): string {
  const p = phaseOf(ev);
  if (p === "준비 중" && ev.d_day !== null && ev.d_day >= 0) return `준비 중 · ${dLabel(ev.d_day)}`;
  if (p === "운영 중" && ev.start_date) {
    const n = Math.floor((Date.now() - new Date(ev.start_date).getTime()) / 86400000) + 1;
    return `운영 중 · 행사 ${n}일차`;
  }
  return p;
}

// ---------- 예산·손익 / 현장 판매 / 리포트 ----------
export interface Expense { id?: string; category: string; name: string; planned: number; actual: number }
export interface BudgetProduct { product_id: string; name: string; price: number; cost: number; prepared_qty: number; unit_margin: number; basis: string }
export interface BudgetOut {
  budget: number; target_profit: number; expenses: Expense[]; planned_total: number; actual_total: number;
  products: BudgetProduct[]; prepared_total: number; expected_revenue: number; expected_cost: number;
  avg_unit_margin: number; bep_budget: number | null; bep_actual: number | null; target_qty: number | null;
  full_sale_profit: number; basis: string; warnings: string[];
  has_budget: boolean; sold_qty: number; contribution_so_far: number; remaining_to_bep: number | null;
}
export interface StockRow { product_id: string; name: string; price: number; prepared_qty: number; received_qty?: number; sold_qty: number; remaining: number }
export interface SaleOut { id: string; payment_method: string; total: number; created_at: string; items: { product_id: string; name: string; qty: number; price: number }[] }
export interface SalesOut { sales: SaleOut[]; stock: StockRow[]; total_revenue: number; total_qty: number }
export interface ReportOut {
  revenue: number; sold_qty: number; goods_cost: number; expenses: number; profit: number; remaining_qty: number;
  stock: StockRow[]; target_qty: number | null; gap_qty: number | null; achievement_rate: number | null; target_is_set: boolean;
  by_payment: Record<string, number>; basis: string;
}
export const PAY_LABEL: Record<string, string> = { card: "카드", cash: "현금", transfer: "계좌이체" };
export const signedWon = (n: number) => (n < 0 ? `−${won(-n)}` : won(n));

// 방문객 안내 페이지·광고 연결 URL에 쓰는 공개 주소.
// localhost에서 작업해도 광고·QR에는 배포 주소가 들어가게 한다 (NEXT_PUBLIC_SITE_URL로 바꿀 수 있음).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://mawd-beta.vercel.app").replace(/\/$/, "");
export function publicOrigin(): string {
  if (typeof window === "undefined") return SITE_URL;
  const o = window.location.origin;
  return /localhost|127\.0\.0\.1|\[::1\]/.test(o) ? SITE_URL : o;
}

// 공고 후보 (행사 생성: 찾기 → 고르기 → 정보 채우기)
export interface ImportCandidate { title: string; url: string; hostname: string; description: string; date: string }
export interface ImportSearchOut { status: "ok" | "failed"; message: string; candidates: ImportCandidate[] }

// 발주·입고 (ORD-01)
export type OrderStatus = "planned" | "ordered" | "received";
export interface OrderOut {
  id: string; product_id: string; name: string; qty: number; supplier: string;
  order_date: string; expected_date: string; status: OrderStatus; received_qty: number; received_date: string | null;
}
export interface OrdersOut { orders: OrderOut[]; stock: StockRow[] }
export const ORDER_LABEL: Record<OrderStatus, string> = { planned: "발주 예정", ordered: "발주 완료", received: "입고 완료" };

// 행사를 지운 뒤: 사이드바 선택이 지운 행사였으면 비우고, 사이드바·홈이 목록을 다시 불러오게 알린다.
export function notifyEventDeleted(id: string) {
  try { if (localStorage.getItem("mawd_current_event") === id) localStorage.removeItem("mawd_current_event"); } catch {}
  window.dispatchEvent(new Event("mawd:events-changed"));
  window.dispatchEvent(new Event("mawd:event-picked"));
}
