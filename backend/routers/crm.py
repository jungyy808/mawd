"""고객 관리 (CRM-01 문의 자동 응답 규칙 · CRM-03 이메일 본문 초안).
채널톡 Open API·스티비 발송 API는 유료 플랜 키가 있어야 해서, 키가 없으면 연결 상태와 해결 방법만 보여준다."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

import db
import llm
from deps import current_store

router = APIRouter(prefix="/api/events", tags=["행사 · 고객 관리"])
log = logging.getLogger("mawd")


class RuleIn(BaseModel):
    keyword: str = Field(..., min_length=1, description="문의에 이 단어가 있으면 (쉼표로 여러 개)", examples=["주차, 주차장"])
    answer: str = Field(..., min_length=1, description="자동 응답 문구")


class RuleUpdate(BaseModel):
    keyword: str | None = Field(None, min_length=1)
    answer: str | None = Field(None, min_length=1)
    active: bool | None = None


class Rule(BaseModel):
    id: str
    keyword: str
    answer: str
    active: bool


class RulesOut(BaseModel):
    rules: list[Rule]


class RuleTestIn(BaseModel):
    message: str = Field(..., min_length=1, examples=["주차 가능한가요?"])


class RuleTestOut(BaseModel):
    result: str = Field(description="auto(자동 응답) / review(운영자 검토 대기)")
    rule: Rule | None = None
    answer: str = ""
    reason: str


class EmailDraftIn(BaseModel):
    purpose: str = Field(..., min_length=1, examples=["방문 감사 · 온라인 스토어 안내"])
    emphasis: str = Field("", examples=["스토어 첫 구매 10% 할인 코드"])
    tone: str = Field("다정하게", examples=["다정하게"])


class EmailDraftOut(BaseModel):
    subject: str
    body: str
    is_fallback: bool = False


def _event_or_404(store_id: str, event_id: str) -> dict:
    ev = db.get_event(store_id, event_id)
    if not ev:
        raise HTTPException(404, {"code": "event_not_found", "message": "행사를 찾을 수 없어요"})
    return ev


def _rules(event_id: str) -> RulesOut:
    return RulesOut(rules=[Rule(**{k: r[k] for k in ("id", "keyword", "answer", "active")}) for r in db.list_rules(event_id)])


@router.get("/{event_id}/crm/rules", response_model=RulesOut, summary="자동 응답 규칙 목록")
def list_rules(event_id: str, store: dict = Depends(current_store)):
    _event_or_404(store["id"], event_id)
    return _rules(event_id)


@router.post("/{event_id}/crm/rules", response_model=RulesOut, summary="자동 응답 규칙 추가")
def add_rule(event_id: str, body: RuleIn, store: dict = Depends(current_store)):
    _event_or_404(store["id"], event_id)
    db.add_rule(event_id, body.keyword.strip(), body.answer.strip())
    return _rules(event_id)


@router.patch("/{event_id}/crm/rules/{rule_id}", response_model=RulesOut, summary="자동 응답 규칙 수정·켜기/끄기")
def update_rule(event_id: str, rule_id: str, body: RuleUpdate, store: dict = Depends(current_store)):
    _event_or_404(store["id"], event_id)
    db.update_rule(event_id, rule_id, body.model_dump(exclude_none=True))
    return _rules(event_id)


@router.delete("/{event_id}/crm/rules/{rule_id}", status_code=204, summary="자동 응답 규칙 삭제")
def delete_rule(event_id: str, rule_id: str, store: dict = Depends(current_store)):
    _event_or_404(store["id"], event_id)
    db.delete_rule(event_id, rule_id)
    return Response(status_code=204)


@router.post("/{event_id}/crm/rules/test", response_model=RuleTestOut, summary="자동 응답 테스트 (규칙 일치 → 자동 응답, 아니면 검토 대기)")
def test_rule(event_id: str, body: RuleTestIn, store: dict = Depends(current_store)):
    _event_or_404(store["id"], event_id)
    msg = body.message.lower()
    for r in db.list_rules(event_id):
        if not r["active"]:
            continue
        words = [w.strip().lower() for w in r["keyword"].replace("/", ",").split(",") if w.strip()]
        hit = next((w for w in words if w in msg), None)
        if hit:
            rule = Rule(**{k: r[k] for k in ("id", "keyword", "answer", "active")})
            return RuleTestOut(result="auto", rule=rule, answer=r["answer"], reason=f"‘{hit}’ 규칙과 일치해 자동으로 답해요.")
    return RuleTestOut(result="review", reason="켜진 규칙과 일치하지 않아 운영자 검토 대기로 보내요.")


EMAIL_SYSTEM = """당신은 1인 브랜드 운영자의 행사 후속 이메일을 쓰는 도우미입니다.
주어진 행사·브랜드·상품 정보와 요청만 근거로 씁니다. 구독자 개인정보는 쓰지 않습니다.
JSON으로만 답합니다: {"subject":"제목 30자 이내","body":"본문 (문단은 빈 줄로 구분, 4~6문단, 마지막은 스토어 방문 권유)"}"""


@router.post("/{event_id}/crm/email/draft", response_model=EmailDraftOut, summary="이메일 본문 AI 초안 (LINER · 구독자 주소는 보내지 않음)")
def email_draft(event_id: str, body: EmailDraftIn, store: dict = Depends(current_store)):
    ev = _event_or_404(store["id"], event_id)
    names = ", ".join(p["name"] for p in db.get_event_products(event_id)[:5])
    prompt = (f"브랜드: {store['name']} ({store['category']}) · 말투: {body.tone}\n"
              f"행사: {ev['name']} · {ev.get('start_date') or ''}~{ev.get('end_date') or ''} · {ev.get('location') or ''}\n"
              f"상품: {names or '없음'}\n목적: {body.purpose}\n강조: {body.emphasis or '없음'}")
    try:
        data = llm.generate_json(EMAIL_SYSTEM, prompt)
        if not data.get("subject") or not data.get("body"):
            raise ValueError("빈 응답")
        return EmailDraftOut(subject=str(data["subject"])[:60], body=str(data["body"]))
    except Exception as e:  # noqa: BLE001
        log.warning("이메일 초안 LLM 실패, 기본 문구 사용: %s", e)
        extra = f"\n\n{body.emphasis}" if body.emphasis else ""
        return EmailDraftOut(
            subject=f"{ev['name']}에 와 주셔서 고마워요",
            body=(f"안녕하세요, {store['name']}입니다.\n\n{ev['name']}에서 저희 부스를 찾아 주셔서 정말 고마웠어요."
                  + (f" 그날 소개한 {names}도 마음에 드셨길 바라요." if names else "") + extra
                  + "\n\n행사에서 못 보신 상품과 새 소식은 온라인 스토어에서 이어서 만나실 수 있어요.\n\n다음 행사에서도 반갑게 만나요!"),
            is_fallback=True)
