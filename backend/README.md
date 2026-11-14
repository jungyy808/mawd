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
| `POST /api/stores` | 가입 = 브랜드 등록. JSON `{name, category, intro?, tone?, target_customer?, sales_channel?, region?, monthly_budget?}` → `{store_id, store}` |
| `GET /api/stores/me` | 내 브랜드 정보. 헤더 `X-Store-Id` |
| `PATCH /api/stores/me` | 브랜드 프로필 수정 (보낸 필드만) |
| `POST /api/content` | multipart `description`, `channel`(all/blog/instagram), `goal_keyword`, `image`(선택) + 헤더 `X-Store-Id` → `{instagram{caption,hashtags,shot_list}, blog{title,body,tags,cta}, image_url, is_fallback}` |
| `GET/POST /api/products`, `GET/PATCH/DELETE /api/products/{id}` | 상품 (sku, name, price, stock, url, selling_point) |
| `POST /api/events/import` | `{url?, query?}` → Liner 검색 → AI가 행사 정보표로 정리 (저장 안 함) → `{status, message, fields[], draft, sources[]}` |
| `GET/POST /api/events`, `GET/PATCH/DELETE /api/events/{id}` | 행사 (draft를 그대로 POST하면 생성). 응답에 d_day, products[] 포함 |
| `PUT /api/events/{id}/products` | `[{product_id, planned_qty}]` 판매 상품·수량 통째로 교체 → shortage(부족 수량) 계산 |
| `GET/PATCH /api/events/{id}/plan`, `PUT /api/events/{id}/supplies` | 준비물·재고 계획 (권장 수량, 부족분, 산출 근거) |
| `GET/POST /api/events/{id}/checklist`, `POST .../checklist/suggest`, `PATCH/DELETE .../checklist/{item_id}` | 준비 체크리스트 (AI 제안, Liner 보강) |
| `GET /api/ads/channels` | 광고 채널 목록·연결 상태 (네이버 live/sample, 메타·당근 demo) |
| `POST/DELETE /api/ads/naver/connect` | 네이버 CUSTOMER_ID 연결·해제 |
| `GET /api/ads/naver/stats?days=7` | 파워링크 성과 (키 없거나 미연결이면 샘플, is_sample) |
| `POST /api/ads/naver/draft` | AI 파워링크 캠페인 초안 (등록 안 함) |
| `GET /api/ads/demo/{meta|daangn}` | 메타·당근 데모 샘플 |
| `GET /api/public/events/{id}` | 방문객용 행사 안내 (헤더 없음, is_public인 행사만) |
| `GET /uploads/{파일}` | 업로드 이미지 공개 URL |

에러 형식: `{"error": {"code": "...", "message": "..."}}`

## LLM 설정 (.env)

Liner (현재 사용):
```
LLM_PROVIDER=openai
OPENAI_API_KEY=Liner키
OPENAI_MODEL=liner-gpt-router
OPENAI_BASE_URL=https://platform.liner.com/api/v1
```

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
  -d '{"name":"소소공방","category":"문구·굿즈","intro":"일상 기록용 문구","tone":"차분하고 다정하게"}'

# 콘텐츠 생성 (store_id 바꿔서)
curl -X POST localhost:8000/api/content -H "X-Store-Id: st_xxxxxx" \
  -F "description=이번 주 신메뉴 밤크림빵 출시" -F "image=@bread.jpg"
```
