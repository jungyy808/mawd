from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile

import config

import db
from deps import current_store
from schemas import ProductIn, ProductOut, ProductUpdate

router = APIRouter(prefix="/api/products", tags=["products"])


def _out(p: dict) -> ProductOut:
    return ProductOut(id=p["id"], **{k: p[k] for k in db.PRODUCT_FIELDS})


def _get_or_404(store_id: str, product_id: str) -> dict:
    p = db.get_product(store_id, product_id)
    if not p:
        raise HTTPException(404, {"code": "product_not_found", "message": "상품을 찾을 수 없어요"})
    return p


@router.get("", response_model=list[ProductOut], summary="상품 목록")
def list_products(store: dict = Depends(current_store)):
    return [_out(p) for p in db.list_products(store["id"])]


@router.post("", response_model=ProductOut, summary="상품 등록")
def create_product(body: ProductIn, store: dict = Depends(current_store)):
    pid = db.create_product(store["id"], body.model_dump())
    return _out(db.get_product(store["id"], pid))


@router.get("/{product_id}", response_model=ProductOut, summary="상품 상세")
def get_product(product_id: str, store: dict = Depends(current_store)):
    return _out(_get_or_404(store["id"], product_id))


@router.patch("/{product_id}", response_model=ProductOut, summary="상품 수정 (보낸 필드만)")
def update_product(product_id: str, body: ProductUpdate, store: dict = Depends(current_store)):
    _get_or_404(store["id"], product_id)
    db.update_product(store["id"], product_id, body.model_dump(exclude_none=True))
    return _out(db.get_product(store["id"], product_id))


@router.delete("/{product_id}", status_code=204, summary="상품 삭제")
def delete_product(product_id: str, store: dict = Depends(current_store)):
    _get_or_404(store["id"], product_id)
    db.delete_product(store["id"], product_id)
    return Response(status_code=204)


@router.post("/{product_id}/image", response_model=ProductOut, summary="상품 이미지 첨부 (선택 · jpg/png/webp 5MB 이하)")
async def upload_image(product_id: str, request: Request, image: UploadFile = File(...), store: dict = Depends(current_store)):
    from routers.content import ALLOWED_TYPES, _save_image
    _get_or_404(store["id"], product_id)
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, {"code": "bad_image_type", "message": "jpg, png, webp만 가능해요"})
    data = await image.read()
    if len(data) > config.MAX_IMAGE_BYTES:
        raise HTTPException(400, {"code": "image_too_large", "message": "사진은 5MB 이하만 가능해요"})
    db.update_product(store["id"], product_id, {"image_url": _save_image(data, request)})
    return _out(db.get_product(store["id"], product_id))


@router.delete("/{product_id}/image", response_model=ProductOut, summary="상품 이미지 제거")
def remove_image(product_id: str, store: dict = Depends(current_store)):
    _get_or_404(store["id"], product_id)
    db.update_product(store["id"], product_id, {"image_url": ""})
    return _out(db.get_product(store["id"], product_id))
