import { describe, it, expect } from "vitest";
import { signUpSchema, loginSchema, profileSchema, passwordSchema } from "../lib/auth-schemas";

describe("signUpSchema", () => {
  const valid = {
    name: "홍길동",
    email: "test@example.com",
    password: "password123",
    confirmPassword: "password123",
  };

  it("유효한 입력은 통과한다", () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it("이름이 비어있으면 실패한다", () => {
    const result = signUpSchema.safeParse({ ...valid, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.name).toContain("이름을 입력해 주세요");
    }
  });

  it("이메일 형식이 잘못되면 실패한다", () => {
    const result = signUpSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.email).toContain("올바른 이메일 주소를 입력해 주세요");
    }
  });

  it("비밀번호가 8자 미만이면 실패한다", () => {
    const result = signUpSchema.safeParse({
      ...valid,
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.password).toContain("비밀번호는 8자 이상이어야 합니다");
    }
  });

  it("비밀번호 확인이 일치하지 않으면 실패한다", () => {
    const result = signUpSchema.safeParse({ ...valid, confirmPassword: "different123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.confirmPassword).toContain("비밀번호가 일치하지 않습니다");
    }
  });
});

describe("loginSchema", () => {
  const valid = { email: "test@example.com", password: "password123" };

  it("유효한 입력은 통과한다", () => {
    expect(loginSchema.safeParse(valid).success).toBe(true);
  });

  it("이메일 형식이 잘못되면 실패한다", () => {
    const result = loginSchema.safeParse({ ...valid, email: "bad" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.email).toContain("올바른 이메일 주소를 입력해 주세요");
    }
  });

  it("비밀번호가 비어있으면 실패한다", () => {
    const result = loginSchema.safeParse({ ...valid, password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.password).toContain("비밀번호를 입력해 주세요");
    }
  });
});

describe("profileSchema", () => {
  it("유효한 이름은 통과한다", () => {
    expect(profileSchema.safeParse({ name: "홍길동" }).success).toBe(true);
  });

  it("이름이 비어있으면 실패한다", () => {
    const result = profileSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.name).toContain("이름을 입력해 주세요");
    }
  });
});

describe("passwordSchema", () => {
  const valid = { newPassword: "newpass123", confirmPassword: "newpass123" };

  it("유효한 입력은 통과한다", () => {
    expect(passwordSchema.safeParse(valid).success).toBe(true);
  });

  it("새 비밀번호가 8자 미만이면 실패한다", () => {
    const result = passwordSchema.safeParse({ newPassword: "short", confirmPassword: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.newPassword).toContain("비밀번호는 8자 이상이어야 합니다");
    }
  });

  it("비밀번호 확인이 일치하지 않으면 실패한다", () => {
    const result = passwordSchema.safeParse({ ...valid, confirmPassword: "different" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten((i) => i.message).fieldErrors;
      expect(errors.confirmPassword).toContain("비밀번호가 일치하지 않습니다");
    }
  });
});
