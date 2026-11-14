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


class ProductUpdate(BaseModel):
    name: str | None = Field(None, min_length=1)
    sku: str | None = None
    price: int | None = Field(None, ge=0)
    stock: int | None = Field(None, ge=0)
    url: str | None = None
    selling_point: str | None = None


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


class EventOut(EventIn):
    id: str
    d_day: int | None = Field(None, description="시작일까지 남은 일수 (지났으면 음수)")
    products: list[EventProductOut] = Field(default_factory=list)


# ---------- 행사 공고 가져오기 (Liner) ----------

class EventImportIn(BaseModel):
    url: str = Field("", description="모집·참가 안내 링크", examples=["https://..."])
    query: str = Field("", description="행사명 등 검색어 (링크가 없거나 결과가 부족할 때)", examples=["연남 겨울 팝업 참가자 모집"])


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
