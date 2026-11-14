"""LLM 공통 호출: 텍스트(+이미지) 넣으면 dict(JSON) 돌려줌. 실패하면 예외 → 라우터에서 fallback 처리."""
import base64
import io
import json
import re

from PIL import Image

import config


class LLMError(Exception):
    pass


def _prepare_image(image_bytes: bytes) -> tuple[str, str]:
    """LLM에 보내기 전 크기 줄이고 JPEG로 통일. (base64, media_type)"""
    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("RGB")
    img.thumbnail((config.LLM_IMAGE_MAX_SIDE, config.LLM_IMAGE_MAX_SIDE))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode(), "image/jpeg"


def _parse_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise LLMError("JSON을 찾지 못함")
    return json.loads(text[start : end + 1])


def generate_json(system: str, user: str, image_bytes: bytes | None = None) -> dict:
    if config.LLM_PROVIDER == "openai":
        return _openai(system, user, image_bytes)
    return _anthropic(system, user, image_bytes)


def _anthropic(system: str, user: str, image_bytes: bytes | None) -> dict:
    if not config.ANTHROPIC_API_KEY:
        raise LLMError("ANTHROPIC_API_KEY 없음")
    import anthropic

    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, timeout=25)
    content: list[dict] = []
    if image_bytes:
        b64, media_type = _prepare_image(image_bytes)
        content.append({"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}})
    content.append({"type": "text", "text": user})
    try:
        msg = client.messages.create(
            model=config.ANTHROPIC_MODEL,
            max_tokens=2000,
            system=system,
            messages=[{"role": "user", "content": content}],
        )
        text = "".join(block.text for block in msg.content if block.type == "text")
        return _parse_json(text)
    except Exception as e:  # noqa: BLE001 - 해커톤: 실패는 전부 fallback으로
        raise LLMError(str(e)) from e


def _openai(system: str, user: str, image_bytes: bytes | None) -> dict:
    if not config.OPENAI_API_KEY or not config.OPENAI_MODEL:
        raise LLMError("OPENAI_API_KEY 또는 OPENAI_MODEL 없음")
    from openai import OpenAI

    client = OpenAI(api_key=config.OPENAI_API_KEY, timeout=25)
    content: list[dict] = [{"type": "text", "text": user}]
    if image_bytes:
        b64, media_type = _prepare_image(image_bytes)
        content.append({"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{b64}"}})
    try:
        resp = client.chat.completions.create(
            model=config.OPENAI_MODEL,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": content}],
            response_format={"type": "json_object"},
        )
        return _parse_json(resp.choices[0].message.content or "")
    except Exception as e:  # noqa: BLE001
        raise LLMError(str(e)) from e
