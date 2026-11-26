import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createManualUtilityBillRecordIfNeeded,
  syncUtilityBillRecordOnUpdate,
  duplicateUtilityBillMessage,
  UTILITY_CATEGORY_NAME,
} from "../lib/utility-bill-record-sync";

// [F-2-4-5] supabase를 파라미터로 받는 함수라 utility-bill-actions.test.ts처럼 모듈 모킹 없이
// 가짜 클라이언트를 직접 넘긴다. 테이블별로 큐잉한 응답을 터미널 호출 순서대로 돌려준다.
type FakeResponse = { data: unknown; error?: unknown };

let queues: Record<string, FakeResponse[]>;
let calls: Array<{ table: string; method: string; args: unknown[] }>;

function queue(table: string, ...responses: FakeResponse[]) {
  queues[table] = responses;
}

function next(table: string): FakeResponse {
  return queues[table]?.shift() ?? { data: null, error: null };
}

function builder(table: string) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "insert", "update", "delete"]) {
    b[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return b;
    };
  }
  b.maybeSingle = () => Promise.resolve(next(table));
  b.then = (resolve: (v: FakeResponse) => unknown) => resolve(next(table));
  return b;
}

const supabase = { from: (table: string) => builder(table) } as unknown as Parameters<
  typeof createManualUtilityBillRecordIfNeeded
>[0];

const input = {
  userId: "user-1",
  transactionId: "tx-1",
  categoryId: "cat-1",
  vendorId: "vendor-gas",
  vendorName: "도시가스",
  occurredAt: "2026-11-20",
};

const utilityCategory = { data: { name: UTILITY_CATEGORY_NAME } };
const otherCategory = { data: { name: "식비" } };

function callsOf(table: string, method: string) {
  return calls.filter((c) => c.table === table && c.method === method);
}

beforeEach(() => {
  queues = {};
  calls = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createManualUtilityBillRecordIfNeeded", () => {
  it("관리비/공과금이 아니면 레코드를 만들지 않는다", async () => {
    queue("category", otherCategory);
    expect(await createManualUtilityBillRecordIfNeeded(supabase, input)).toEqual({ ok: true });
    expect(callsOf("utility_bill_record", "insert")).toHaveLength(0);
  });

  it("관리비/공과금이면 지출처를 포함해 MANUAL 레코드를 만든다", async () => {
    queue("category", utilityCategory);
    expect(await createManualUtilityBillRecordIfNeeded(supabase, input)).toEqual({ ok: true });
    expect(callsOf("utility_bill_record", "insert")[0]?.args[0]).toEqual({
      user_id: "user-1",
      period: "2026-11",
      vendor_id: "vendor-gas",
      source: "MANUAL",
      transaction_id: "tx-1",
    });
  });

  it("같은 달·같은 지출처 중복이면 지출처 이름을 담은 문구로 실패한다", async () => {
    queue("category", utilityCategory);
    queue("utility_bill_record", { data: null, error: { code: "23505" } });
    expect(await createManualUtilityBillRecordIfNeeded(supabase, input)).toEqual({
      ok: false,
      message: duplicateUtilityBillMessage("도시가스"),
    });
  });

  it("중복이 아닌 DB 오류는 일반 문구로 실패한다", async () => {
    queue("category", utilityCategory);
    queue("utility_bill_record", { data: null, error: { code: "42501" } });
    expect(await createManualUtilityBillRecordIfNeeded(supabase, input)).toEqual({
      ok: false,
      message: "관리비 등록에 실패했습니다",
    });
  });
});

describe("syncUtilityBillRecordOnUpdate", () => {
  const manualRecord = {
    id: "rec-1",
    period: "2026-11",
    source: "MANUAL",
    vendor_id: "vendor-gas",
  };

  it("레코드가 없고 관리비/공과금으로 바뀌면 새로 만든다", async () => {
    queue("utility_bill_record", { data: null });
    queue("category", utilityCategory, utilityCategory);
    expect(await syncUtilityBillRecordOnUpdate(supabase, input)).toEqual({ ok: true });
    expect(callsOf("utility_bill_record", "insert")).toHaveLength(1);
  });

  it("레코드가 없고 다른 카테고리면 아무것도 하지 않는다", async () => {
    queue("utility_bill_record", { data: null });
    queue("category", otherCategory);
    expect(await syncUtilityBillRecordOnUpdate(supabase, input)).toEqual({ ok: true });
    expect(callsOf("utility_bill_record", "insert")).toHaveLength(0);
  });

  it("MANUAL 레코드인데 다른 카테고리로 바뀌면 레코드를 삭제한다", async () => {
    queue("utility_bill_record", { data: manualRecord });
    queue("category", otherCategory);
    expect(await syncUtilityBillRecordOnUpdate(supabase, input)).toEqual({ ok: true });
    expect(callsOf("utility_bill_record", "delete")).toHaveLength(1);
  });

  it("UPLOAD 레코드는 카테고리가 바뀌어도 삭제하지 않는다", async () => {
    queue("utility_bill_record", { data: { ...manualRecord, source: "UPLOAD" } });
    queue("category", otherCategory);
    expect(await syncUtilityBillRecordOnUpdate(supabase, input)).toEqual({ ok: true });
    expect(callsOf("utility_bill_record", "delete")).toHaveLength(0);
  });

  it("바뀐 게 없으면 갱신하지 않는다", async () => {
    queue("utility_bill_record", { data: manualRecord });
    queue("category", utilityCategory);
    expect(await syncUtilityBillRecordOnUpdate(supabase, input)).toEqual({ ok: true });
    expect(callsOf("utility_bill_record", "update")).toHaveLength(0);
  });

  it("MANUAL 레코드의 지출일 달과 지출처가 바뀌면 period·vendor_id를 갱신한다", async () => {
    queue("utility_bill_record", { data: manualRecord });
    queue("category", utilityCategory);
    const moved = { ...input, vendorId: "vendor-office", occurredAt: "2026-12-01" };
    expect(await syncUtilityBillRecordOnUpdate(supabase, moved)).toEqual({ ok: true });
    expect(callsOf("utility_bill_record", "update")[0]?.args[0]).toEqual({
      vendor_id: "vendor-office",
      period: "2026-12",
    });
  });

  it("UPLOAD 레코드는 period(청구월)를 유지하고 vendor_id만 갱신한다", async () => {
    queue("utility_bill_record", { data: { ...manualRecord, source: "UPLOAD" } });
    queue("category", utilityCategory);
    const moved = { ...input, vendorId: "vendor-office", occurredAt: "2026-12-01" };
    expect(await syncUtilityBillRecordOnUpdate(supabase, moved)).toEqual({ ok: true });
    expect(callsOf("utility_bill_record", "update")[0]?.args[0]).toEqual({
      vendor_id: "vendor-office",
    });
  });

  it("갱신 결과가 같은 달·같은 지출처와 겹치면 지출처 이름을 담은 문구로 실패한다", async () => {
    queue("utility_bill_record", { data: manualRecord }, { data: null, error: { code: "23505" } });
    queue("category", utilityCategory);
    const moved = { ...input, vendorId: "vendor-office", vendorName: "오피스텔 관리비" };
    expect(await syncUtilityBillRecordOnUpdate(supabase, moved)).toEqual({
      ok: false,
      message: duplicateUtilityBillMessage("오피스텔 관리비"),
    });
  });
});
