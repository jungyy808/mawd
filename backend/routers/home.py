"""홈 (Figma: 홈 화면). 지금은 화면 확인용 더미 데이터를 돌려준다."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends

from deps import current_store
from schemas import HomeDeadline, HomeEvent, HomeOut, HomeProduct, HomeProductCard, HomeTodo

router = APIRouter(prefix="/api/home", tags=["home"])


def _day(offset: int) -> str:
    return (date.today() + timedelta(days=offset)).isoformat()


@router.get("", response_model=HomeOut, summary="홈 (현재 더미 데이터, is_sample: true)")
def get_home(store: dict = Depends(current_store)):
    # TODO: 행사·체크리스트·상품 실제 데이터로 교체. 날짜는 오늘 기준으로 계산해 D-day가 항상 맞게 한다.
    d_day = 15
    todos = ["키링 제작업체 발주 확인", "신상품 홍보 초안 검토", "부스 진열대 규격 확인", "미니북 인쇄 파일 제출"]
    deadlines = [(2, "키링 발주 확인"), (5, "미니북 인쇄 마감"), (10, "참가 홍보 게시"), (11, "부스 진열 확정")]
    products = ["아크릴 키링", "스티커팩", "엽서 세트", "미니북"]
    return HomeOut(
        is_sample=True,
        event=HomeEvent(id="ev_sample", name="서울 일러스트 페어",
                        start_date=_day(d_day), end_date=_day(d_day + 1), d_day=d_day),
        todos=[HomeTodo(id=f"td_{i}", title=t) for i, t in enumerate(todos, 1)],
        deadlines=[HomeDeadline(id=f"dl_{i}", title=t, due_date=_day(d), d_day=d)
                   for i, (d, t) in enumerate(deadlines, 1)],
        products=[HomeProduct(id=f"pd_sample{i}", name=name,
                              cards=[HomeProductCard(id=f"pc_{i}_{n}") for n in (1, 2)])
                  for i, name in enumerate(products, 1)],
    )
