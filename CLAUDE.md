# MAWD — AI 마케터 (해커톤 프로젝트)

온라인 판매와 오프라인 팝업·부스를 함께 운영하는 1인 브랜드를 위한 AI 마케터 웹앱.
행사(팝업·마켓·부스) 준비부터 홍보 콘텐츠·광고까지 한곳에서 돕는다.

- 기획서(정답 기준): Figma "MAWD 일단해 팀" → 페이지 "기획" (전체 IA + 데스크톱·모바일 와이어프레임)
- 화면과 기능은 Figma를 따른다. Figma에 없는 기능은 팀과 상의 후 추가.
- 사용자에게 보이는 문구는 전부 한국어.
- **웹(PC) 우선**: Figma 데스크톱(1180px) 화면을 먼저 만든다. 모바일 대응은 03:00 이후, 그 전엔 좁은 화면에서 깨지지만 않게.
  예외: 방문객용 행사 안내 페이지 `app/e/[id]`는 모바일 우선 (부스 QR로 휴대폰에서 열림).

## 팀과 작업 방식

- 개발 2명이 프론트·백엔드를 나누지 않고 **기능(메뉴) 단위로** 나눠 백엔드 API + 화면을 같이 만든다.
  - **박정연**: 행사(EVT) + 광고(ADS) + 방문객용 행사 안내 페이지
  - **은님**: 공통 레이아웃·API 클라이언트 + 온보딩 + 홈 + 콘텐츠(CNT) + 브랜드·상품 + 설정
- 남의 담당 파일을 고쳐야 하면 카톡으로 먼저 말한다.
- 작업 전 `git pull`, 브랜치 `feat/<기능>` → 로컬에서 실행 확인 후 main 머지.
- 공통 파일(`backend/main.py`, `db.py`, `schemas.py`, `prompts.py`, `frontend/lib/types.ts`)은 `git pull` → 끝에 추가 → 바로 push.
- API 요청·응답 모양을 바꾸면 단톡에 공지하고 API 명세서도 고친다.

## 폴더 구조 (담당)

```
mawd/
├─ backend/                                FastAPI (Python)
│  ├─ main.py                              공통 · include_router 한 줄씩 끝에 추가만
│  ├─ config.py, deps.py, llm.py           공통 · 건드리지 않기
│  ├─ db.py, schemas.py, prompts.py        공통 · 끝에 추가만
│  ├─ liner.py                             Liner 웹 검색 web_search(query)
│  ├─ data/                                fallback 예시 응답
│  └─ routers/
│     ├─ stores.py, products.py            완료
│     ├─ content.py                        은님 (AI 글 생성, 완료)
│     ├─ contents.py                       은님 (콘텐츠 저장·캘린더, 새로)
│     ├─ home.py                           은님 (새로)
│     ├─ events.py                         박정연 (plan, checklist 추가)
│     ├─ public.py                         박정연 (방문객용 행사 안내, 새로)
│     └─ ads.py                            박정연 (네이버·메타·당근, 새로)
│
└─ frontend/                               Next.js App Router + TypeScript + Tailwind
   ├─ app/
   │  ├─ layout.tsx                        은님 (사이드바 + 본문 + 상세 패널)
   │  ├─ page.tsx                          은님 (store_id 없으면 /onboarding)
   │  ├─ onboarding/                       은님
   │  ├─ home/                             은님
   │  ├─ content/, content/calendar/       은님
   │  ├─ brand/, brand/products/           은님
   │  ├─ settings/                         은님
   │  ├─ events/                           박정연 (목록)
   │  ├─ events/new/, events/new/review/   박정연 (Liner 가져오기 → 정보표 검토)
   │  ├─ events/[id]/, events/[id]/products/  박정연 (상세, 판매 상품·수량)
   │  ├─ e/[id]/                           박정연 (방문객용 안내, 모바일 우선)
   │  └─ ads/, ads/naver/, ads/demo/       박정연
   ├─ components/
   │  ├─ ui/, nav/                         은님 (공통)
   │  ├─ events/, ads/                     박정연
   └─ lib/
      ├─ api.ts                            은님 (fetch + X-Store-Id 자동, NEXT_PUBLIC_API_URL)
      ├─ store.ts                          은님 (store_id → localStorage)
      └─ types.ts                          공통 · 끝에 추가만
```

## 실행

백엔드:
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # 키 채우기
uvicorn main:app --reload --port 8000
```
- Swagger: http://localhost:8000/docs
- `.env`를 바꾸면 서버를 껐다 켜야 반영됨 (`--reload`는 .env를 다시 안 읽음)

프론트:
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local   # 배포 서버면 https://mawd-api.onrender.com
npm run dev   # http://localhost:3000
```

