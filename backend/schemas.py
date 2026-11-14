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
