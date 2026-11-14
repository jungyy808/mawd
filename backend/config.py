import os
from pathlib import Path

BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
DATA_DIR = BASE_DIR / "data"
DB_PATH = os.getenv("DB_PATH", str(BASE_DIR / "mawd.db"))

# LLM 설정: anthropic 또는 openai
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "anthropic").lower()
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "")  # openai 쓸 때 모델명 직접 지정
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "")  # Liner: https://platform.liner.com/api/v1
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
VAPI_API_KEY = os.getenv("VAPI_API_KEY", "")  # Private API Key
VAPI_ASSISTANT_ID = os.getenv("VAPI_ASSISTANT_ID", "")

# Liner 검색 API 키. 비우면 OPENAI_API_KEY(Liner 키)를 같이 씀
LINER_API_KEY = os.getenv("LINER_API_KEY", "") or (
    os.getenv("OPENAI_API_KEY", "") if "liner.com" in OPENAI_BASE_URL else ""
)

# 네이버 검색광고 API (서비스 운영 계정 키). 비우면 광고 화면은 샘플 데이터로 동작
NAVER_ACCESS_LICENSE = os.getenv("NAVER_ACCESS_LICENSE", "")
NAVER_SECRET_KEY = os.getenv("NAVER_SECRET_KEY", "")

# 배포 주소 (예: https://mawd-api.onrender.com). 비우면 요청 주소 기준으로 이미지 URL 생성
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")

MAX_IMAGE_BYTES = 5 * 1024 * 1024
LLM_IMAGE_MAX_SIDE = 1568
