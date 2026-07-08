import { describe, it, expect } from "vitest";
import { parseQuantityText } from "../lib/quantity-parse";

describe("parseQuantityText", () => {
  it("숫자+단위를 구조화한다", () => {
    expect(parseQuantityText("1개")).toEqual({ value: 1, unitText: "개" });
  });

  it("소수 수량+영문 단위를 구조화한다", () => {
    expect(parseQuantityText("1.5kg")).toEqual({ value: 1.5, unitText: "kg" });
  });

  it("단위 없이 숫자만 있어도 구조화된다", () => {
    expect(parseQuantityText("5")).toEqual({ value: 5, unitText: "" });
  });

  it("숫자와 단위 사이 공백은 무시한다", () => {
    expect(parseQuantityText("2   개")).toEqual({ value: 2, unitText: "개" });
  });

  it("앞뒤 공백은 정리하고 구조화한다", () => {
    expect(parseQuantityText("  3개  ")).toEqual({ value: 3, unitText: "개" });
  });

  it("빈 문자열은 구조화 실패(null)로 처리한다", () => {
    expect(parseQuantityText("")).toBeNull();
  });

  it("선행 숫자가 없으면 구조화 실패(null)로 처리한다", () => {
    expect(parseQuantityText("한줌")).toBeNull();
  });

  it("단위 자리에 숫자/기호가 섞이면 구조화 실패(null)로 처리한다", () => {
    expect(parseQuantityText("1+1")).toBeNull();
  });
});
