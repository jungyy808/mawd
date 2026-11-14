from fastapi import Header, HTTPException

import db


def current_store(x_store_id: str | None = Header(default=None)) -> dict:
    """모든 API 공통: X-Store-Id 헤더로 가게(회원) 찾기."""
    if not x_store_id:
        raise HTTPException(401, {"code": "store_id_missing", "message": "X-Store-Id 헤더가 필요해요"})
    store = db.get_store(x_store_id)
    if not store:
        raise HTTPException(404, {"code": "store_not_found", "message": "가게를 찾을 수 없어요. 다시 가입해주세요"})
    return store
