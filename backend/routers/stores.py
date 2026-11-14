import re

from fastapi import APIRouter, Depends, HTTPException

import config
import db
from deps import current_store
from schemas import Integration, LoginIn, StoreCreate, StoreIn, StoreOut, StoreUpdate

router = APIRouter(prefix="/api/stores", tags=["stores"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _out(store: dict) -> StoreOut:
    return StoreOut(store_id=store["id"], store=StoreIn(**{k: store[k] for k in db.STORE_FIELDS}), email=store.get("email", "") or "")


@router.post("", response_model=StoreOut, summary="가입 = 브랜드 등록 (온보딩 완료 시 1회)")
def create_store(body: StoreCreate):
    email = body.email.strip().lower()
    if email:
        if not EMAIL_RE.match(email):
            raise HTTPException(422, {"code": "invalid_email", "message": "이메일 형식을 확인해 주세요."})
        if len(body.password) < 8:
            raise HTTPException(422, {"code": "weak_password", "message": "비밀번호는 8자 이상으로 정해 주세요."})
        if db.email_taken(email):
            raise HTTPException(409, {"code": "email_taken", "message": "이미 가입한 이메일이에요. 로그인해 주세요."})
    store_id = db.create_store(body.model_dump(exclude={"email", "password"}))
    if email:
        db.set_login(store_id, email, body.password)
    return _out(db.get_store(store_id))


@router.post("/login", response_model=StoreOut, summary="로그인 (이메일·비밀번호 → store_id)")
def login(body: LoginIn):
    store = db.check_login(body.email, body.password)
    if not store:
        raise HTTPException(401, {"code": "login_failed", "message": "이메일 또는 비밀번호를 확인하고 다시 시도하세요."})
    return _out(store)


@router.get("/me", response_model=StoreOut, summary="내 브랜드 정보 (헤더 X-Store-Id)")
def get_me(store: dict = Depends(current_store)):
    return _out(store)


@router.patch("/me", response_model=StoreOut, summary="브랜드 프로필 수정 (보낸 필드만 변경)")
def update_me(body: StoreUpdate, store: dict = Depends(current_store)):
    if body.store_url:
        u = body.store_url.strip()
        if not re.match(r"^https://[^\s/]+\.[^\s]+$", u):
            raise HTTPException(422, {"code": "invalid_store_url", "message": "https:// 로 시작하는 스토어 주소를 넣어 주세요."})
        body.store_url = u
    db.update_store(store["id"], body.model_dump(exclude_none=True))
    return _out(db.get_store(store["id"]))


@router.put("/me/login", response_model=StoreOut, summary="로그인 이메일·비밀번호 등록 (가입 때 안 넣은 계정용)")
def set_login(body: LoginIn, store: dict = Depends(current_store)):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(422, {"code": "invalid_email", "message": "이메일 형식을 확인해 주세요."})
    if len(body.password) < 8:
        raise HTTPException(422, {"code": "weak_password", "message": "비밀번호는 8자 이상으로 정해 주세요."})
    if email != (store.get("email") or "") and db.email_taken(email):
        raise HTTPException(409, {"code": "email_taken", "message": "이미 다른 계정에서 쓰는 이메일이에요."})
    db.set_login(store["id"], email, body.password)
    return _out(db.get_store(store["id"]))


@router.get("/me/integrations", response_model=list[Integration], summary="파트너 연동 상태 (Liner · 채널톡 · 스티비)")
def integrations(store: dict = Depends(current_store)):
    liner_ok = bool(config.LINER_API_KEY)
    return [
        Integration(key="liner", name="Liner · 출처 검색", status="ready" if liner_ok else "not_connected",
                    status_label="사용 가능" if liner_ok else "지금은 사용할 수 없어요 · 행사 정보는 직접 입력할 수 있어요",
                    check="행사 공고를 찾아 행사 정보를 자동으로 채워요"),
        Integration(key="channeltalk", name="채널톡 · 방문객 문의", status="not_connected",
                    status_label="연결 안 됨",
                    check="방문객 문의를 행사별로 모아 보고 자주 묻는 질문에 자동으로 답해요"),
        Integration(key="stibee", name="스티비 · 구독과 메일", status="not_connected",
                    status_label="연결 안 됨 · 행사별 구독 폼 주소는 등록할 수 있어요",
                    check="부스 QR로 모은 구독 고객에게 후속 이메일을 보내요"),
    ]
