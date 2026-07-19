import { describe, it, expect } from "vitest";
import {
  calculateFormatMatchRate,
  isSameFormat,
  FORMAT_MATCH_THRESHOLD,
} from "../lib/utility-bill-format-match";

describe("calculateFormatMatchRate", () => {
  it("추출된 라벨이 지정 항목과 전부 일치하면 1을 반환한다", () => {
    const rate = calculateFormatMatchRate(
      ["일반관리비(비)", "장기수선충당금", "보험료"],
      [["일반관리비(비)"], ["장기수선충당금"], ["보험료"]]
    );
    expect(rate).toBe(1);
  });

  it("지정 항목 중 절반만 일치하면 0.5를 반환한다", () => {
    const rate = calculateFormatMatchRate(
      ["일반관리비(비)", "전력기금"],
      [["일반관리비(비)"], ["장기수선충당금"]]
    );
    expect(rate).toBe(0.5);
  });

  it("하나도 일치하지 않으면 0을 반환한다", () => {
    const rate = calculateFormatMatchRate(["새항목"], [["일반관리비(비)"], ["장기수선충당금"]]);
    expect(rate).toBe(0);
  });

  it("지정 항목의 별칭(source_labels) 중 하나라도 일치하면 그 항목은 매칭으로 센다", () => {
    const rate = calculateFormatMatchRate(["온수"], [["급탕요금", "온수"]]);
    expect(rate).toBe(1);
  });

  it("OCR이 단어를 쪼개 합칠 때 생기는 공백 차이는 무시하고 비교한다", () => {
    // 2026-07-13 실사진 검증에서 발견: "일반관리비"가 "일반"+"관리비"로 인식되어
    // 합칠 때 "일반 관리비"처럼 공백이 들어감
    const rate = calculateFormatMatchRate(["일반 관리비 ( 비 )"], [["일반관리비(비)"]]);
    expect(rate).toBe(1);
  });

  it("기존 지정 항목이 하나도 없으면(최초 업로드) 0을 반환한다", () => {
    const rate = calculateFormatMatchRate(["일반관리비(비)"], []);
    expect(rate).toBe(0);
  });

  it("추출된 라벨이 없으면 0을 반환한다", () => {
    const rate = calculateFormatMatchRate([], [["일반관리비(비)"]]);
    expect(rate).toBe(0);
  });
});

describe("isSameFormat", () => {
  it(`매칭률이 ${FORMAT_MATCH_THRESHOLD} 이상이면 동일 양식으로 판단한다`, () => {
    expect(isSameFormat(0.5)).toBe(true);
    expect(isSameFormat(0.8)).toBe(true);
    expect(isSameFormat(1)).toBe(true);
  });

  it(`매칭률이 ${FORMAT_MATCH_THRESHOLD} 미만이면 형식변경/최초 업로드로 판단한다`, () => {
    expect(isSameFormat(0.49)).toBe(false);
    expect(isSameFormat(0)).toBe(false);
  });
});
