import { describe, it, expect } from "vitest";
import { extractUtilityBill } from "../lib/utility-bill-parse";
import type { OCRResult, OCRTextBlock } from "../lib/ocr";

const WORD_HEIGHT = 20;

// 실제 Vision API 응답처럼 단어 단위 bounding box를 만드는 헬퍼.
function word(text: string, x: number, y: number, w = 50): OCRTextBlock {
  return {
    text,
    boundingBox: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + WORD_HEIGHT },
      { x, y: y + WORD_HEIGHT },
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
      { label: "보험료", amount: 2550 },
      { label: "소독비", amount: 640 },
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
    expect(extraction.items).toEqual([{ label: "전력기금", amount: 1830 }]);
  });

  it("빈 blocks면 모든 필드가 비어있다", () => {
    const extraction = extractUtilityBill(result([]));
    expect(extraction).toEqual({ period: null, total: null, usageTable: [], items: [] });
  });
});
