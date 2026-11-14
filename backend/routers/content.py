import io
import json
import logging
import secrets

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from PIL import Image

import config
import db
import liner
import llm
from deps import current_store
from prompts import CONTENT_SYSTEM, content_user_prompt
from pydantic import BaseModel, Field

from schemas import Channel, ContentOut

router = APIRouter(prefix="/api", tags=["content"])
log = logging.getLogger("mawd")

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _save_image(image_bytes: bytes, request: Request) -> str:
    """업로드 사진을 uploads/에 저장하고 공개 URL 반환."""
    filename = f"{secrets.token_hex(8)}.jpg"
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img.thumbnail((1440, 1440))
    img.save(config.UPLOAD_DIR / filename, format="JPEG", quality=90)
    base = config.PUBLIC_BASE_URL or str(request.base_url).rstrip("/")
    return f"{base}/uploads/{filename}"


def _fallback(store: dict) -> dict:
    text = (config.DATA_DIR / "fallback_content.json").read_text(encoding="utf-8")
    text = text.replace("{name}", store["name"]).replace("{category}", store["category"])
    return json.loads(text)


def _pick_channel(data: dict, channel: str) -> dict:
    if channel == "blog":
        data["instagram"] = None
    elif channel == "instagram":
        data["blog"] = None
    return data


@router.post("/content", response_model=ContentOut, summary="AI 콘텐츠 초안: 블로그 글 + 인스타 게시물")
async def create_content(
    request: Request,
    description: str = Form(..., min_length=1, description="무엇을 알릴지 한두 문장"),
    channel: Channel = Form("all", description="all / blog / instagram"),
    goal_keyword: str = Form("", description="목표·키워드 (예: 팝업 방문 · 연남동 팝업)"),
    image: UploadFile | None = File(default=None, description="선택. jpg/png/webp, 5MB 이하"),
    event_id: str = Form("", description="선택. 행사 ID를 주면 행사명·날짜·장소·판매 상품을 반영"),
    store: dict = Depends(current_store),
):
    if event_id:
        ev = db.get_event(store["id"], event_id)
        if not ev:
            raise HTTPException(404, {"code": "event_not_found", "message": "행사를 찾을 수 없어요"})
        names = ", ".join(f"{p['name']}({p['price']:,}원)" for p in db.get_event_products(event_id)[:6])
        when = " ~ ".join(x for x in (ev.get("start_date"), ev.get("end_date")) if x)
        description = (f"[행사] {ev['name']} · {when or '날짜 미정'} · {ev.get('location') or '장소 미정'}"
                       + (f" · 운영 {ev['hours']}" if ev.get("hours") else "")
                       + (f"\n[판매 상품] {names}" if names else "") + f"\n[요구사항] {description}")
    image_bytes = None
    image_url = None
    if image is not None and image.filename:
        if image.content_type not in ALLOWED_TYPES:
            raise HTTPException(400, {"code": "bad_image_type", "message": "jpg, png, webp만 가능해요"})
        image_bytes = await image.read()
        if len(image_bytes) > config.MAX_IMAGE_BYTES:
            raise HTTPException(400, {"code": "image_too_large", "message": "사진은 5MB 이하만 가능해요"})
        image_url = _save_image(image_bytes, request)

    prompt = content_user_prompt(store, description, image_bytes is not None, channel, goal_keyword)
    try:
        data = llm.generate_json(CONTENT_SYSTEM, prompt, image_bytes)
        result = ContentOut(**_pick_channel(data, channel), image_url=image_url, is_fallback=False)
    except Exception as e:  # noqa: BLE001 - LLM 실패·형식 오류 전부 fallback
        log.warning("LLM 실패, fallback 사용: %s", e)
        result = ContentOut(**_pick_channel(_fallback(store), channel), image_url=image_url, is_fallback=True)
    return result


class ImageIn(BaseModel):
    event_id: str = Field("", description="선택. 행사·상품 정보를 그림 설명에 반영")
    channel: Channel = Field("instagram", description="instagram(정사각) / blog(가로)")
    hint: str = Field("", description="그림에 담고 싶은 내용 (예: 블로그 제목·요구사항)")


class ImageOut(BaseModel):
    image_url: str


@router.post("/content/image", response_model=ImageOut, summary="AI 이미지 생성 (LINER Images API)")
def create_image(body: ImageIn, request: Request, store: dict = Depends(current_store)):
    parts = [f"{store['category']} brand '{store['name']}'"]
    if body.event_id:
        ev = db.get_event(store["id"], body.event_id)
        if not ev:
            raise HTTPException(404, {"code": "event_not_found", "message": "행사를 찾을 수 없어요"})
        names = ", ".join(p["name"] for p in db.get_event_products(body.event_id)[:4])
        parts.append(f"offline pop-up booth event '{ev['name']}' at {ev.get('location') or 'Seoul'}")
        if names:
            parts.append(f"featured products: {names}")
    if body.hint.strip():
        parts.append(f"theme: {body.hint.strip()[:200]}")
    prompt = ("Bright, warm promotional photo for social media. " + "; ".join(parts)
              + ". Products neatly displayed on a small market booth table, soft natural light, cozy and trendy Korean pop-up store mood. "
              "No text, no letters, no logos, no watermark.")
    try:
        data = liner.generate_image(prompt, "1:1" if body.channel != "blog" else "16:9")
    except liner.LinerError as e:
        log.warning("이미지 생성 실패: %s", e)
        raise HTTPException(503, {"code": "image_failed", "message": "이미지를 만들지 못했어요. 잠시 후 다시 시도하거나 사진을 직접 올려 주세요."})
    return ImageOut(image_url=_save_image(data, request))
