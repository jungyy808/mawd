from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import db
from config import UPLOAD_DIR
from routers import ads, content, events, finance, home, products, public, stores

app = FastAPI(title="MAWD API", version="0.2.0")

# Flutter Web은 주소가 달라서 CORS 필수. 커스텀 헤더 X-Store-Id 때문에 헤더도 전부 허용.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    db.init_db()


# 에러 형식 통일: {"error": {"code": "...", "message": "..."}}
@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict):
        body = exc.detail
    else:
        body = {"code": "http_error", "message": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content={"error": body})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "validation_error", "message": str(exc.errors())}},
    )


# 업로드 이미지 공개 URL (인스타 게시 시 Meta 서버가 이 주소로 이미지를 가져감)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(stores.router)
app.include_router(content.router)
app.include_router(products.router)
app.include_router(events.router)
app.include_router(ads.router)
app.include_router(public.router)
app.include_router(home.router)
app.include_router(finance.router)


@app.get("/health")
def health():
    return {"ok": True}
