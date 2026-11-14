"""Liner Search API (https://platform.liner.com/api/v1/tools/search/web)"""
import json
import urllib.error
import urllib.request

import config


class LinerError(Exception):
    pass


def web_search(query: str, max_results: int = 8) -> list[dict]:
    key = config.LINER_API_KEY
    if not key:
        raise LinerError("LINER_API_KEY 없음")
    payload = {
        "query": query,
        "max_results": max_results,
        "include_knowledge": False,
        "country_code": "kr",
        "lang": "ko",
    }
    try:
        return _call(payload, key)
    except LinerError as e:
        if "HTTP 400" in str(e) or "HTTP 422" in str(e):
            payload.pop("country_code", None)
            payload.pop("lang", None)
            return _call(payload, key)
        raise


def _call(payload: dict, key: str) -> list[dict]:
    req = urllib.request.Request(
        "https://platform.liner.com/api/v1/tools/search/web",
        data=json.dumps(payload).encode(),
        headers={
            "x-api-key": key.strip(),
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (mawd-backend)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise LinerError(f"HTTP {e.code}: {e.read().decode(errors='ignore')[:300]}") from e
    except Exception as e:  # noqa: BLE001
        raise LinerError(str(e)) from e
    return [
        {
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "description": r.get("description", ""),
            "date": r.get("date", ""),
        }
        for r in data.get("results", [])
    ]


IMAGE_MODEL = "qwen/qwen-image-2.1-turbo"


def generate_image(prompt: str, aspect_ratio: str = "1:1") -> bytes:
    """Liner Images API (POST /v1/images/generations) → 이미지 바이트. 90초 넘으면 200 + error 본문이 올 수 있음."""
    import base64
    key = config.LINER_API_KEY
    if not key:
        raise LinerError("LINER_API_KEY 없음")
    body = {"model": IMAGE_MODEL, "prompt": prompt, "resolution": "1K", "aspect_ratio": aspect_ratio}
    req = urllib.request.Request(
        "https://platform.liner.com/api/v1/images/generations",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key.strip()}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as res:
            data = json.loads(res.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        if e.code == 400 and "aspect_ratio" in e.read().decode(errors="ignore"):
            body.pop("aspect_ratio")
            req = urllib.request.Request(req.full_url, data=json.dumps(body).encode(), headers=dict(req.header_items()))
            with urllib.request.urlopen(req, timeout=180) as res:
                data = json.loads(res.read().decode() or "{}")
        else:
            raise LinerError(f"HTTP {e.code}") from e
    except (urllib.error.URLError, TimeoutError) as e:
        raise LinerError(f"연결 실패: {e}") from e
    if data.get("error"):
        raise LinerError(str(data["error"].get("message", data["error"])))
    items = data.get("data") or []
    if not items or not items[0].get("b64_json"):
        raise LinerError("이미지가 비어 있음")
    return base64.b64decode(items[0]["b64_json"])
