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
    NaverRegisterIn, NaverRegisterOut, RegisterStep,
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
    # 키 없이 연결했다가 나중에 키를 넣은 경우: 실제로 다시 확인해서 안내 문구를 바꾼다
    if naver.enabled() and "샘플" in (conn["message"] or ""):
        try:
            naver.list_campaigns(conn["customer_id"])
            db.save_ad_connection(store_id, "naver", conn["customer_id"], "connected", "캠페인·성과 조회 가능")
        except naver.NaverError as e:
            log.warning("네이버 재확인 실패: %s", e)
            db.save_ad_connection(store_id, "naver", conn["customer_id"], "permission_needed",
                                  "권한 확인 필요 · 계정 번호와 서비스 계정 초대 상태를 확인한 뒤 다시 시도하세요.")
        conn = db.get_ad_connection(store_id, "naver")
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
    if body.start_date and body.end_date and body.start_date > body.end_date:
        raise HTTPException(422, {"code": "invalid_period", "message": "종료일이 시작일보다 빨라요. 기간을 확인해 주세요."})
    if body.daily_budget <= 0:
        raise HTTPException(422, {"code": "invalid_budget", "message": "일예산을 입력해 주세요."})
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
                                 naver_draft_user_prompt(store, ev, products,
                                                         f"{body.goal}" + (f" / 강조할 내용: {body.emphasis}" if body.emphasis else "")
                                                         + (f" / 광고 기간: {body.start_date}~{body.end_date}" if body.start_date else ""),
                                                         body.product_name))
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


# ---------- 파워링크 등록 (중지 상태) ----------

@router.post("/naver/register", response_model=NaverRegisterOut,
             summary="AI 초안을 네이버에 '중지 상태'로 등록 (광고비 안 나감, 집행은 네이버 광고 관리자에서 직접)")
