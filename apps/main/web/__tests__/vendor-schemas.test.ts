import { describe, it, expect } from "vitest";
import { vendorSchema } from "../lib/vendor-schemas";

describe("vendorSchema", () => {
  it("유효한 이름은 통과한다", () => {
    expect(vendorSchema.safeParse({ name: "이마트" }).success).toBe(true);
  });

  it("이름이 비어있으면 실패한다", () => {
    const result = vendorSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.name).toContain("이름을 입력해 주세요");
    }
  });

  it("이름이 50자를 초과하면 실패한다", () => {
    const result = vendorSchema.safeParse({ name: "a".repeat(51) });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.name).toContain("이름이 너무 깁니다");
    }
  });
});
