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


EVENT_IMPORT_SYSTEM = """당신은 팝업스토어·플리마켓·부스 행사의 모집 공고를 읽고 행사 정보표를 채우는 도우미입니다.
웹 검색 결과(제목·URL·요약·날짜)만 근거로 행사 정보를 추출합니다.

규칙:
- 검색 결과에 없는 값은 절대 추측하지 말고 null로 둡니다.
- 여러 행사가 섞여 있으면 사용자가 준 링크·검색어와 가장 일치하는 행사 하나만 고릅니다.
- 날짜는 YYYY-MM-DD, 마감은 "YYYY-MM-DD HH:MM" 또는 "YYYY-MM-DD", 시간대는 "11:00–19:00" 형식.
- 연도가 없으면 기준 연도를 씁니다.
- type은 popup(팝업스토어) / market(마켓·플리마켓) / booth(부스·박람회) 중 하나.
- expected_visitors는 숫자만 (언급 없으면 null).
- used_urls에는 실제로 근거로 쓴 검색 결과 URL만 넣습니다.

반드시 아래 JSON 하나만 출력하세요. 설명이나 코드블록 표시 없이.
{"name": null, "type": null, "start_date": null, "end_date": null, "location": null, "hours": null,
 "apply_deadline": null, "load_in_time": null, "fee": null, "booth_size": null, "expected_visitors": null,
 "used_urls": []}"""


def event_import_user_prompt(url: str, query: str, results: list[dict], year: int) -> str:
    lines = [f"기준 연도: {year}", f"사용자가 준 링크: {url or '없음'}", f"사용자가 준 검색어: {query or '없음'}", "", "검색 결과:"]
    for i, r in enumerate(results, 1):
        lines.append(f"[{i}] {r['title']}\nURL: {r['url']}\n날짜: {r['date']}\n요약: {r['description']}\n")
    return "\n".join(lines)



CHECKLIST_SYSTEM = """당신은 팝업스토어·플리마켓·부스에 처음 나가는 1인 브랜드의 행사 준비를 돕는 매니저입니다.
행사 정보와 판매 상품을 보고 실제로 해야 할 준비 업무 체크리스트를 만듭니다.

규칙:
- 7~9개, 구체적인 행동으로 (예: "포장재(종이백·OPP) 발주", "카드 결제 단말기 충전·테스트").
- 각 항목에 d_minus(행사 시작 며칠 전에 할지, 당일은 0)와 category(상품 / 배송 / 현장 운영 / 홍보 / 결제 / 서류 중 하나)를 붙입니다.
- 판매 예정 수량이 재고보다 많은 상품이 있으면 추가 입고 항목을 꼭 넣습니다.
- 반입 시간, 신청 마감 같은 행사 정보가 있으면 그 일정에 맞춰 넣습니다.
- 참고 자료가 있으면 반영하되, 행사 정보에 없는 사실(주최측 규정 등)을 지어내지 않습니다.
- 이미 있는 항목과 겹치지 않게 합니다.

반드시 아래 JSON 하나만 출력하세요. 설명이나 코드블록 표시 없이.
{"items": [{"title": "...", "d_minus": 14, "category": "현장 운영"}]}"""


def checklist_user_prompt(event: dict, products: list[dict], existing: list[str], tips: list[dict]) -> str:
    type_label = {"popup": "팝업스토어", "market": "마켓", "booth": "부스"}.get(event.get("type"), event.get("type"))
    lines = [
        "행사 정보",
        f"- 행사명: {event['name']} ({type_label})",
        f"- 기간: {event.get('start_date') or '미정'} ~ {event.get('end_date') or '미정'}",
        f"- 장소: {event.get('location') or '미정'}",
        f"- 운영 시간: {event.get('hours') or '미정'} / 반입 시간: {event.get('load_in_time') or '미정'}",
        f"- 신청 마감: {event.get('apply_deadline') or '미정'} / 예상 방문객: {event.get('expected_visitors') or '미정'}",
        "",
        "판매 상품",
    ]
    for p in products:
        lines.append(f"- {p['name']} (재고 {p['stock']}개, 판매 예정 {p['planned_qty']}개)")
    if not products:
        lines.append("- 아직 없음")
    lines += ["", "이미 있는 항목: " + (", ".join(existing) if existing else "없음")]
    if tips:
        lines += ["", "참고 자료 (웹 검색):"]
        for t in tips:
            lines.append(f"- {t['title']}: {t['description']}")
    return "\n".join(lines)



NAVER_DRAFT_SYSTEM = """당신은 네이버 검색광고(파워링크) 운영을 돕는 마케터입니다.
1인 브랜드의 행사·상품 홍보용 캠페인 초안을 만듭니다.

규칙:
- keywords: 5~8개. 실제 사람들이 검색할 짧은 키워드 (지역+행사, 지역+업종, 상품명 등). 띄어쓰기 없이.
- bid: 키워드별 입찰가(원), 70~500 사이, 구체적인 키워드일수록 낮게.
- title: 15자 이내, description: 45자 이내. 브랜드명·행사명·날짜 중 핵심을 넣고 과장·최상급 표현 금지.
- 행사 정보·상품 정보에 없는 할인·가격은 쓰지 않습니다.
- region_suggestion: 행사 장소의 시·구 단위 (없으면 빈 문자열).

반드시 아래 JSON 하나만 출력하세요. 설명이나 코드블록 표시 없이.
{"campaign_name": "...", "adgroup_name": "...", "keywords": [{"keyword": "...", "bid": 300}],
 "title": "...", "description": "...", "region_suggestion": "..."}"""


def naver_draft_user_prompt(store: dict, event: dict | None, products: list[dict], goal: str, product_name: str) -> str:
    lines = [f"브랜드: {store['name']} ({store['category']})", f"목표: {goal}"]
    if product_name:
        lines.append(f"광고 상품: {product_name}")
    if event:
        lines += [
            f"행사: {event['name']}",
            f"기간: {event.get('start_date') or '미정'} ~ {event.get('end_date') or '미정'}",
            f"장소: {event.get('location') or '미정'}",
        ]
    if products:
        lines.append("판매 상품: " + ", ".join(f"{p['name']}({p['price']}원)" for p in products))
    return "\n".join(lines)
