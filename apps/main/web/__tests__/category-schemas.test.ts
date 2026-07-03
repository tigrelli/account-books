import { describe, it, expect } from "vitest";
import { categorySchema } from "../lib/category-schemas";

describe("categorySchema", () => {
  it("유효한 입력(이름+아이콘)은 통과한다", () => {
    expect(categorySchema.safeParse({ name: "외식", icon: "🍔" }).success).toBe(true);
  });

  it("아이콘 없이 이름만 있어도 통과한다", () => {
    expect(categorySchema.safeParse({ name: "외식" }).success).toBe(true);
  });

  it("이름이 비어있으면 실패한다", () => {
    const result = categorySchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.name).toContain("이름을 입력해 주세요");
    }
  });

  it("이름이 30자를 초과하면 실패한다", () => {
    const result = categorySchema.safeParse({ name: "a".repeat(31) });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.name).toContain("이름이 너무 깁니다");
    }
  });

  it("아이콘이 10자를 초과하면 실패한다", () => {
    const result = categorySchema.safeParse({ name: "외식", icon: "a".repeat(11) });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.icon).toContain("아이콘은 짧은 이모지 1개만 입력해 주세요");
    }
  });
});
