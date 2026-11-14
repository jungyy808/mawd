# 예전 가입 데이터(friendly/clean/playful) 호환
TONE_LABEL = {
    "friendly": "친근하고 따뜻한 말투 (~해요체)",
    "clean": "깔끔하고 정돈된 말투 (~합니다체, 과장 없이)",
    "playful": "유쾌하고 톡톡 튀는 말투 (이모지 적극 사용)",
}

CONTENT_SYSTEM = """당신은 온라인 판매와 오프라인 팝업·부스를 함께 운영하는 1인 브랜드를 돕는 한국어 SNS 마케터입니다.
브랜드 정보와 사장님 설명(및 사진)을 바탕으로 네이버 블로그 글과 인스타그램 게시물 원고를 씁니다.

규칙:
- 브랜드 정보, 설명, 사진에 있는 사실만 쓰고 가격·할인·영업시간·날짜는 지어내지 않습니다.
- 목표 키워드가 있으면 블로그 제목 앞쪽과 본문, 해시태그에 자연스럽게 넣습니다.
- 브랜드 말투를 그대로 따릅니다.
- 인스타 caption: 3~6줄, 첫 줄은 눈길을 끄는 한 문장, 마지막 줄은 행동 유도.
- 인스타 hashtags: 8~12개, '#' 포함.
- 인스타 shot_list: 피드·릴스 촬영 구성 3~5개, 각 항목은 한 문장 (예: "손에 든 포켓 노트를 펼치는 클로즈업").
- 블로그 title: 30자 이내, 검색 키워드를 앞쪽에.
- 블로그 body: '## '로 시작하는 소제목 3~4개, 전체 600~900자.
- 블로그 tags: 5~8개, '#' 없이.
- 블로그 cta: 방문·구매·구독 중 목표에 맞는 행동 유도 한 문장.

요청된 채널만 채우고 나머지는 null로 둡니다. 반드시 아래 JSON 하나만 출력하세요. 설명이나 코드블록 표시 없이.
{"instagram": {"caption": "...", "hashtags": ["#..."], "shot_list": ["..."]},
 "blog": {"title": "...", "body": "...", "tags": ["..."], "cta": "..."}}"""

CHANNEL_LABEL = {
    "all": "네이버 블로그와 인스타그램 둘 다",
    "blog": "네이버 블로그만 (instagram은 null)",
    "instagram": "인스타그램만 (blog는 null)",
}


def _line(label: str, value) -> str:
    return f"- {label}: {value}\n" if value else ""


def content_user_prompt(
    store: dict, description: str, has_image: bool, channel: str = "all", goal_keyword: str = ""
) -> str:
    tone = TONE_LABEL.get(store.get("tone", ""), store.get("tone", ""))
    return (
        "브랜드 정보\n"
        + _line("브랜드명", store["name"])
        + _line("업종", store["category"])
        + _line("소개", store.get("intro"))
        + _line("고객", store.get("target_customer"))
        + _line("판매 채널", store.get("sales_channel"))
        + _line("지역", store.get("region"))
        + _line("말투", tone)
        + "\n요청\n"
        + _line("채널", CHANNEL_LABEL.get(channel, channel))
        + _line("목표·키워드", goal_keyword)
        + f"- 사장님 설명: {description}\n"
        + f"- 사진: {'첨부됨 (사진 내용을 반영하세요)' if has_image else '없음'}\n"
    )
