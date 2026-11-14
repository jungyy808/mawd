"""광고 (Figma: ADS). 네이버 검색광고 = 실연동 대상, 메타·당근 = 데모(샘플 데이터).
네이버 서비스 키(NAVER_ACCESS_LICENSE/SECRET)가 없으면 네이버도 샘플 데이터로 동작한다 (is_sample: true)."""
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

import db
import llm
import naver
from deps import current_store
from prompts import NAVER_DRAFT_SYSTEM, naver_draft_user_prompt
from schemas import (
    AdCampaign,
    AdChannel,
    AdSummary,
    DemoCampaign,
    DraftKeyword,
    NaverConnectIn,
    NaverDraftIn,
    NaverDraftOut,
    NaverStatsOut,
)

router = APIRouter(prefix="/api/ads", tags=["ads"])
log = logging.getLogger("mawd")
KST = timezone(timedelta(hours=9))

SAMPLE_CAMPAIGNS = [
    AdCampaign(id="sample-1", name="연남 팝업 홍보", status="중지", daily_budget=10000, impressions=4120, clicks=71, cost=12100),
    AdCampaign(id="sample-2", name="포켓 노트 판매", status="운영 중", daily_budget=8000, impressions=6100, clicks=115, cost=20300),
]


def _now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M")


def _tail(customer_id: str) -> str:
    return customer_id[-4:] if customer_id else ""


def _summary(campaigns: list[AdCampaign]) -> AdSummary:
    imp = sum(c.impressions for c in campaigns)
    clk = sum(c.clicks for c in campaigns)
    cost = sum(c.cost for c in campaigns)
    return AdSummary(impressions=imp, clicks=clk, cost=cost,
                     ctr=round(clk / imp, 4) if imp else 0.0, cpc=round(cost / clk) if clk else 0)


def _naver_channel(store_id: str) -> AdChannel:
    conn = db.get_ad_connection(store_id, "naver")
    mode = "live" if naver.enabled() else "sample"
    if not conn:
        return AdChannel(platform="naver", name="네이버 검색광고", product="파워링크", mode=mode, status="disconnected",
                         message="광고 계정 번호(CUSTOMER_ID)를 입력해 연결하세요.")
    return AdChannel(platform="naver", name="네이버 검색광고", product="파워링크", mode=mode, status=conn["status"],
                     customer_id_tail=_tail(conn["customer_id"]), checked_at=conn["checked_at"], message=conn["message"])


# ---------- 채널 ----------

@router.get("/channels", response_model=list[AdChannel], summary="광고 채널 목록과 연결 상태")
def list_channels(store: dict = Depends(current_store)):
    return [
        _naver_channel(store["id"]),
        AdChannel(platform="meta", name="메타 광고", product="Facebook · Instagram", mode="demo", status="preparing",
                  message="준비 중 · 계정 미연동. 데모 미리보기만 가능해요."),
        AdChannel(platform="daangn", name="당근 광고", product="지역 홍보", mode="demo", status="preparing",
                  message="준비 중 · 계정 미연동. 데모 미리보기만 가능해요."),
    ]


# ---------- 네이버 ----------

@router.post("/naver/connect", response_model=AdChannel, summary="네이버 검색광고 계정 연결 (CUSTOMER_ID 확인)")
def connect_naver(body: NaverConnectIn, store: dict = Depends(current_store)):
    cid = body.customer_id.strip()
    if not naver.enabled():
        db.save_ad_connection(store["id"], "naver", cid, "connected",
                              "서비스 API 키가 없어 샘플 데이터로 보여줘요. (화면 예시)")
        return _naver_channel(store["id"])
    try:
        naver.list_campaigns(cid)
        db.save_ad_connection(store["id"], "naver", cid, "connected", "캠페인·성과 조회 가능")
    except naver.NaverError as e:
        log.warning("네이버 연결 확인 실패: %s", e)
        db.save_ad_connection(store["id"], "naver", cid, "permission_needed",
                              "권한 확인 필요 · 계정 번호와 서비스 계정 초대 상태를 확인한 뒤 다시 시도하세요.")
    return _naver_channel(store["id"])


