import { pct, won } from "@/components/events/api";
import type { AdSummary } from "./types";

export function SummaryTiles({ s }: { s: AdSummary }) {
  const items = [
    ["노출", s.impressions.toLocaleString("ko-KR")],
    ["클릭", s.clicks.toLocaleString("ko-KR")],
    ["클릭률", pct(s.ctr)],
    ["평균 클릭 비용", won(s.cpc)],
    ["광고비", won(s.cost)],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-lg border border-neutral-200 p-3">
          <p className="text-xs text-neutral-500">{k}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{v}</p>
        </div>
      ))}
    </div>
  );
}
