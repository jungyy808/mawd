"""홈 대시보드 (Figma: S06 홈대시보드). 지금은 화면 확인용 더미 데이터를 돌려준다."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends

from deps import current_store
from schemas import HomeCard, HomeCardRow, HomeEvent, HomeOut, HomeTodo

router = APIRouter(prefix="/api/home", tags=["home"])


def _day(offset: int) -> str:
    return (date.today() + timedelta(days=offset)).isoformat()


def _card(key: str, title: str, headline: str, rows: list[tuple[str, str]], href: str) -> HomeCard:
    return HomeCard(key=key, title=title, headline=headline, href=href,
                    rows=[HomeCardRow(label=l, value=v) for l, v in rows])


@router.get("", response_model=HomeOut, summary="홈 대시보드 (현재 더미 데이터, is_sample: true)")
def get_home(store: dict = Depends(current_store)):
    # TODO: 행사·체크리스트·콘텐츠 실제 데이터로 교체. 날짜는 오늘 기준으로 계산해 D-day가 항상 맞게 한다.
    d_day = 18
    return HomeOut(
        is_sample=True,
        event=HomeEvent(
            id="ev_sample",
            name="서울 크리에이터 페어",
            start_date=_day(d_day),
            end_date=_day(d_day + 1),
            booth_no="B-17",
            d_day=d_day,
            progress=0.58,
            status="preparing",
        ),
        todo_total=4,
        todos=[
            HomeTodo(id="td_1", title="키링 발주 확정", due_date=_day(6)),
            HomeTodo(id="td_2", title="참가 공지 검토", due_date=_day(7)),
            HomeTodo(id="td_3", title="부스 가격표 제작", due_date=_day(4)),
            HomeTodo(id="td_4", title="홍보 게시물 초안 확인", due_date=_day(9)),
        ],
        cards=[
            _card("orders", "상품·발주", "제작 중 3종", [("입고 예정", "2건"), ("확인 필요", "1건")], "/brand/products"),
            _card("promo", "홍보 스튜디오", "게시 예정 2건", [("초안 검토", "1건"), ("게시 완료", "3건")], "/content"),
            _card("ai_inbox", "AI 작업함", "확인 요청 2건", [("공고 확인", "1건"), ("홍보 초안", "1건")], "/content"),
            _card("deadlines", "다가오는 마감", "D-6 · 키링 발주", [("작업 마감", "3건")], "/events"),
            _card("budget", "예산 현황", "현재 지출 42만 원", [("예산 사용률", "70%")], "/events"),
            _card("onsite", "현장 운영", f"{_day(d_day)[5:].replace('-', '/')} 시작", [("등록 상품", "3종")], "/events"),
        ],
    )
