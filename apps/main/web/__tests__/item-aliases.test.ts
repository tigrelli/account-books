import { describe, it, expect } from "vitest";
import { itemAliasesToArray, mergeAliases } from "../lib/item-aliases";

describe("itemAliasesToArray", () => {
  it("문자열 배열이면 그대로 반환한다", () => {
    expect(itemAliasesToArray(["대파", "파"])).toEqual(["대파", "파"]);
  });

  it("배열이 아니면 빈 배열을 반환한다", () => {
    expect(itemAliasesToArray(null)).toEqual([]);
    expect(itemAliasesToArray("대파")).toEqual([]);
  });

  it("배열 안의 문자열이 아닌 값은 걸러낸다", () => {
    expect(itemAliasesToArray(["대파", 1, null])).toEqual(["대파"]);
  });
});

describe("mergeAliases", () => {
  it("중복 없는 후보는 그대로 합친다", () => {
    expect(mergeAliases(["대파"], ["쪽파"])).toEqual(["대파", "쪽파"]);
  });

  it("대소문자 무시 중복은 추가하지 않는다", () => {
    expect(mergeAliases(["Onion"], ["onion", "양파"])).toEqual(["Onion", "양파"]);
  });

  it("기존 목록이 비어있어도 정상 동작한다", () => {
    expect(mergeAliases([], ["대파", "파"])).toEqual(["대파", "파"]);
  });
});
