import json
import logging
import secrets

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

import config
import llm
from deps import current_store
from prompts import CONTENT_SYSTEM, content_user_prompt
from schemas import ContentOut

router = APIRouter(prefix="/api", tags=["content"])
log = logging.getLogger("mawd")

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _save_image(image_bytes: bytes, request: Request) -> str:
    """업로드 사진을 uploads/에 저장하고 공개 URL 반환."""
    filename = f"{secrets.token_hex(8)}.jpg"
    from PIL import Image
    import io

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img.thumbnail((1440, 1440))
    img.save(config.UPLOAD_DIR / filename, format="JPEG", quality=90)
    base = config.PUBLIC_BASE_URL or str(request.base_url).rstrip("/")
    return f"{base}/uploads/{filename}"


def _fallback(store: dict) -> dict:
    with open(config.DATA_DIR / "fallback_content.json", encoding="utf-8") as f:
        text = f.read()
    text = text.replace("{name}", store["name"]).replace("{region}", store["region"]).replace(
        "{category}", store["category"]
    )
    return json.loads(text)


@router.post("/content", response_model=ContentOut, summary="사진 + 설명 → 인스타 캡션 + 블로그 글")
async def create_content(
    request: Request,
    description: str = Form(..., min_length=1),
    image: UploadFile | None = File(default=None),
    store: dict = Depends(current_store),
):
    image_bytes = None
    image_url = None
    if image is not None and image.filename:
        if image.content_type not in ALLOWED_TYPES:
            raise HTTPException(400, {"code": "bad_image_type", "message": "jpg, png, webp만 가능해요"})
        image_bytes = await image.read()
        if len(image_bytes) > config.MAX_IMAGE_BYTES:
            raise HTTPException(400, {"code": "image_too_large", "message": "사진은 5MB 이하만 가능해요"})
        image_url = _save_image(image_bytes, request)

    try:
        data = llm.generate_json(
            CONTENT_SYSTEM, content_user_prompt(store, description, image_bytes is not None), image_bytes
        )
        result = ContentOut(**data, image_url=image_url, is_fallback=False)
    except Exception as e:  # noqa: BLE001 - LLM 실패·형식 오류 전부 fallback
        log.warning("LLM 실패, fallback 사용: %s", e)
        result = ContentOut(**_fallback(store), image_url=image_url, is_fallback=True)
    return result
