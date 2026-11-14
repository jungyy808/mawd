# MAWD Backend (FastAPI)

## 로컬 실행

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # 키 채우기
uvicorn main:app --reload --port 8000
```

- API 문서(Swagger): http://localhost:8000/docs
- 헬스체크: http://localhost:8000/health

LLM 키가 없거나 호출이 실패해도 `/api/content`는 예시 응답(`is_fallback: true`)을 돌려줘요.

## API

| API | 설명 |
|---|---|
| `POST /api/stores` | 가입. JSON `{name, category, region, tone, monthly_budget}` → `{store_id, store}` |
| `GET /api/stores/me` | 내 가게 정보. 헤더 `X-Store-Id` |
| `POST /api/content` | multipart `description`, `image`(선택) + 헤더 `X-Store-Id` → `{instagram, blog, image_url, is_fallback}` |
| `GET /uploads/{파일}` | 업로드 이미지 공개 URL |

`tone`: `friendly` / `clean` / `playful`

에러 형식: `{"error": {"code": "...", "message": "..."}}`

## Render 배포

1. New → Web Service → 이 레포 연결, Root Directory `backend`
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Environment에 `.env` 값 입력 (`PUBLIC_BASE_URL`은 배포 주소)

주의: Render 무료 플랜은 재시작하면 SQLite와 업로드 이미지가 초기화돼요. 시연 직전에 다시 가입하세요.

## curl 테스트

```bash
# 가입
curl -X POST localhost:8000/api/stores -H "Content-Type: application/json" \
  -d '{"name":"달빛베이커리","category":"베이커리","region":"경기 안산시 상록구","tone":"friendly","monthly_budget":300000}'

# 콘텐츠 생성 (store_id 바꿔서)
curl -X POST localhost:8000/api/content -H "X-Store-Id: st_xxxxxx" \
  -F "description=이번 주 신메뉴 밤크림빵 출시" -F "image=@bread.jpg"
```
