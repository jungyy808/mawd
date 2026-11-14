from fastapi import APIRouter, Depends

import db
from deps import current_store
from schemas import StoreIn, StoreOut, StoreUpdate

router = APIRouter(prefix="/api/stores", tags=["stores"])


def _out(store: dict) -> StoreOut:
    return StoreOut(store_id=store["id"], store=StoreIn(**{k: store[k] for k in db.STORE_FIELDS}))


@router.post("", response_model=StoreOut, summary="가입 = 브랜드 등록 (온보딩 완료 시 1회)")
def create_store(body: StoreIn):
    store_id = db.create_store(body.model_dump())
    return _out(db.get_store(store_id))


@router.get("/me", response_model=StoreOut, summary="내 브랜드 정보 (헤더 X-Store-Id)")
def get_me(store: dict = Depends(current_store)):
    return _out(store)


@router.patch("/me", response_model=StoreOut, summary="브랜드 프로필 수정 (보낸 필드만 변경)")
def update_me(body: StoreUpdate, store: dict = Depends(current_store)):
    db.update_store(store["id"], body.model_dump(exclude_none=True))
    return _out(db.get_store(store["id"]))
