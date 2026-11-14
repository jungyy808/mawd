"""API 요청·응답 모양. 여기가 프론트와의 계약이니 바꿀 때는 꼭 공지.
Figma 기획서 기준: 브랜드(=회원) 1 → 상품 N · 행사 N
"""
from typing import Literal

from pydantic import BaseModel, Field


class StoreIn(BaseModel):
    """브랜드 프로필 (Figma: BRD / 브랜드·상품 > 브랜드 프로필)"""

    name: str = Field(..., min_length=1, description="브랜드명", examples=["소소공방"])
    category: str = Field(..., min_length=1, description="업종", examples=["문구·굿즈"])
    intro: str = Field("", description="브랜드 소개", examples=["일상 기록용 문구"])
    tone: str = Field("차분하고 다정하게", description="말투 (자유 입력)", examples=["차분하고 다정하게"])
    target_customer: str = Field("", description="고객", examples=["기록 취미 고객"])
    sales_channel: str = Field("", description="판매 채널", examples=["스마트스토어"])
    region: str = Field("", description="주 활동 지역 (선택, 콘텐츠 지역 키워드에 사용)", examples=["서울 마포구"])
    monthly_budget: int = Field(0, ge=0, description="월 광고 예산(원, 선택)", examples=[300000])


class StoreUpdate(BaseModel):
    """브랜드 프로필 부분 수정. 보낸 필드만 바뀜."""

    name: str | None = Field(None, min_length=1)
    category: str | None = Field(None, min_length=1)
    intro: str | None = None
    tone: str | None = None
    target_customer: str | None = None
    sales_channel: str | None = None
    region: str | None = None
    monthly_budget: int | None = Field(None, ge=0)


class StoreOut(BaseModel):
    store_id: str
    store: StoreIn


Channel = Literal["all", "blog", "instagram"]


class InstagramContent(BaseModel):
    caption: str
    hashtags: list[str]
    shot_list: list[str] = Field(default_factory=list, description="피드·릴스 촬영 구성")


class BlogContent(BaseModel):
    title: str
    body: str
    tags: list[str]
    cta: str = Field("", description="행동 유도 문구 (방문·구매·구독)")


class ContentOut(BaseModel):
    instagram: InstagramContent | None = None
    blog: BlogContent | None = None
    image_url: str | None = None
    is_fallback: bool = False


# ---------- 상품 (Figma: BRD / 상품 목록·상품 세부 정보) ----------

class ProductIn(BaseModel):
    name: str = Field(..., min_length=1, description="상품명", examples=["포켓 노트"])
    sku: str = Field("", description="SKU", examples=["A-01"])
    price: int = Field(0, ge=0, description="가격(원)", examples=[12000])
    stock: int = Field(0, ge=0, description="현재고", examples=[30])
    url: str = Field("", description="상품 URL", examples=["https://smartstore.naver.com/..."])
    selling_point: str = Field("", description="소구점", examples=["가벼운 휴대성"])
    image_url: str = Field("", description="상품 사진 URL", examples=["https://.../note.jpg"])
    cost: int = Field(0, ge=0, description="원가(원) · 손익 계산용", examples=[5000])


class ProductUpdate(BaseModel):
    name: str | None = Field(None, min_length=1)
    sku: str | None = None
    price: int | None = Field(None, ge=0)
    stock: int | None = Field(None, ge=0)
    url: str | None = None
    selling_point: str | None = None
    cost: int | None = Field(None, ge=0)
    image_url: str | None = None


class ProductOut(ProductIn):
    id: str


# ---------- 행사 (Figma: EVT / 행사 정보표·판매 설정·행사 상세) ----------

EventType = Literal["popup", "market", "booth"]
EventStatus = Literal["planning", "preparing", "done"]


