"""네이버 검색광고 API (HMAC 서명). https://api.searchad.naver.com"""
import base64
import hashlib
import hmac
import json
import time
import urllib.error
import urllib.parse
import urllib.request

import config

BASE = "https://api.searchad.naver.com"


class NaverError(Exception):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


def enabled() -> bool:
    return bool(config.NAVER_ACCESS_LICENSE and config.NAVER_SECRET_KEY)


def _headers(method: str, path: str, customer_id: str) -> dict:
    # 서명 메시지: "밀리초.METHOD.경로" (쿼리스트링 제외) → HMAC-SHA256 → Base64
    stamp = str(int(time.time() * 1000))
    msg = f"{stamp}.{method}.{path}".encode()
    sig = base64.b64encode(hmac.new(config.NAVER_SECRET_KEY.strip().encode(), msg, hashlib.sha256).digest()).decode()
    return {
        "X-Timestamp": stamp,
        "X-API-KEY": config.NAVER_ACCESS_LICENSE.strip(),
        "X-Customer": str(customer_id).strip(),
        "X-Signature": sig,
        "Content-Type": "application/json; charset=UTF-8",
    }


def get_json(path: str, customer_id: str, params: dict | None = None):
    if not enabled():
        raise NaverError("네이버 API 키 없음")
    url = BASE + path + ("?" + urllib.parse.urlencode(params) if params else "")
    req = urllib.request.Request(url, headers=_headers("GET", path, customer_id), method="GET")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise NaverError(f"HTTP {e.code}: {e.read().decode(errors='ignore')[:300]}", e.code) from e
    except Exception as e:  # noqa: BLE001
        raise NaverError(str(e)) from e


def list_campaigns(customer_id: str) -> list[dict]:
    return get_json("/ncc/campaigns", customer_id) or []


def campaign_stats(customer_id: str, campaign_id: str, since: str, until: str) -> dict:
    data = get_json("/stats", customer_id, {
        "id": campaign_id,
        "fields": json.dumps(["impCnt", "clkCnt", "salesAmt", "ctr", "cpc"]),
        "timeRange": json.dumps({"since": since, "until": until}),
    })
    rows = (data or {}).get("data") or []
    return rows[0] if rows else {}


def keyword_tool(customer_id: str, hints: list[str]) -> list[dict]:
    hints = [h.replace(" ", "") for h in hints if h.strip()][:5]
    if not hints:
        return []
    data = get_json("/keywordstool", customer_id, {"hintKeywords": ",".join(hints), "showDetail": "1"})
    return (data or {}).get("keywordList") or []
