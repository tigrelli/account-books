import { describe, it, expect } from "vitest";
import { parseUtilityBillCandidates } from "../lib/utility-bill-parse";
import type { OCRResult, OCRTextBlock } from "../lib/ocr";

// 실제 Vision API 응답처럼 단어 단위 bounding box를 만드는 헬퍼.
// 같은 줄이면 y좌표를 동일하게, 왼쪽부터 순서대로 x를 늘려가며 배치한다.
function word(text: string, line: number, col: number): OCRTextBlock {
  const y = line * 30;
  const x = col * 60;
  return {
    text,
    boundingBox: [
      { x, y },
      { x: x + 50, y },
      { x: x + 50, y: y + 20 },
      { x, y: y + 20 },
    ],
  };
}

function result(blocks: OCRTextBlock[]): OCRResult {
  return { fullText: blocks.map((b) => b.text).join(" "), blocks };
}

describe("parseUtilityBillCandidates", () => {
  it("같은 줄의 라벨+금액(원 결합)을 후보로 추출한다", () => {
    const r = result([word("전기료", 0, 0), word("16,186원", 0, 1)]);
    expect(parseUtilityBillCandidates(r)).toEqual([
      { label: "전기료", amount: 16186, rawLine: "전기료 16,186원" },
    ]);
  });

  it("금액과 '원'이 별도 단어로 분리되어도 결합해서 추출한다", () => {
    const r = result([word("일반관리비", 0, 0), word("45,320", 0, 1), word("원", 0, 2)]);
    expect(parseUtilityBillCandidates(r)).toEqual([
      { label: "일반관리비", amount: 45320, rawLine: "일반관리비 45,320 원" },
    ]);
  });

  it("여러 단어로 된 라벨도 하나로 합친다", () => {
    const r = result([word("공동", 0, 0), word("전기료", 0, 1), word("8,450원", 0, 2)]);
    expect(parseUtilityBillCandidates(r)).toEqual([
      { label: "공동 전기료", amount: 8450, rawLine: "공동 전기료 8,450원" },
    ]);
  });

  it("서로 다른 y좌표는 다른 줄로 분리해서 각각 추출한다", () => {
    const r = result([
      word("전기료", 0, 0),
      word("16,186원", 0, 1),
      word("수도료", 1, 0),
      word("12,000원", 1, 1),
    ]);
    expect(parseUtilityBillCandidates(r)).toEqual([
      { label: "전기료", amount: 16186, rawLine: "전기료 16,186원" },
      { label: "수도료", amount: 12000, rawLine: "수도료 12,000원" },
    ]);
  });

  it("금액이 없는 줄(헤더/주소 등)은 후보에서 제외한다", () => {
    const r = result([word("관리비", 0, 0), word("고지서", 0, 1)]);
    expect(parseUtilityBillCandidates(r)).toEqual([]);
  });

  it("3자리 미만 숫자는 금액으로 인식하지 않는다(오탐 방지)", () => {
    const r = result([word("페이지", 0, 0), word("1", 0, 1)]);
    expect(parseUtilityBillCandidates(r)).toEqual([]);
  });

  it("라벨 없이 금액만 있는 줄은 후보에서 제외한다", () => {
    const r = result([word("16,186원", 0, 0)]);
    expect(parseUtilityBillCandidates(r)).toEqual([]);
  });

  it("빈 blocks면 빈 배열을 반환한다", () => {
    expect(parseUtilityBillCandidates(result([]))).toEqual([]);
  });
});
