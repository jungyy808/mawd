"""방문객용 행사 안내 (로그인 없이 조회). 부스 QR · 네이버 광고 · 블로그/인스타 링크가 여기로 옴."""
from fastapi import APIRouter, HTTPException

import db
from schemas import PublicEventOut, PublicProduct

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/events/{event_id}", response_model=PublicEventOut, summary="방문객용 행사 안내 (공개된 행사만, 헤더 필요 없음)")
def get_public_event(event_id: str):
    ev = db.get_event_public(event_id)
    if not ev or not ev.get("is_public"):
        raise HTTPException(404, {"code": "event_not_public", "message": "아직 공개되지 않은 행사예요"})
    store = db.get_store(ev["store_id"]) or {}
    products = [PublicProduct(name=p["name"], price=p["price"], selling_point=p["selling_point"])
                for p in db.get_event_products(event_id)]
    return PublicEventOut(
        id=ev["id"],
        brand_name=store.get("name", ""),
        brand_intro=store.get("intro", ""),
        name=ev["name"],
        type=ev["type"],
        start_date=ev["start_date"],
        end_date=ev["end_date"],
        hours=ev["hours"],
        location=ev["location"],
        notice=ev.get("notice") or "",
        products=products,
        subscribe_url=ev.get("subscribe_url") or "",
        chat_plugin_key=ev.get("chat_plugin_key") or "",
    )
