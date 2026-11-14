"""API 요청·응답 모양. 여기가 프론트와의 계약이니 바꿀 때는 꼭 공지."""
from typing import Literal

from pydantic import BaseModel, Field

Tone = Literal["friendly", "clean", "playful"]


class StoreIn(BaseModel):
    name: str = Field(..., min_length=1, examples=["달빛베이커리"])
    category: str = Field(..., min_length=1, examples=["베이커리"])
    region: str = Field(..., min_length=1, examples=["경기 안산시 상록구"])
    tone: Tone = Field("friendly", examples=["friendly"])
    monthly_budget: int = Field(0, ge=0, examples=[300000])


class StoreOut(BaseModel):
    store_id: str
    store: StoreIn


class InstagramContent(BaseModel):
    caption: str
    hashtags: list[str]


class BlogContent(BaseModel):
    title: str
    body: str
    tags: list[str]


class ContentOut(BaseModel):
    instagram: InstagramContent
    blog: BlogContent
    image_url: str | None = None
    is_fallback: bool = False
