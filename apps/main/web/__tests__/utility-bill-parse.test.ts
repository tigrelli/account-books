import { describe, it, expect } from "vitest";
import { extractUtilityBill } from "../lib/utility-bill-parse";
import type { OCRResult, OCRTextBlock } from "../lib/ocr";

const WORD_HEIGHT = 20;

// 실제 Vision API 응답처럼 단어 단위 bounding box를 만드는 헬퍼.
function word(text: string, x: number, y: number, w = 50, h = WORD_HEIGHT): OCRTextBlock {
  return {
    text,
    boundingBox: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
  };
}

function result(blocks: OCRTextBlock[]): OCRResult {
  return { fullText: blocks.map((b) => b.text).join(" "), blocks };
}

// 실제 관리비 고지서 사진(docs/sample/, 2026-07-13 검증)의 레이아웃을 단순화해 재현한
// 픽스처 — 사용량별 지침표(좌상단) + 관리비 상세표("부가세제외항목" 헤더) + 총액/청구월이
// 서로 멀리 떨어진 별개 구역에 있다.
function sampleBillBlocks(): OCRTextBlock[] {
  return [
    // 사용량별 지침표 제목 + 4개 행. 칸 사이 간격을 height*1.5(=30) 이상으로 벌려서
    // 실제 표처럼 "서로 다른 칸의 숫자"가 하나로 잘못 병합되지 않게 한다.
    word("지침", 150, 50),
    word("전기", 20, 100, 30),
    word("36507", 90, 100, 60),
    word("36621", 190, 100, 60),
    word("114", 290, 100, 40),
    word("16,186", 370, 100, 60),
    word("온수", 20, 125, 30),
    word("447", 90, 125, 50),
    word("449", 190, 125, 50),
    word("2", 290, 125, 30),
    word("19,220", 370, 125, 60),
    word("수도", 20, 150, 30),
    word("852", 90, 150, 50),
    word("855", 190, 150, 50),
    word("5", 290, 150, 30),
    word("10,780", 370, 150, 60),
    word("난방", 20, 175, 30),
    word("1609", 90, 175, 50),
    word("1609", 190, 175, 50),

    // 관리비 상세표: "부가세제외항목" 헤더 + 2개 행(라벨:금액)
    word("부가세", 400, 500, 55),
    word("제외", 460, 500, 45),
    word("항목", 510, 500, 40),
    word("보험료", 340, 560, 55),
    word("2,550", 550, 560, 55),
    word("소독비", 340, 590, 55),
    word("640", 550, 590, 40),

    // 총액 + 청구월
    word("2026", 50, 800, 45),
    word("년", 100, 800, 20),
    word("01", 130, 800, 25),
    word("월", 160, 800, 20),
    word("납기", 50, 850, 45),
    word("내", 100, 850, 20),
    word("금액", 125, 850, 40),
    word("165,600", 250, 850, 65),
  ];
}