class EventIn(BaseModel):
    name: str = Field(..., min_length=1, description="행사명 · 필수", examples=["연남 겨울 팝업"])
    type: EventType = Field("popup", description="popup(팝업스토어) / market(마켓) / booth(부스)")
    start_date: str | None = Field(None, description="YYYY-MM-DD", examples=["2026-12-05"])
    end_date: str | None = Field(None, description="YYYY-MM-DD", examples=["2026-12-06"])
    location: str = Field("", description="장소", examples=["서울 마포구 연남동"])
    hours: str = Field("", description="운영 시간", examples=["11:00–19:00"])
    apply_deadline: str = Field("", description="참가 신청 마감", examples=["2026-11-27 18:00"])
    load_in_time: str = Field("", description="반입 시간", examples=["09:00–10:00"])
    fee: str = Field("", description="참가비 (금액 또는 무료)", examples=["무료"])
    booth_size: str = Field("", description="부스 크기", examples=["2m × 2m"])
    expected_visitors: int = Field(0, ge=0, description="예상 방문객", examples=[200])
    source_url: str = Field("", description="공고 링크")
    status: EventStatus = Field("planning", description="planning(계획 중) / preparing(준비 중) / done(완료)")


class EventCreateIn(EventIn):
    request_id: str = Field("", description="중복 저장 방지 키 (같은 저장 재요청은 같은 값 → 새로 만들지 않고 기존 행사 반환)")
    allow_duplicate: bool = Field(False, description="같은 이름·시작일 행사가 있어도 새로 만들기")


class EventUpdate(BaseModel):
    name: str | None = Field(None, min_length=1)
    type: EventType | None = None
    start_date: str | None = None
    end_date: str | None = None
    location: str | None = None
    hours: str | None = None
    apply_deadline: str | None = None
    load_in_time: str | None = None
    fee: str | None = None
    booth_size: str | None = None
    expected_visitors: int | None = Field(None, ge=0)
    source_url: str | None = None
    status: EventStatus | None = None
    is_public: bool | None = Field(None, description="방문객용 안내 페이지 공개 여부")
    subscribe_url: str | None = Field(None, description="스티비 구독 폼 URL")
    chat_plugin_key: str | None = Field(None, description="채널톡 플러그인 키")
    notice: str | None = Field(None, description="방문객 안내 문구 (FAQ·공지)")


class EventProductIn(BaseModel):
    product_id: str
    planned_qty: int = Field(0, ge=0, description="판매 예정 수량")


class EventProductOut(BaseModel):
    product_id: str
    sku: str
    name: str
    price: int
    stock: int = Field(description="가용 수량(현재고)")
    planned_qty: int = Field(description="판매 예정 수량")
    shortage: int = Field(description="추가 준비 필요 수량 = max(0, 판매 예정 - 가용)")
    image_url: str = Field("", description="상품 사진 URL")


class EventOut(EventIn):
    id: str
    d_day: int | None = Field(None, description="시작일까지 남은 일수 (지났으면 음수)")
    checklist_done: int = Field(0, description="준비 체크리스트 완료 수")
    checklist_total: int = Field(0, description="준비 체크리스트 전체 수 (Figma: 4 / 7 완료)")
    is_public: bool = False
    subscribe_url: str = ""
    chat_plugin_key: str = ""
    notice: str = ""
    products: list[EventProductOut] = Field(default_factory=list)


# ---------- 행사 공고 가져오기 (Liner) ----------

class ImportCandidate(BaseModel):
    title: str
    url: str
    hostname: str = ""
    description: str = ""
    date: str = ""


class EventImportIn(BaseModel):
    url: str = Field("", description="모집·참가 안내 링크", examples=["https://..."])
    query: str = Field("", description="행사명 등 검색어 (링크가 없거나 결과가 부족할 때)", examples=["연남 겨울 팝업 참가자 모집"])
    candidates: list[ImportCandidate] = Field(default_factory=list,
                                              description="사용자가 고른 공고 (있으면 다시 검색하지 않고 이것만 읽음)")


