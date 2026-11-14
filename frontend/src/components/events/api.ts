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
