"""생성한 항목 저장·조회 (MKT-02): 완료된 파워링크 문구 · 블로그 글 · 인스타그램 게시물."""
from fastapi import APIRouter, Depends, HTTPException, Response

import db
from deps import current_store
from schemas import ContentItemIn, ContentItemOut, ContentItemsOut

router = APIRouter(prefix="/api/events", tags=["행사 · 생성한 항목"])


def _event_or_404(store_id: str, event_id: str) -> dict:
    ev = db.get_event(store_id, event_id)
    if not ev:
        raise HTTPException(404, {"code": "event_not_found", "message": "행사를 찾을 수 없어요"})
    return ev


@router.get("/{event_id}/contents", response_model=ContentItemsOut, summary="생성한 항목 목록")
def list_contents(event_id: str, store: dict = Depends(current_store)):
    _event_or_404(store["id"], event_id)
    return ContentItemsOut(items=[ContentItemOut(**c) for c in db.list_contents(event_id)])


@router.post("/{event_id}/contents", response_model=ContentItemOut, status_code=201, summary="생성한 항목 저장")
def add_content(event_id: str, body: ContentItemIn, store: dict = Depends(current_store)):
    _event_or_404(store["id"], event_id)
    if not (body.title.strip() or body.body.strip()):
        raise HTTPException(422, {"code": "empty_content", "message": "저장할 내용이 없어요"})
    cid = db.add_content(event_id, body.model_dump())
    return next(ContentItemOut(**c) for c in db.list_contents(event_id) if c["id"] == cid)


@router.delete("/{event_id}/contents/{content_id}", status_code=204, summary="생성한 항목 삭제")
def delete_content(event_id: str, content_id: str, store: dict = Depends(current_store)):
    _event_or_404(store["id"], event_id)
    db.delete_content(event_id, content_id)
    return Response(status_code=204)