class ImportSearchOut(BaseModel):
    status: Literal["ok", "failed"]
    message: str
    candidates: list[ImportCandidate]


class ImportField(BaseModel):
    key: str
    label: str
    value: str | int | None
    required: bool
    status: Literal["found", "missing"]


class ImportSource(BaseModel):
    title: str
    url: str


class EventImportOut(BaseModel):
    status: Literal["ok", "partial", "failed"] = Field(
        description="ok: 필수 항목 다 찾음 / partial: 일부 확인 필요 / failed: 가져오기 실패 (직접 입력으로)"
    )
    message: str
    fields: list[ImportField] = Field(description="행사 정보표 (Figma: 항목 · 입력값 · 출처·상태)")
    draft: EventIn | None = Field(None, description="검토 후 그대로 POST /api/events 에 보내면 되는 값")
    sources: list[ImportSource] = Field(default_factory=list)



# ---------- 준비물·재고 계획 (Figma: 행사 상세 > 준비물·재고 계획) ----------

class PlanConditions(BaseModel):
    purchase_rate: float = Field(0.15, ge=0, le=1, description="예상 구매율 (0~1)")
    qty_per_purchase: int = Field(1, ge=1, description="구매당 수량")
    buffer_qty: int = Field(0, ge=0, description="상품별 여유분")


class PlanConditionsUpdate(BaseModel):
    purchase_rate: float | None = Field(None, ge=0, le=1)
    qty_per_purchase: int | None = Field(None, ge=1)
    buffer_qty: int | None = Field(None, ge=0)


class PlanProduct(BaseModel):
    product_id: str
    sku: str
    name: str
    stock: int = Field(description="가용 수량(현재고)")
    planned_qty: int = Field(description="판매 예정 수량")
    recommended_qty: int = Field(description="권장 수량 (방문객 × 구매율 × 구매당 수량 × 상품 비중 + 여유분)")
    shortage: int = Field(description="부족 수량 = max(0, max(판매 예정, 권장) − 가용)")
    basis: str = Field(description="산출 근거 문장")


class SupplyIn(BaseModel):
    name: str = Field(..., min_length=1, examples=["종이백"])
    needed: int = Field(0, ge=0, examples=[50])
    owned: int = Field(0, ge=0, examples=[30])


class SupplyOut(SupplyIn):
    id: str
    shortage: int


class PlanOut(BaseModel):
    expected_visitors: int
    conditions: PlanConditions
    recommended_total: int = Field(description="전체 권장 수량")
    basis: str = Field(description="예: 200명 × 구매율 15% × 1개 = 30개")
    products: list[PlanProduct]
    supplies: list[SupplyOut]
    warnings: list[str] = Field(default_factory=list)


# ---------- 준비 체크리스트 (Figma: 행사 상세 > 준비 체크리스트) ----------

ChecklistStatus = Literal["todo", "doing", "done"]


class ChecklistItemIn(BaseModel):
    title: str = Field(..., min_length=1, examples=["포장재 발주"])
    d_minus: int | None = Field(None, description="행사 시작 며칠 전 (D-10이면 10, 당일 0)", examples=[10])
    category: str = Field("", description="분류", examples=["배송"])
    status: ChecklistStatus = "todo"


class ChecklistItemUpdate(BaseModel):
    title: str | None = Field(None, min_length=1)
    d_minus: int | None = None
    category: str | None = None
    status: ChecklistStatus | None = None


class ChecklistItemOut(BaseModel):
    id: str
    title: str
    d_minus: int | None
    d_label: str = Field(description="D-14 / D-DAY / 날짜 미정")
    due_date: str | None = Field(description="시작일 − d_minus (YYYY-MM-DD)")
    category: str
    status: ChecklistStatus
    source_url: str


class ChecklistSuggestIn(BaseModel):
    use_liner: bool = Field(False, description="true면 Liner로 준비 팁을 검색해서 보강 (Figma: Liner로 준비 체크리스트 보강)")


