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
