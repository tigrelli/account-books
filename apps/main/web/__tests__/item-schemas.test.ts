import { describe, it, expect } from "vitest";
import { aliasSchema } from "../lib/item-schemas";

describe("aliasSchema", () => {
  it("유효한 별칭은 통과한다", () => {
    expect(aliasSchema.safeParse({ alias: "대파" }).success).toBe(true);
  });

  it("별칭이 비어있으면 실패한다", () => {
    const result = aliasSchema.safeParse({ alias: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.alias).toContain("별칭을 입력해 주세요");
    }
  });

  it("공백만 있으면 실패한다", () => {
    const result = aliasSchema.safeParse({ alias: "   " });
    expect(result.success).toBe(false);
  });

  it("별칭이 30자를 초과하면 실패한다", () => {
    const result = aliasSchema.safeParse({ alias: "a".repeat(31) });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.alias).toContain("별칭이 너무 깁니다");
    }
  });
});