describe("extractUtilityBill", () => {
  it("사용량별 지침표 + 관리비 상세표 + 총액/청구월을 각각 정확히 추출한다", () => {
    const extraction = extractUtilityBill(result(sampleBillBlocks()));

    expect(extraction.usageTable).toEqual([
      {
        item: "전기",
        meterPrevious: 36507,
        meterCurrent: 36621,
        usageValue: 114,
        usageAmount: 16186,
      },
      { item: "온수", meterPrevious: 447, meterCurrent: 449, usageValue: 2, usageAmount: 19220 },
      { item: "수도", meterPrevious: 852, meterCurrent: 855, usageValue: 5, usageAmount: 10780 },
      {
        item: "난방",
        meterPrevious: 1609,
        meterCurrent: 1609,
        usageValue: null,
        usageAmount: null,
      },
    ]);
    expect(extraction.items).toEqual([
      { label: "보험료", amount: 2550, section: "부가세제외항목" },
      { label: "소독비", amount: 640, section: "부가세제외항목" },
      // 전기/수도 "세대분"은 usageTable의 사용요금을 그대로 다시 인쇄한 값이라
      // extractUtilityFeeItems가 usageTable에서 그대로 가져와 items에도 추가한다.
      { label: "전기료(세대)", amount: 16186, section: "전기·수도료" },
      { label: "수도료(세대)", amount: 10780, section: "전기·수도료" },
    ]);
    expect(extraction.period).toBe("2026-01");
    expect(extraction.total).toBe(165600);
  });

  it("사용량표 항목명과 같은 글자가 멀리 떨어진 다른 구역에 있어도 섞이지 않는다", () => {
    // 2026-07-13 실사진 검증에서 발견: 공지사항 문구 등에 "온수"/"수도" 글자가 우연히
    // 또 나오면 오탐될 수 있어, 제목 좌표 기준 좁은 범위로 한정해야 한다.
    const blocks = [
      ...sampleBillBlocks(),
      word("온수", 900, 700), // 표와 무관한 위치의 "온수" 글자(예: 공지사항 문구)
      word("수도", 950, 700),
    ];
    const extraction = extractUtilityBill(result(blocks));
    expect(extraction.usageTable).toHaveLength(4);
  });

  it("사용량별 지침표 제목이 없으면 빈 배열을 반환한다", () => {
    const extraction = extractUtilityBill(
      result([word("전기", 20, 100, 30), word("16,186", 260, 100, 60)])
    );
    expect(extraction.usageTable).toEqual([]);
  });

  it("관리비 상세표 헤더가 없으면 빈 배열을 반환한다", () => {
    const extraction = extractUtilityBill(
      result([word("보험료", 340, 560, 55), word("2,550", 550, 560, 55)])
    );
    expect(extraction.items).toEqual([]);
  });

  it("총액/청구월 앵커가 없으면 null을 반환한다", () => {
    const extraction = extractUtilityBill(result([word("전기", 20, 100, 30)]));
    expect(extraction.period).toBeNull();
    expect(extraction.total).toBeNull();
  });

  it("금액이 쉼표 단위로 여러 단어로 쪼개져도 하나로 병합해 추출한다", () => {
    const blocks = [
      word("부가세", 400, 500, 55),
      word("제외", 460, 500, 45),
      word("항목", 510, 500, 40),
      word("전력기금", 340, 560, 60),
      word("1", 500, 560, 15),
      word(",", 515, 560, 10),
      word("830", 525, 560, 35),
    ];
    const extraction = extractUtilityBill(result(blocks));
    expect(extraction.items).toEqual([
      { label: "전력기금", amount: 1830, section: "부가세제외항목" },
    ]);
  });

  it("부가세항목/부가세제외항목 두 열을 모두 추출하고 서로 섞이지 않는다", () => {
    const blocks = [
      word("부가세", 50, 500, 55),
      word("항목", 110, 500, 40),
      word("부가세", 500, 500, 55),
      word("제외", 560, 500, 45),
      word("항목", 610, 500, 40),

      // 왼쪽 열(부가세항목)
      word("일반관리비", 10, 560, 90),
      word("45,990", 150, 560, 60),
      word("경비용역비", 10, 590, 90),
      word("12,730", 150, 590, 60),

      // 오른쪽 열(부가세제외항목)
      word("보험료", 450, 560, 55),
      word("2,550", 600, 560, 55),
      word("소득비", 450, 590, 55),
      word("640", 600, 590, 40),
    ];
    const extraction = extractUtilityBill(result(blocks));
    expect(extraction.items).toEqual([
      { label: "일반관리비", amount: 45990, section: "부가세항목" },
      { label: "경비용역비", amount: 12730, section: "부가세항목" },
      { label: "보험료", amount: 2550, section: "부가세제외항목" },
      { label: "소득비", amount: 640, section: "부가세제외항목" },
    ]);
  });

  it("관리비차감처럼 음수 금액도 추출한다", () => {
    const blocks = [
      word("부가세", 400, 500, 55),
      word("제외", 460, 500, 45),
      word("항목", 510, 500, 40),
      word("관리비차감", 340, 560, 80),
      word("-1,410", 550, 560, 60),
    ];
    const extraction = extractUtilityBill(result(blocks));
    expect(extraction.items).toEqual([
      { label: "관리비차감", amount: -1410, section: "부가세제외항목" },
    ]);
  });

  it("'-'가 금액과 별도 토큰으로 분리되어도 음수로 병합해 추출한다", () => {
    const blocks = [
      word("부가세", 400, 500, 55),
      word("제외", 460, 500, 45),
      word("항목", 510, 500, 40),
      word("관리비차감", 340, 560, 80),
      word("-", 545, 560, 12),
      word("1,410", 560, 560, 55),
    ];
    const extraction = extractUtilityBill(result(blocks));
    expect(extraction.items).toEqual([
      { label: "관리비차감", amount: -1410, section: "부가세제외항목" },
    ]);
  });

  // [2026-07-14] 아래 두 테스트는 실제 관리비 고지서 사진(로컬 Storage에 남아있던
  // 2026-01분, 목동현대파리지앙)을 Google Vision으로 재추출해 확보한 실측 좌표를
  // 그대로 옮긴 것 — 합성 픽스처만으로는 못 잡은 실사용 버그 2건의 회귀 방지용.
  it("실측 간격이 좁은 전월/당월 숫자를 하나로 잘못 합치지 않는다", () => {
    // "36507"(x:102~135)과 "36621"(x:160~193) 사이 실측 간격은 25px(글자 높이 17px,
    // 비율 1.47배)로, 기존 병합 임계값(height*1.5)에서는 하나로 합쳐져 이후 모든 값이
    // 한 칸씩 밀리는 문제가 있었다(전기 행 usageAmount가 통째로 null이 됨).
    const blocks = [
      word("지침", 196, 564, 30),
      word("전기", 32, 613, 30),
      word("36507", 102, 612, 33),
      word("36621", 160, 611, 33),
      word("114", 232, 613, 20),
      word("16,186", 286, 612, 38),
    ];
    const extraction = extractUtilityBill(result(blocks));
    expect(extraction.usageTable).toEqual([
      {
        item: "전기",
        meterPrevious: 36507,
        meterCurrent: 36621,
        usageValue: 114,
        usageAmount: 16186,
      },
    ]);
  });

  it("쉼표를 마침표로 오인식한 금액도 추출한다", () => {
    // OCR이 "42,440"의 쉼표를 마침표로 잘못 읽어 "42.440"으로 인식하는 경우가 실사진
    // 재검토에서 확인됨 — 관리비 금액은 항상 정수 원 단위라 마침표를 쉼표와 동일하게
    // 취급해도 안전하다.
    const blocks = [
      word("부가세", 400, 500, 55),
      word("제외", 460, 500, 45),
      word("항목", 510, 500, 40),
      word("일반관리비(비)", 340, 560, 100),
      word("42.440", 550, 560, 60),
    ];
    const extraction = extractUtilityBill(result(blocks));
    expect(extraction.items).toEqual([
      { label: "일반관리비(비)", amount: 42440, section: "부가세제외항목" },
    ]);
  });

  it("실제 고지서의 부가세항목/부가세제외항목 12개 행을 실측 좌표 그대로 정확히 추출한다", () => {
    // 헤더 텍스트는 왼쪽 정렬, 금액은 오른쪽 정렬이라 "헤더 시작 좌표의 중간"을 경계로
    // 쓰면 왼쪽 열(부가세항목)의 오른쪽 정렬 금액이 잘려나가는 문제가 있었다 — "두 헤더
    // 사이 빈 간격의 중간"을 경계로 써야 실제 데이터 폭까지 안정적으로 포함된다.
    const blocks = [
      word("부가세", 532, 831, 45),
      word("항목", 586, 830, 28),
      word("부가세", 710, 828, 45),
      word("제외", 763, 828, 29),
      word("항목", 802, 828, 28),

      // 부가세항목(왼쪽 열) 5행
      word("일반관리비", 479, 848, 57),
      word("1,600", 631, 846, 36),
      word("경비비", 480, 881, 23),
      word("10,780", 625, 881, 44),
      word("청소비", 479, 897, 23),
      word("15,510", 625, 898, 44),
      word("기본난방비", 480, 950, 47),
      word("1,500", 636, 950, 36),
      word("급탕요금", 481, 968, 34),
      word("19,220", 630, 965, 45),

      // 부가세제외항목(오른쪽 열) 7행
      word("일반관리비(비)", 672, 846, 80),
      word("42,440", 812, 845, 47),
      word("장기수선충당금", 674, 863, 66),
      word("5,640", 820, 860, 45),
      word("보험료", 674, 881, 40),
      word("2,550", 821, 879, 45),
      word("소득비", 675, 898, 40),
      word("640", 839, 896, 24),
      word("수선유지비(비)", 675, 913, 77),
      word("18,950", 818, 914, 44),
      word("전력기금", 677, 932, 47),
      word("1,830", 826, 928, 43),
      word("관리비차감", 682, 982, 55),
      word("-1,410", 824, 981, 48),
    ];
    const extraction = extractUtilityBill(result(blocks));
    expect(extraction.items).toEqual([
      { label: "일반관리비", amount: 1600, section: "부가세항목" },
      { label: "경비비", amount: 10780, section: "부가세항목" },
      { label: "청소비", amount: 15510, section: "부가세항목" },
      { label: "기본난방비", amount: 1500, section: "부가세항목" },
      { label: "급탕요금", amount: 19220, section: "부가세항목" },
      { label: "일반관리비(비)", amount: 42440, section: "부가세제외항목" },
      { label: "장기수선충당금", amount: 5640, section: "부가세제외항목" },
      { label: "보험료", amount: 2550, section: "부가세제외항목" },
      { label: "소득비", amount: 640, section: "부가세제외항목" },
      { label: "수선유지비(비)", amount: 18950, section: "부가세제외항목" },
      { label: "전력기금", amount: 1830, section: "부가세제외항목" },
      { label: "관리비차감", amount: -1410, section: "부가세제외항목" },
    ]);
  });

  it("전기·수도 세대/공동 요금과 부가세를 실측 좌표로 추가 추출하고, '부가세' 단독 앵커가 부가세항목/부가세제외항목 헤더와 헷갈리지 않는다", () => {
    // [2026-07-14] PM 확인: 사용량별 지침표는 전월/당월 참고용이고, 실제 관리비납입
    // 금액에는 전기(세대/공동)·수도(세대/공동)·부가세까지 모두 포함되어야 한다. 전기/수도
    // "세대분"은 사용량별 지침표의 사용요금과 동일한 값이 그대로 다시 인쇄되므로
    // usageTable에서 그대로 가져오고, 공동분/기본수도료/공동수도료/부가세는 별도 앵커로
    // 찾는다. "부가세" 단독 문구가 "부가세항목"/"부가세제외항목" 헤더의 "부가세"와 먼저
    // 매칭되지 않아야 하는 게 핵심 검증 포인트.
    const blocks = [
      // 사용량별 지침표 — 전기/수도 세대분 파생용
      word("지침", 196, 564, 30),
      word("전기", 32, 613, 30),
      word("36507", 90, 612, 50),
      word("36621", 190, 611, 50),
      word("114", 290, 613, 30),
      word("16,186", 370, 612, 50),
      word("수도", 33, 650, 30),
      word("852", 90, 650, 50),
      word("855", 190, 650, 50),
      word("5", 290, 650, 30),
      word("10,780", 370, 650, 50),

      // 관리비 상세표 헤더(부가세항목/부가세제외항목) — "부가세" 단독 앵커가 여기 걸리면
      // 안 된다는 것을 검증하는 용도. 아래 전기/수도 요금 구역과 충분히 멀리 떨어뜨려
      // extractItemTable의 검색 범위(rowsWindow)에 우연히 걸리지 않게 한다.
      word("부가세", 532, 200, 45),
      word("항목", 586, 199, 28),
      word("부가세", 710, 197, 45),
      word("제외", 763, 197, 29),
      word("항목", 802, 197, 28),

      // 전기료(공동) — "공동료"
      word("기", 486, 1069, 9),
      word("공동", 503, 1068, 42),
      word("료", 565, 1069, 10),
      word("13,850", 629, 1065, 46),

      // 기본수도료
      word("기본", 679, 1051, 24),
      word("수도료", 704, 1051, 36),
      word("170", 847, 1051, 21),

      // 공동수도료(오수)
      word("공동", 702, 1116, 23),
      word("수도료", 727, 1116, 34),
      word("(", 762, 1116, 4),
      word("오", 767, 1117, 11),
      word(")", 778, 1117, 5),
      word("120", 844, 1119, 22),

      // 부가세(단독) — 위 헤더의 "부가세"와 헷갈리면 안 됨
      word("부가세", 484, 1117, 85),
      word("5,240", 630, 1115, 40),
    ];
    const extraction = extractUtilityBill(result(blocks));
    expect(extraction.items).toEqual([
      { label: "전기료(세대)", amount: 16186, section: "전기·수도료" },
      { label: "수도료(세대)", amount: 10780, section: "전기·수도료" },
      { label: "전기료(공동)", amount: 13850, section: "전기·수도료" },
      // PM 확인(2026-07-14): 기본수도료는 원본에서 "부가세제외항목" 열에 속해 그쪽
      // section으로 분류된다 — 전기·수도료 섹션이 아니다.
      { label: "기본수도료", amount: 170, section: "부가세제외항목" },
      // 영수증 표기는 "공동수도료(오수)"이지만 수도료(공동)와 동일한 값이라 라벨을
      // 통일한다(PM 확인).
      { label: "수도료(공동)", amount: 120, section: "전기·수도료" },
      { label: "부가세", amount: 5240, section: "전기·수도료" },
    ]);
  });

  // [2026-07-14] 아래 두 테스트는 같은 목동현대파리지앙 양식의 다른 청구월(2026-05)
  // 실사진에서 발견된 버그 2건의 회귀 방지용 — 앵커 문구 자체는 같아도 OCR 토큰화가
  // 사진마다 달라질 수 있고(A), 실제로 2자리 금액이 존재한다(B)는 걸 실측으로 확인했다.
  it("(A) OCR 토큰 경계가 문구 경계와 안 맞아도('기'+'공'이 '기공' 한 토큰으로 붙어도) 앵커를 찾는다", () => {
    // 2026-01 사진에서는 "기"+"공동"+"료"로 나뉘어 "공동" 토큰이 따로 있었지만, 2026-05
    // 사진에서는 같은 "전기 공동료" 문구가 "기공"+"동"+"료"로 다르게 쪼개져 있었다 —
    // "공동료"라는 3글자가 어느 토큰에서도 정확히 시작하지 않아 기존 방식(정확히 일치)
    // 으로는 못 찾았다.
    const blocks = [
      word("부가세", 400, 500, 55),
      word("제외", 460, 500, 45),
      word("항목", 510, 500, 40),
      word("기공", 531, 1161, 36),
      word("동", 591, 1162, 13),
      word("료", 629, 1164, 12),
      word("13,460", 707, 1163, 54),
    ];
    const extraction = extractUtilityBill(result(blocks));
    expect(extraction.items).toEqual([
      { label: "전기료(공동)", amount: 13460, section: "전기·수도료" },
    ]);
  });

  it("(B) 2자리 금액(60원)도 추출한다", () => {
    // "공동수도료(오) 60원" — MIN_AMOUNT_DIGITS가 3이었을 때는 2자리 금액이라 걸러졌다.
    const blocks = [
      word("공동", 796, 1230, 31),
      word("수도료", 827, 1230, 44),
      word("(", 871, 1232, 5),
      word("오", 876, 1232, 14),
      word(")", 892, 1232, 5),
      word("60", 980, 1235, 17),
    ];
    const extraction = extractUtilityBill(result(blocks));
    expect(extraction.items).toEqual([
      { label: "수도료(공동)", amount: 60, section: "전기·수도료" },
    ]);
  });

  it("(C) 행 간격이 넓은 사진에서도 마지막 행(관리비차감)이 안 잘리고, '기본수도료'가 중복 추출되지 않는다", () => {
    // 2026-03 사진(같은 양식): "관리비차감" 행이 rowsWindow 경계에서 1~2px 차이로 잘려
    // 누락됐었다 — 여유를 늘려 고쳤다. 그런데 여유를 늘리자 "기본수도료" 행이 전용 앵커
    // (SUB_FEE_ANCHORS)뿐 아니라 일반 표 스캔에도 걸려 중복 추출되는 부작용이 새로
    // 생겨서, 라벨 기준 중복 제거도 같이 검증한다.
    const blocks = [
      word("부가세", 708, 801, 43),
      word("제외", 760, 801, 27),
      word("항목", 798, 801, 26),
      word("전력", 673, 900, 22),
      word("기금", 696, 900, 22),
      word("1,210", 816, 900, 38),
      word("관리비", 674, 950, 34),
      word("차감", 709, 950, 23),
      word("-1,410", 810, 951, 47),

      // 일반 표 스캔의 rowsWindow에도 걸리는 위치의 "기본수도료" 행(전용 앵커와 중복
      // 위험 구간) — xBounds([661,945]ish) 안, y는 관리비차감보다 조금 더 아래.
      word("기본", 676, 1017, 22),
      word("수도료", 699, 1018, 36),
      word("170", 838, 1019, 22),
    ];
    const extraction = extractUtilityBill(result(blocks));
    expect(extraction.items).toEqual([
      { label: "전력 기금", amount: 1210, section: "부가세제외항목" },
      { label: "관리비 차감", amount: -1410, section: "부가세제외항목" },
      { label: "기본수도료", amount: 170, section: "부가세제외항목" },
    ]);
  });

  it("(D) 앵커 글자가 작은 사진에서도 헤더보다 멀리 왼쪽에서 시작하는 라벨이 안 잘린다", () => {
    // 2026-02 사진: anchorHeight가 작아(10px) 기존 여유(4.5배=45px)로는 부족해서
    // "일반관리비"→"관리비"처럼 앞글자가 잘리거나, "청소비"(한 토큰이라 잘리면 통째로
    // 사라짐)가 완전히 누락됐다. word()의 기본 높이(20px)를 쓰면 anchorHeight가 실제보다
    // 커져 이 문제가 재현되지 않으므로, 실측 높이(10~15px) 그대로 지정한다.
    const blocks = [
      word("부가세", 505, 841, 46, 10),
      word("항목", 560, 841, 28, 10),
      word("부가세", 681, 843, 43, 12),
      word("제외", 733, 843, 29, 11),
      word("항목", 770, 844, 29, 11),

      word("일반", 454, 855, 20, 13),
      word("관리비", 476, 855, 33, 14),
      word("1,320", 602, 859, 37, 15),

      word("청소비", 452, 906, 33, 11),
      word("15,510", 595, 909, 45, 14),
    ];
    const extraction = extractUtilityBill(result(blocks));
    expect(extraction.items).toEqual([
      { label: "일반 관리비", amount: 1320, section: "부가세항목" },
      { label: "청소비", amount: 15510, section: "부가세항목" },
    ]);
  });

  it("(E) 실측 간격이 사진 기울기로 살짝 벌어진 사용량 행 마지막 숫자(사용요금)도 놓치지 않는다", () => {
    // 2026-02 사진: "수도" 사용요금(10,840)의 yCenter가 "수도" 라벨 자체보다 8.5px
    // 떨어져 있었는데, 기존 허용폭(height*0.7=8.4px)에 0.1px 차이로 못 미쳐 제외됐다.
    // word()의 기본 높이(20px)를 쓰면 이 근소한 차이가 재현되지 않아, 실측 높이(12~15px)
    // 그대로 지정한다.
    const blocks = [
      word("지침", 181, 564, 34, 18),
      word("수도", 16, 652, 31, 12),
      word("855", 99, 655, 21, 12),
      word("858", 158, 656, 20, 13),
      word("5", 227, 658, 8, 13),
      word("10,840", 269, 659, 38, 15),
    ];
    const extraction = extractUtilityBill(result(blocks));
    expect(extraction.usageTable).toEqual([
      { item: "수도", meterPrevious: 855, meterCurrent: 858, usageValue: 5, usageAmount: 10840 },
    ]);
  });

  it("빈 blocks면 모든 필드가 비어있다", () => {
    const extraction = extractUtilityBill(result([]));
    expect(extraction).toEqual({ period: null, total: null, usageTable: [], items: [] });
  });
});