class ChecklistOut(BaseModel):
    done: int
    total: int
    items: list[ChecklistItemOut]
    is_fallback: bool = False
    sources: list[ImportSource] = Field(default_factory=list)



# ---------- 광고 (Figma: ADS) ----------

AdPlatform = Literal["naver", "meta", "daangn"]


class AdChannel(BaseModel):
    platform: AdPlatform
    name: str
    product: str
    mode: Literal["live", "sample", "demo"] = Field(description="live: 실연동 / sample: 키 없어서 샘플 / demo: 데모 전용(연동 없음)")
    status: Literal["connected", "permission_needed", "disconnected", "preparing"]
    customer_id_tail: str = Field("", description="계정 끝자리 4자리")
    checked_at: str | None = None
    message: str = ""


class NaverConnectIn(BaseModel):
    customer_id: str = Field(..., min_length=3, description="네이버 검색광고 CUSTOMER_ID", examples=["1234567"])


class AdSummary(BaseModel):
    impressions: int
    clicks: int
    cost: int
    ctr: float = Field(description="0~1")
    cpc: int


class AdCampaign(BaseModel):
    id: str
    name: str
    status: str = Field(description="운영 중 / 중지 등")
    daily_budget: int
    impressions: int = 0
    clicks: int = 0
    cost: int = 0


class NaverStatsOut(BaseModel):
    is_sample: bool
    since: str
    until: str
    summary: AdSummary
    campaigns: list[AdCampaign]
    synced_at: str
    conversion_tracking: bool = False
    message: str = ""


class NaverDraftIn(BaseModel):
    event_id: str | None = Field(None, description="연결할 행사 (있으면 행사 정보·상품 반영)")
    goal: str = Field("행사 방문", description="목표", examples=["행사 방문"])
    product_name: str = Field("", description="광고 상품", examples=["포켓 노트"])
    daily_budget: int = Field(10000, ge=0)
    landing_url: str = Field("", description="연결 URL (예: 방문객용 안내 페이지)")
    start_date: str | None = None
    end_date: str | None = None
    emphasis: str = Field("", description="강조할 내용 (예: 현장 한정 할인, 신상 포켓 노트)")


class DraftKeyword(BaseModel):
    keyword: str
    bid: int
    monthly_search: int | None = Field(None, description="월간 검색수 (PC+모바일, 네이버 키워드 도구 연결 시)")


class NaverDraftOut(BaseModel):
    campaign_name: str
    adgroup_name: str
    keywords: list[DraftKeyword]
    title: str = Field(description="제목 (15자 이내)")
    description: str = Field(description="설명 (45자 이내)")
    region_suggestion: str = ""
    daily_budget: int
    start_date: str | None
    end_date: str | None
    landing_url: str
    warnings: list[str] = Field(default_factory=list)
    is_fallback: bool = False


class DemoCampaign(BaseModel):
    platform: AdPlatform
    name: str
    channel: str
    objective: str
    daily_budget: int
    creative: str
    status_message: str
    summary: AdSummary


# ---------- 방문객용 행사 안내 (Figma: 행사 안내와 방문객 접점) ----------

class PublicProduct(BaseModel):
    name: str
    price: int
    selling_point: str


class PublicEventOut(BaseModel):
    id: str
    brand_name: str
    brand_intro: str
    name: str
    type: str
    start_date: str | None
    end_date: str | None
    hours: str
    location: str
    notice: str
    products: list[PublicProduct]
    subscribe_url: str
    chat_plugin_key: str


# ---------- 홈 (Figma: 홈 = 지금 할 일 · 다가오는 마감 · 상품별 카드) ----------

class HomeEvent(BaseModel):
    id: str
    name: str
    start_date: str | None
    end_date: str | None
    d_day: int | None


class HomeTodo(BaseModel):
    id: str
    title: str
    done: bool = False


