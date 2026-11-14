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
    if config.LLM_PROVIDER == "vapi":
        return _vapi(system, user)
    if config.LLM_PROVIDER == "gemini":
        return _gemini(system, user, image_bytes)
    return _anthropic(system, user, image_bytes)


def _vapi(system: str, user: str) -> dict:
    """Vapi /chat (텍스트 전용, 이미지는 무시). 대시보드에서 만든 assistant 사용."""
    if not config.VAPI_API_KEY or not config.VAPI_ASSISTANT_ID:
        raise LLMError("VAPI_API_KEY 또는 VAPI_ASSISTANT_ID 없음")
    import urllib.request

    # assistant의 시스템 프롬프트와 상관없이 동작하도록 지시문을 입력에 같이 넣음
    payload = {
        "assistantId": config.VAPI_ASSISTANT_ID.strip(),
        "input": f"{system}\n\n---\n\n{user}",
    }
    req = urllib.request.Request(
        "https://api.vapi.ai/chat",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {config.VAPI_API_KEY.strip()}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            # 기본 Python-urllib User-Agent는 막히는 경우가 있어서 명시
            "User-Agent": "Mozilla/5.0 (mawd-backend)",
        },
        method="POST",
    )
    import urllib.error

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
        texts = [m.get("content", "") for m in data.get("output", []) if m.get("role") == "assistant"]
        return _parse_json("".join(t for t in texts if isinstance(t, str)))
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="ignore")[:500]
        raise LLMError(f"HTTP {e.code}: {body}") from e
    except Exception as e:  # noqa: BLE001
        raise LLMError(str(e)) from e


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

    client = OpenAI(api_key=config.OPENAI_API_KEY, base_url=(config.OPENAI_BASE_URL or None), timeout=60)
    content: list[dict] = [{"type": "text", "text": user}]
    if image_bytes:
        b64, media_type = _prepare_image(image_bytes)
        content.append({"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{b64}"}})
    try:
        resp = client.chat.completions.create(
            model=config.OPENAI_MODEL,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": content}],
            **({} if config.OPENAI_BASE_URL else {"response_format": {"type": "json_object"}}),
        )
        return _parse_json(resp.choices[0].message.content or "")
    except Exception as e:  # noqa: BLE001
        raise LLMError(str(e)) from e


def _gemini(system: str, user: str, image_bytes: bytes | None) -> dict:
    """Google Gemini REST (무료 키, 이미지 입력 지원)."""
    if not config.GEMINI_API_KEY:
        raise LLMError("GEMINI_API_KEY 없음")
    import urllib.error
    import urllib.request

    parts: list[dict] = []
    if image_bytes:
        b64, media_type = _prepare_image(image_bytes)
        parts.append({"inline_data": {"mime_type": media_type, "data": b64}})
    parts.append({"text": user})
    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.8},
    }
    url = ("https://generativelanguage.googleapis.com/v1beta/models/"
           f"{config.GEMINI_MODEL.strip()}:generateContent")
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": config.GEMINI_API_KEY.strip(),
            "User-Agent": "Mozilla/5.0 (mawd-backend)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
        cand_parts = data["candidates"][0]["content"]["parts"]
        return _parse_json("".join(p.get("text", "") for p in cand_parts))
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="ignore")[:500]
        raise LLMError(f"HTTP {e.code}: {body}") from e
    except Exception as e:  # noqa: BLE001
        raise LLMError(str(e)) from e
