from fastapi import APIRouter, Depends

import db
from deps import current_store
from schemas import StoreIn, StoreOut

router = APIRouter(prefix="/api/stores", tags=["stores"])

STORE_FIELDS = ("name", "category", "region", "tone", "monthly_budget")


def _out(store: dict) -> StoreOut:
    return StoreOut(store_id=store["id"], store=StoreIn(**{k: store[k] for k in STORE_FIELDS}))


@router.post("", response_model=StoreOut, summary="가입 (온보딩 완료 시 1회)")
def create_store(body: StoreIn):
    store_id = db.create_store(body.model_dump())
    return _out(db.get_store(store_id))


@router.get("/me", response_model=StoreOut, summary="내 가게 정보 (헤더 X-Store-Id)")
def get_me(store: dict = Depends(current_store)):
    return _out(store)