class HomeDeadline(BaseModel):
    id: str
    title: str
    due_date: str | None
    d_day: int | None


class HomeProductCard(BaseModel):
    id: str
    label: str = ""  # 카드에 보여줄 한 줄 (예: 준비 30개 · 남은 27개)


class HomeProduct(BaseModel):
    id: str
    name: str
    image_url: str | None = None
    cards: list[HomeProductCard]  # 상품 아래 카드 (Figma에 내용이 아직 없어 id만)


class HomeOut(BaseModel):
    event: HomeEvent | None
    todos: list[HomeTodo]
    deadlines: list[HomeDeadline]
    products: list[HomeProduct]
    is_sample: bool = False


# ---------- 예산·손익 (Figma: 39 예산·손익 / 40 예산·비용 입력) ----------

class ExpenseIn(BaseModel):
    category: str = Field("", description="분류", examples=["참가비"])
    name: str = Field(..., min_length=1, description="지출 항목", examples=["부스 참가비"])
    planned: int = Field(0, ge=0, description="예산(원)")
    actual: int = Field(0, ge=0, description="실제 지출(원)")


class ExpenseOut(ExpenseIn):
    id: str


class BudgetUpdate(BaseModel):
    budget: int | None = Field(None, ge=0, description="행사 예산 총액(원)")
    target_profit: int | None = Field(None, ge=0, description="목표 이익(원)")


class BudgetProductIn(BaseModel):
    product_id: str
    prepared_qty: int | None = Field(None, ge=0, description="준비 수량")
    price: int | None = Field(None, ge=0)
    cost: int | None = Field(None, ge=0)


class BudgetProduct(BaseModel):
    product_id: str
    name: str
    price: int
    cost: int
    prepared_qty: int
    unit_margin: int = Field(description="개당 이익 = 판매가 − 원가")
    basis: str


class BudgetOut(BaseModel):
    budget: int
    target_profit: int
    expenses: list[ExpenseOut]
    planned_total: int = Field(description="지출 예산 합계")
    actual_total: int = Field(description="실제 지출 합계")
    products: list[BudgetProduct]
    prepared_total: int
    expected_revenue: int
    expected_cost: int = Field(description="준비 수량 기준 상품 원가")
    avg_unit_margin: int
    bep_budget: int | None = Field(description="예산 기준 손익분기 판매 수량")
    bep_actual: int | None = Field(description="실제 지출 기준 손익분기 판매 수량")
    target_qty: int | None = Field(description="목표 이익까지 필요한 판매 수량")
    full_sale_profit: int = Field(description="준비 수량 전량 판매 시 예상 손익")
    basis: str
    warnings: list[str] = Field(default_factory=list)
    has_budget: bool = Field(True, description="예산·지출을 한 번이라도 입력했는지 (미입력이면 개요에 입력 안내)")
    sold_qty: int = 0
    contribution_so_far: int = Field(0, description="누적 공헌이익 = Σ 실판매 × (판매 당시 판매가 − 판매 당시 원가)")
    remaining_to_bep: int | None = Field(None, description="손익분기까지 남은 예상 판매량 (판매 전이면 예산 기준 손익분기)")


# ---------- 현장 판매 (Figma: 42 현장 판매 입력) ----------

class SaleItemIn(BaseModel):
    product_id: str
    qty: int = Field(..., ge=1)


class SaleIn(BaseModel):
    payment_method: Literal["card", "cash", "transfer"] = "card"
    items: list[SaleItemIn] = Field(..., min_length=1)


class SaleItemOut(BaseModel):
    product_id: str
    name: str
    qty: int
    price: int


class SaleOut(BaseModel):
    id: str
    payment_method: str
    total: int
    created_at: str
    items: list[SaleItemOut]