@router.delete("/naver/connect", response_model=AdChannel, summary="네이버 연결 해제")
def disconnect_naver(store: dict = Depends(current_store)):
    db.delete_ad_connection(store["id"], "naver")
    return _naver_channel(store["id"])


@router.get("/naver/stats", response_model=NaverStatsOut, summary="네이버 파워링크 최근 성과 (캠페인별)")
def naver_stats(days: int = Query(7, ge=1, le=90), store: dict = Depends(current_store)):
    today = datetime.now(KST).date()
    until = (today - timedelta(days=1)).isoformat()
    since = (today - timedelta(days=days)).isoformat()
    conn = db.get_ad_connection(store["id"], "naver")

    if not naver.enabled() or not conn or conn["status"] != "connected":
        msg = "화면 예시 · 샘플 데이터" if naver.enabled() is False else "네이버 계정을 연결하면 실제 성과가 보여요. (지금은 샘플)"
        return NaverStatsOut(is_sample=True, since=since, until=until, summary=_summary(SAMPLE_CAMPAIGNS),
                             campaigns=SAMPLE_CAMPAIGNS, synced_at=_now_kst(), message=msg)

    cid = conn["customer_id"]
    try:
        campaigns = []
        for c in naver.list_campaigns(cid):
            stat = naver.campaign_stats(cid, c.get("nccCampaignId", ""), since, until)
            campaigns.append(AdCampaign(
                id=c.get("nccCampaignId", ""),
                name=c.get("name", ""),
                status="중지" if c.get("userLock") else "운영 중",
                daily_budget=int(c.get("dailyBudget") or 0),
                impressions=int(stat.get("impCnt") or 0),
                clicks=int(stat.get("clkCnt") or 0),
                cost=int(stat.get("salesAmt") or 0),
            ))
        return NaverStatsOut(is_sample=False, since=since, until=until, summary=_summary(campaigns),
                             campaigns=campaigns, synced_at=_now_kst())
    except naver.NaverError as e:
        log.warning("네이버 성과 조회 실패: %s", e)
        empty = AdSummary(impressions=0, clicks=0, cost=0, ctr=0.0, cpc=0)
        return NaverStatsOut(is_sample=False, since=since, until=until, summary=empty, campaigns=[],
                             synced_at=conn["checked_at"] or "",
                             message="통계 조회에 실패했어요. 잠시 후 다시 조회해 주세요.")


def _clip(text: str, n: int) -> str:
    text = (text or "").strip()
    return text if len(text) <= n else text[:n]