def naver_register(body: NaverRegisterIn, store: dict = Depends(current_store)):
    conn = db.get_ad_connection(store["id"], "naver")
    live = naver.enabled() and conn and conn["status"] == "connected"
    stamp = datetime.now(timezone(timedelta(hours=9))).strftime("%m%d-%H%M")
    camp_name = _clip(f"{body.campaign_name} ({stamp})", 30)
    title, desc = _clip(body.title or body.campaign_name, 15), _clip(body.description or store["name"], 45)
    keywords = [k for k in body.keywords if k.keyword.strip()][:20]

    if not live:
        # 키·연결이 없으면 실제 호출 없이 등록 순서만 보여준다 (시연용)
        steps = [RegisterStep(step=s, ok=True, message="샘플 · 실제로 등록하지 않았어요") for s in
                 ("캠페인 생성 (중지)", "비즈채널 확인", "광고그룹 생성 (중지)", f"키워드 {len(keywords)}개 등록", "광고 문구 등록")]
        return NaverRegisterOut(status="ok", is_sample=True, steps=steps,
                                message="네이버 계정이 연결되지 않아 샘플로 보여드렸어요. 계정을 연결하면 실제로 중지 상태로 등록돼요.")

    cid = conn["customer_id"]
    steps: list[RegisterStep] = []

    # 같은 신청(request_id)을 다시 보내면: 완료된 건 저장된 결과를 그대로, 중간에 멈춘 건 만든 캠페인을 이어서 쓴다
    prev = db.get_ad_registration(store["id"], body.request_id) if body.request_id else None
    if prev and prev["status"] == "ok":
        return NaverRegisterOut.model_validate_json(prev["result"])
    reuse_campaign = prev["campaign_id"] if prev and prev["campaign_id"] else ""

    def remember(out: NaverRegisterOut) -> NaverRegisterOut:
        if body.request_id:
            db.save_ad_registration(store["id"], body.request_id, out.campaign_id, out.status, out.model_dump_json())
        return out

    def fail(step: str, e: Exception, campaign_id: str = "") -> NaverRegisterOut:
        log.warning("파워링크 등록 실패 (%s): %s", step, e)
        steps.append(RegisterStep(step=step, ok=False, message=str(e)))
        return remember(NaverRegisterOut(status="partial" if campaign_id else "failed", is_sample=False, campaign_id=campaign_id,
                                steps=steps, message=f"'{step}' 단계에서 멈췄어요. 이전 단계까지는 네이버에 등록됐어요."
                                if campaign_id else "네이버에 등록하지 못했어요."))

    # 1) 캠페인 (중지 상태: userLock=true) — 이전 시도에서 만든 캠페인이 있으면 재사용
    if reuse_campaign:
        campaign_id = reuse_campaign
        steps.append(RegisterStep(step="캠페인 생성 (중지)", ok=True, message="이전 신청에서 만든 캠페인 사용", id=campaign_id))
    else:
        try:
            camp = naver.send_json("POST", "/ncc/campaigns", cid, {
                "customerId": int(cid), "name": camp_name, "campaignTp": "WEB_SITE",
                "dailyBudget": body.daily_budget, "useDailyBudget": body.daily_budget > 0, "userLock": True,
            })
            campaign_id = camp.get("nccCampaignId", "")
            if not camp.get("userLock", True):
                naver.send_json("PUT", f"/ncc/campaigns/{campaign_id}", cid,
                                {"nccCampaignId": campaign_id, "userLock": True}, {"fields": "userLock"})
            steps.append(RegisterStep(step="캠페인 생성 (중지)", ok=True, message=camp_name, id=campaign_id))
        except naver.NaverError as e:
            return fail("캠페인 생성 (중지)", e)

    # 2) 비즈채널 (웹사이트) — 광고그룹에 꼭 필요
    try:
        chans = [c for c in naver.list_channels(cid) if c.get("channelTp") == "SITE"]
        if not chans:
            raise naver.NaverError("등록된 웹사이트 비즈채널이 없어요. 네이버 광고 관리자 > 정보 관리 > 비즈채널 관리에서 사이트를 추가하세요.")
        chan = next((c for c in chans if str(c.get("inspectStatus", "")).upper() in ("APPROVED", "ELIGIBLE")), chans[0])
        chan_id = chan.get("nccBusinessChannelId", "")
        steps.append(RegisterStep(step="비즈채널 확인", ok=True, message=chan.get("name") or chan.get("channelKey", ""), id=chan_id))
    except naver.NaverError as e:
        return fail("비즈채널 확인", e, campaign_id)

    # 3) 광고그룹 (중지)
    try:
        bid = max([k.bid for k in keywords] or [300])
        grp = naver.send_json("POST", "/ncc/adgroups", cid, {
            "nccCampaignId": campaign_id, "name": _clip(body.adgroup_name, 30), "adgroupType": "WEB_SITE",
            "pcChannelId": chan_id, "mobileChannelId": chan_id, "bidAmt": bid,
            "dailyBudget": body.daily_budget, "useDailyBudget": body.daily_budget > 0, "userLock": True,
        })
        group_id = grp.get("nccAdgroupId", "")
        steps.append(RegisterStep(step="광고그룹 생성 (중지)", ok=True, message=body.adgroup_name, id=group_id))
    except naver.NaverError as e:
        return fail("광고그룹 생성 (중지)", e, campaign_id)

    # 4) 키워드
    try:
        if keywords:
            naver.send_json("POST", "/ncc/keywords", cid,
                            [{"keyword": k.keyword, "bidAmt": k.bid, "useGroupBidAmt": False, "userLock": False} for k in keywords],
                            {"nccAdgroupId": group_id})
        steps.append(RegisterStep(step=f"키워드 {len(keywords)}개 등록", ok=True, message=", ".join(k.keyword for k in keywords[:5])))
    except naver.NaverError as e:
        return fail(f"키워드 {len(keywords)}개 등록", e, campaign_id)

    # 5) 광고 문구 (텍스트 소재)
    try:
        if not body.landing_url:
            raise naver.NaverError("연결 URL이 없어 광고 문구를 등록하지 않았어요.")
        naver.send_json("POST", "/ncc/ads", cid, {
            "type": "TEXT_45", "nccAdgroupId": group_id,
            "ad": {"headline": title, "description": desc, "pc": {"final": body.landing_url}, "mobile": {"final": body.landing_url}},
        })
        steps.append(RegisterStep(step="광고 문구 등록", ok=True, message=f"{title} / {desc}"))
    except naver.NaverError as e:
        return fail("광고 문구 등록", e, campaign_id)

    return remember(NaverRegisterOut(status="ok", is_sample=False, campaign_id=campaign_id, steps=steps,
                            message="네이버에 중지 상태로 등록했어요. 광고비는 나가지 않아요. 집행하려면 네이버 광고 관리자에서 직접 켜세요."))


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