배포:
- 백엔드: Render (https://mawd-api.onrender.com, Root Directory `backend`). main에 push하면 자동 배포.
- 프론트: Vercel (Root Directory `frontend`, 환경변수 `NEXT_PUBLIC_API_URL`). main에 push하면 자동 배포.
- 무료 플랜: 15분 안 쓰면 잠듦(첫 요청 ~50초), **재배포 때마다 SQLite·업로드 이미지 초기화**.

## 백엔드 규칙

- 인증: 브랜드 = 회원. `POST /api/stores`로 가입하면 `store_id` 발급, 이후 모든 요청 헤더 `X-Store-Id`.
  새 라우터는 `store: dict = Depends(current_store)`로 받고, 모든 조회·수정은 `store["id"]`로 범위를 제한한다.
- 에러 형식: `HTTPException(status, {"code": "snake_case_code", "message": "한국어 안내"})`
  → 응답 `{"error": {"code", "message"}}`
- JSON 키는 snake_case. 날짜 `YYYY-MM-DD`, 금액은 원 단위 정수, 비율은 0~1.
- ID 접두사: 브랜드 `st_`, 상품 `pd_`, 행사 `ev_`.
- 부분 수정은 PATCH + `model_dump(exclude_none=True)`, 목록 통째 교체는 PUT.
- 새 테이블은 `db.init_db()`에 `CREATE TABLE IF NOT EXISTS`, 기존 테이블 컬럼 추가는 `_STORE_EXTRA_COLUMNS`처럼 ALTER로.
- 경로 순서: `/api/events/import` 같은 고정 경로는 `/{event_id}`보다 먼저 선언.

## AI 사용 규칙

- LLM 호출은 항상 `llm.generate_json()`을 쓰고, 프롬프트는 `prompts.py`에 둔다. JSON 하나만 출력하게 시킨다.
- AI가 실패해도 서버는 200으로 예시 응답(`is_fallback: true`)이나 `status: "failed"`를 돌려준다. 시연 중 빈 화면 금지.
- 검색 결과·사용자 입력에 없는 사실(가격, 날짜, 할인)은 지어내지 않게 프롬프트에 명시.
- 현재 LLM: Liner Router (OpenAI 호환) — `LLM_PROVIDER=openai`, `OPENAI_BASE_URL=https://platform.liner.com/api/v1`, `OPENAI_MODEL=liner-gpt-router`.
  Liner 검색은 같은 키를 쓴다(`LINER_API_KEY` 비우면 `OPENAI_API_KEY` 사용).
- Liner 검색은 URL 본문을 직접 읽지 못한다. 링크 + 행사명을 같이 검색해야 정확하다.

## 프론트 규칙

- API 호출은 항상 `lib/api.ts`를 쓴다 (`X-Store-Id` 헤더 자동, 에러 `{error:{code,message}}` 처리).
- 404 `store_not_found`를 받으면 store_id를 지우고 `/onboarding`으로 보낸다.
- AI 호출(글 생성 10~20초, 행사 가져오기 15~40초)은 로딩 화면 필수, 타임아웃 70초 이상.
- `is_fallback: true`면 "예시" 배지, 행사 가져오기 `status: "failed"`면 직접 입력으로 안내.
- 클라이언트 컴포넌트(`"use client"`)에서 호출 (localStorage 사용 때문).

## 절대 하지 말 것

- `.env`, API 키 커밋 금지 (`.gitignore`에 있음). 키는 DM으로만 공유.
- 광고 실제 집행·결제 기능 금지 (Figma: 등록은 "중지 상태", 집행은 별도 승인).
- 인스타·네이버 블로그 자동 게시 구현 금지 (Figma: 원고 복사 → 외부 발행 → 발행 완료 직접 표시. 네이버 블로그 글쓰기 API는 종료됨).

## 현재 상태

완료 (배포 서버 동작):
- 브랜드 가입·조회·수정 `/api/stores`, `/api/stores/me`
- AI 콘텐츠 초안 `POST /api/content` (블로그 title/body/tags/cta + 인스타 caption/hashtags/shot_list)
- 상품 CRUD `/api/products`
- 행사 CRUD `/api/events`, 판매 상품·수량 `PUT /api/events/{id}/products` (shortage 계산)
- 행사 공고 가져오기 `POST /api/events/import` (Liner 검색 → 행사 정보표 draft)

다음 (우선순위 순):
1. 준비물·재고 계획 `GET /api/events/{id}/plan` (방문객 × 구매율 × 수량), AI 준비 체크리스트
2. 콘텐츠 저장·캘린더 `/api/contents` (상태: 초안 → 검토 완료 → 발행 완료), 콘텐츠에 event_id 연결
3. 홈 `GET /api/home`
4. 네이버 검색광고 연결·성과·AI 캠페인 초안
5. 메타·당근 광고 데모(샘플 데이터), 방문객용 행사 안내 페이지, 이메일 초안, FAQ
6. (기획 확정 시) 행사 예산·손익
