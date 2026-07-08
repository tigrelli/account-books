import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAdminEmail } from "../lib/admin";

// F-3-1-5 동의어 사전 관리(운영자 전용) 접근 제어의 유일한 방어선 — ADMIN_EMAILS 화이트리스트
// 매칭 로직. 실제 운영자 계정으로 화면 CRUD를 e2e로 재현하는 대신(그 계정은 PM 개인 이메일이라
// 반복 실행 가능한 자동화 테스트가 건드리기엔 안전하지 않음), 이 순수 함수를 직접 검증한다.
describe("isAdminEmail", () => {
  const originalAdminEmails = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    process.env.ADMIN_EMAILS = "admin1@example.com, Admin2@Example.com";
  });

  afterEach(() => {
    process.env.ADMIN_EMAILS = originalAdminEmails;
  });

  it("화이트리스트에 있는 이메일은 true를 반환한다", () => {
    expect(isAdminEmail("admin1@example.com")).toBe(true);
  });

  it("대소문자를 구분하지 않는다", () => {
    expect(isAdminEmail("ADMIN1@EXAMPLE.COM")).toBe(true);
    expect(isAdminEmail("admin2@example.com")).toBe(true);
  });

  it("화이트리스트에 없는 이메일은 false를 반환한다", () => {
    expect(isAdminEmail("nobody@example.com")).toBe(false);
  });

  it("쉼표 뒤 공백을 트리밍하고 매칭한다", () => {
    expect(isAdminEmail("admin2@example.com")).toBe(true);
  });

  it("null/undefined/빈 문자열은 false를 반환한다", () => {
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });

  it("ADMIN_EMAILS가 설정되지 않으면 모든 이메일이 false다", () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail("admin1@example.com")).toBe(false);
  });
});