@router.post("/naver/draft", response_model=NaverDraftOut, summary="AI 파워링크 캠페인 초안 (등록은 안 함)")
def naver_draft(body: NaverDraftIn, store: dict = Depends(current_store)):
    ev, products = None, []
    if body.event_id:
        ev = db.get_event(store["id"], body.event_id)
        if not ev:
            raise HTTPException(404, {"code": "event_not_found", "message": "행사를 찾을 수 없어요"})
        products = db.get_event_products(ev["id"])
    start = body.start_date or (ev and ev.get("start_date"))
    end = body.end_date or (ev and ev.get("end_date"))

    warnings, is_fallback = [], False
    try:
        data = llm.generate_json(NAVER_DRAFT_SYSTEM,
                                 naver_draft_user_prompt(store, ev, products, body.goal, body.product_name))
        keywords = []
        for k in data.get("keywords", [])[:8]:
            kw = str(k.get("keyword", "")).replace(" ", "").strip()
            if not kw:
                continue
            try:
                bid = max(70, min(int(k.get("bid") or 300), 100000))
            except (TypeError, ValueError):
                bid = 300
            keywords.append(DraftKeyword(keyword=kw, bid=bid))
        if not keywords:
            raise ValueError("키워드 없음")
        campaign_name = str(data.get("campaign_name") or "").strip() or f"{store['name']} 홍보"
        adgroup_name = str(data.get("adgroup_name") or "").strip() or "기본 그룹"
        title, desc = str(data.get("title") or ""), str(data.get("description") or "")
        region = str(data.get("region_suggestion") or "")
    except Exception as e:  # noqa: BLE001
        log.warning("파워링크 초안 실패, fallback 사용: %s", e)
        is_fallback = True
        base = ev["name"] if ev else store["name"]
        campaign_name, adgroup_name = f"{base} 홍보", "기본 그룹"
        kws = list(dict.fromkeys([base.replace(" ", ""), store["name"].replace(" ", ""),
                                  f"{store['category']}".replace(" ", "").replace("·", "")]))
        keywords = [DraftKeyword(keyword=k, bid=300 - 50 * i) for i, k in enumerate(kws) if k]
        title, desc = base, f"{store['name']}의 소식을 만나보세요."
        region = ""

    if len(title) > 15:
        warnings.append(f"제목이 15자를 넘어서 잘랐어요: {title}")
    if len(desc) > 45:
        warnings.append(f"설명이 45자를 넘어서 잘랐어요: {desc}")
    title, desc = _clip(title, 15), _clip(desc, 45)

    # 네이버 키워드 도구로 월간 검색수 붙이기 (연결돼 있을 때만, 실패해도 무시)
    conn = db.get_ad_connection(store["id"], "naver")
    if naver.enabled() and conn and conn["status"] == "connected":
        try:
            vol = {}
            for row in naver.keyword_tool(conn["customer_id"], [k.keyword for k in keywords]):
                def n(v):
                    return int(v) if str(v).isdigit() else 5  # "< 10" 같은 값은 5로
                vol[row.get("relKeyword", "")] = n(row.get("monthlyPcQcCnt")) + n(row.get("monthlyMobileQcCnt"))
            for k in keywords:
                k.monthly_search = vol.get(k.keyword)
        except naver.NaverError as e:
            log.warning("키워드 도구 실패: %s", e)
    if not body.landing_url:
        warnings.append("연결 URL이 비어 있어요. 방문객용 행사 안내 페이지 주소를 넣어 주세요.")

    return NaverDraftOut(campaign_name=campaign_name, adgroup_name=adgroup_name, keywords=keywords, title=title,
                         description=desc, region_suggestion=region, daily_budget=body.daily_budget,
                         start_date=start, end_date=end, landing_url=body.landing_url, warnings=warnings,
                         is_fallback=is_fallback)


# ---------- 메타·당근 데모 ----------

DEMOS = {
    "meta": DemoCampaign(platform="meta", name="겨울 팝업 인지도", channel="Facebook / Instagram", objective="인지도",
                         daily_budget=10000, creative="인스타 피드용 팝업 안내",
                         status_message="준비 중 · 연결, 등록, 집행은 사용할 수 없습니다.",
                         summary=AdSummary(impressions=15400, clicks=212, cost=58000, ctr=0.0138, cpc=274)),
    "daangn": DemoCampaign(platform="daangn", name="연남동 겨울 팝업", channel="당근 · 지역 홍보", objective="부스 방문",
                           daily_budget=10000, creative="동네 팝업 행사 소개",
                           status_message="준비 중 · 연결, 등록, 집행은 사용할 수 없습니다.",
                           summary=AdSummary(impressions=8900, clicks=267, cost=40000, ctr=0.03, cpc=150)),
}


@router.get("/demo/{platform}", response_model=DemoCampaign, summary="메타·당근 광고 데모 (샘플 데이터, 연동 없음)")
def ad_demo(platform: str, store: dict = Depends(current_store)):
    if platform not in DEMOS:
        raise HTTPException(404, {"code": "demo_not_found", "message": "meta 또는 daangn만 가능해요"})
    return DEMOS[platform]