class StockRow(BaseModel):
    product_id: str
    name: str
    price: int
    prepared_qty: int
    received_qty: int = Field(0, description="입고 완료된 추가 수량")
    sold_qty: int
    remaining: int = Field(description="판매 가능 재고 = 배정 + 입고 − 판매")


class SalesOut(BaseModel):
    sales: list[SaleOut]
    stock: list[StockRow]
    total_revenue: int
    total_qty: int


# ---------- 성과·리포트 (Figma: 44 행사 마감 리포트) ----------

class ReportOut(BaseModel):
    revenue: int
    sold_qty: int
    goods_cost: int = Field(description="판매된 상품 원가")
    expenses: int = Field(description="실제 지출(없으면 예산)")
    profit: int
    remaining_qty: int
    stock: list[StockRow]
    target_qty: int | None
    gap_qty: int | None = Field(description="목표 대비 차이 (목표 − 판매)")
    achievement_rate: float | None = Field(None, description="목표 달성률 0~1 (목표 미설정이면 null)")
    target_is_set: bool = False
    by_payment: dict[str, int]
    basis: str


# ---------- 네이버 파워링크 등록 (Figma: 12 파워링크 등록 승인) ----------

class NaverRegisterIn(BaseModel):
    request_id: str = Field("", description="중복 등록 방지 키 (같은 초안의 재시도는 같은 값)")
    campaign_name: str = Field(..., min_length=1)
    adgroup_name: str = Field("기본 그룹")
    keywords: list[DraftKeyword] = Field(default_factory=list)
    title: str = Field("", description="제목 15자 이내")
    description: str = Field("", description="설명 45자 이내")
    daily_budget: int = Field(10000, ge=0)
    landing_url: str = ""


class RegisterStep(BaseModel):
    step: str
    ok: bool
    message: str = ""
    id: str = ""


class NaverRegisterOut(BaseModel):
    status: Literal["ok", "partial", "failed"]
    is_sample: bool = Field(description="네이버 키가 없어 실제로 등록하지 않음")
    campaign_id: str = ""
    steps: list[RegisterStep]
    manage_url: str = "https://manage.searchad.naver.com"
    message: str



# ---------- 발주·입고 (Figma: 38 발주 일정 등록 · ORD-01) ----------

OrderStatus = Literal["planned", "ordered", "received"]


class OrderIn(BaseModel):
    product_id: str
    qty: int = Field(..., ge=1, description="발주 수량 (양수)")
    supplier: str = Field("", description="공급처", examples=["키링공방"])
    order_date: str = Field(..., description="발주일 YYYY-MM-DD")
    expected_date: str = Field(..., description="입고 예정일 YYYY-MM-DD (발주일과 같거나 이후)")


class OrderStatusIn(BaseModel):
    status: Literal["ordered"]


class ReceiveIn(BaseModel):
    received_qty: int = Field(..., ge=0, description="실제 입고 수량")
    received_date: str = Field(..., description="실제 입고일 YYYY-MM-DD")


class OrderOut(BaseModel):
    id: str
    product_id: str
    name: str
    qty: int
    supplier: str
    order_date: str
    expected_date: str
    status: OrderStatus
    received_qty: int
    received_date: str | None


class OrdersOut(BaseModel):
    orders: list[OrderOut]
    stock: list[StockRow]


# ---------- 생성한 항목 (MKT-02) ----------

ContentKind = Literal["powerlink", "blog", "instagram"]


class ContentItemIn(BaseModel):
    kind: ContentKind = Field(..., description="powerlink(파워링크 문구) / blog / instagram")
    title: str = Field("", description="파워링크·블로그 제목")
    body: str = Field("", description="설명·본문·캡션")
    url: str = Field("", description="파워링크 연결 URL")
    image_url: str = Field("", description="대표·피드 이미지")
    tags: list[str] = Field(default_factory=list)


class ContentItemOut(ContentItemIn):
    id: str
    created_at: str


class ContentItemsOut(BaseModel):
    items: list[ContentItemOut]
