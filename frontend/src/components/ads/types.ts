// 광고(ADS) API 타입 — backend/schemas.py 와 동일
export type AdPlatform = "naver" | "meta" | "daangn";
export interface AdChannel {
  platform: AdPlatform; name: string; product: string;
  mode: "live" | "sample" | "demo";
  status: "connected" | "permission_needed" | "disconnected" | "preparing";
  customer_id_tail: string; checked_at: string | null; message: string;
}
export interface AdSummary { impressions: number; clicks: number; cost: number; ctr: number; cpc: number }
export interface AdCampaign { id: string; name: string; status: string; daily_budget: number; impressions: number; clicks: number; cost: number }
export interface NaverStats { is_sample: boolean; since: string; until: string; summary: AdSummary; campaigns: AdCampaign[]; synced_at: string; conversion_tracking: boolean; message: string }
export interface NaverDraft {
  campaign_name: string; adgroup_name: string; keywords: { keyword: string; bid: number; monthly_search: number | null }[];
  title: string; description: string; region_suggestion: string; daily_budget: number;
  start_date: string | null; end_date: string | null; landing_url: string; warnings: string[]; is_fallback: boolean;
}
export interface DemoCampaign { platform: AdPlatform; name: string; channel: string; objective: string; daily_budget: number; creative: string; status_message: string; summary: AdSummary }
export const STATUS_TEXT: Record<AdChannel["status"], string> = { connected: "연결됨", permission_needed: "권한 필요", disconnected: "연결 안 됨", preparing: "준비 중" };
