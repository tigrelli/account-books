import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UtilityBillExtraction } from "../lib/utility-bill-parse";

// [T-2-1] 이 레포 최초로 `createSupabaseServerClient()`를 통째로 모킹해 server action을
// 단위테스트한다(선례: stats-cache.ts처럼 supabase를 파라미터로 받는 함수만 테스트돼 있었음,
// 2026-07-18 PM 확인 후 채택). from(table)이 반환하는 체이닝 빌더는 각 메서드 호출을
// callLog에 기록하고, 터미널 호출(maybeSingle/single/그냥 await하는 경우의 then)에서
// 테이블별로 미리 큐잉해둔 응답을 순서대로 꺼내 돌려준다.
type FakeResponse = { data: unknown; error?: unknown };

let tableQueues: Record<string, FakeResponse[]>;
let tableCounters: Record<string, number>;
let callLog: Array<{ table: string; method: string; args: unknown[] }>;

function queueTable(table: string, ...responses: FakeResponse[]) {
  tableQueues[table] = responses;
  tableCounters[table] = 0;
}

function nextResponse(table: string): FakeResponse {
  const i = tableCounters[table] ?? 0;
  tableCounters[table] = i + 1;
  return tableQueues[table]?.[i] ?? { data: null, error: null };
}

const CHAIN_METHODS = [
  "select",
  "eq",
  "order",
  "limit",
  "insert",
  "delete",
  "update",
  "in",
] as const;

function tableBuilder(table: string) {
  const builder: Record<string, unknown> = {};
  for (const method of CHAIN_METHODS) {
    builder[method] = (...args: unknown[]) => {
      callLog.push({ table, method, args });
      return builder;
    };
  }
  builder.maybeSingle = () => {
    callLog.push({ table, method: "maybeSingle", args: [] });
    return Promise.resolve(nextResponse(table));
  };
  builder.single = () => {
    callLog.push({ table, method: "single", args: [] });
    return Promise.resolve(nextResponse(table));
  };
  // insert()/delete().eq()처럼 select 없이 바로 await되는 경우를 위한 thenable
  builder.then = (resolve: (v: FakeResponse) => unknown) => {
    callLog.push({ table, method: "then", args: [] });
    resolve(nextResponse(table));
  };
  return builder;
}

const mockGetUser = vi.fn();
const storageRemove = vi.fn();
const storageCreateSignedUploadUrl = vi.fn();
const storageUploadToSignedUrl = vi.fn();

vi.mock("@account-books/supabase-client", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => tableBuilder(table),
    storage: {
      from: () => ({
        remove: storageRemove,
        createSignedUploadUrl: storageCreateSignedUploadUrl,
        uploadToSignedUrl: storageUploadToSignedUrl,
      }),
    },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const {
  checkPeriodConflictAction,
  saveUtilityBillAction,
  deactivateUnselectedUtilityBillItemsAction,
} = await import("../app/(app)/utility-bills/actions");

beforeEach(() => {
  tableQueues = {};
  tableCounters = {};
  callLog = [];
  mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
  storageRemove.mockReset().mockResolvedValue({ data: null, error: null });
  storageCreateSignedUploadUrl
    .mockReset()
    .mockResolvedValue({ data: { path: "user-1/2026-07.jpg", token: "tok" }, error: null });
  storageUploadToSignedUrl.mockReset().mockResolvedValue({ data: null, error: null });
});

function makeExtraction(overrides: Partial<UtilityBillExtraction> = {}): UtilityBillExtraction {
  return {
    period: "2026-07",
    total: 165600,
    usageTable: [],
    items: [{ label: "일반관리비", amount: 100000, section: "부가세제외항목" }],
    ...overrides,
  };
}

function makeFormData(
  extraction: UtilityBillExtraction,
  opts: { replaceExisting?: boolean } = {}
): FormData {
  const fd = new FormData();
  fd.set("extraction", JSON.stringify(extraction));
  fd.set("paymentMethodId", "pm-1");
  fd.set("occurredAt", "2026-07-31");
  fd.set("replaceExisting", opts.replaceExisting ? "true" : "false");
  fd.set("file", new File(["dummy"], "bill.jpg", { type: "image/jpeg" }));
  return fd;
}

describe("checkPeriodConflictAction", () => {
  it("기존 등록이 없으면 최초 업로드로 판정한다(none)", async () => {
    queueTable("utility_bill_record", { data: null });
    const result = await checkPeriodConflictAction("2026-07");
    expect(result).toEqual({ status: "none" });
  });

  it("기존 등록이 수동 입력(MANUAL)이면 업로드를 차단한다(케이스 A, blocked)", async () => {
    queueTable("utility_bill_record", { data: { source: "MANUAL" } });
    const result = await checkPeriodConflictAction("2026-07");
    expect(result).toEqual({ status: "blocked" });
  });

  it("기존 등록이 업로드(UPLOAD)면 재업로드 확인이 필요하다(케이스 B, confirm_needed)", async () => {
    queueTable("utility_bill_record", { data: { source: "UPLOAD" } });
    const result = await checkPeriodConflictAction("2026-07");
    expect(result).toEqual({ status: "confirm_needed" });
  });
});

describe("saveUtilityBillAction", () => {
  it("최초 업로드: 지출처/항목이 없으면 새로 만들고 저장한다", async () => {
    queueTable("category", { data: { id: "cat-1" } });
    queueTable("vendor", { data: null }, { data: { id: "vendor-1" } }); // 조회 없음 → 생성
    queueTable("transaction", { data: { id: "tx-1" } });
    queueTable("utility_bill_record", { data: { id: "record-1" } });
    queueTable("utility_bill_item", { data: null }, { data: { id: "item-1" } }); // 조회 없음 → 생성
    queueTable("utility_bill_item_value", { data: null, error: null });

    const result = await saveUtilityBillAction(makeFormData(makeExtraction()));

    expect(result).toEqual({ status: "success" });
    expect(callLog.filter((c) => c.table === "vendor" && c.method === "insert")).toHaveLength(1);
    expect(
      callLog.filter((c) => c.table === "utility_bill_item" && c.method === "insert")
    ).toHaveLength(1);
    expect(callLog.filter((c) => c.table === "transaction" && c.method === "delete")).toHaveLength(
      0
    );
    expect(storageCreateSignedUploadUrl).toHaveBeenCalledWith("user-1/2026-07.jpg");
    expect(storageUploadToSignedUrl).toHaveBeenCalled();
  });

  it("재업로드-동일형식: 같은 라벨이 이미 있으면 UTILITY_BILL_ITEM을 새로 만들지 않고 재사용한다", async () => {
    queueTable("category", { data: { id: "cat-1" } });
    queueTable("vendor", { data: { id: "vendor-1" } }); // 기존 지출처 재사용
    queueTable(
      "utility_bill_record",
      { data: { transaction_id: "old-tx" } },
      { data: { id: "record-2" } }
    );
    queueTable("transaction", { data: null, error: null }, { data: { id: "tx-2" } }); // delete 후 insert
    queueTable("utility_bill_item", { data: { id: "item-1" } }); // 라벨 일치 → 조회만
    queueTable("utility_bill_item_value", { data: null, error: null });

    const result = await saveUtilityBillAction(
      makeFormData(makeExtraction(), { replaceExisting: true })
    );

    expect(result).toEqual({ status: "success" });
    expect(callLog.filter((c) => c.table === "transaction" && c.method === "delete")).toHaveLength(
      1
    );
    expect(callLog.filter((c) => c.table === "vendor" && c.method === "insert")).toHaveLength(0);
    expect(
      callLog.filter((c) => c.table === "utility_bill_item" && c.method === "insert")
    ).toHaveLength(0);
  });

  it("재업로드-형식변경: 처음 보는 라벨이면 UTILITY_BILL_ITEM을 새로 만든다 (S-2-9 매칭률 판정 자체는 업로드 플로우에 아직 연동되지 않음 — 백로그 B-13)", async () => {
    queueTable("category", { data: { id: "cat-1" } });
    queueTable("vendor", { data: { id: "vendor-1" } });
    queueTable(
      "utility_bill_record",
      { data: { transaction_id: "old-tx" } },
      { data: { id: "record-3" } }
    );
    queueTable("transaction", { data: null, error: null }, { data: { id: "tx-3" } });
    queueTable("utility_bill_item", { data: null }, { data: { id: "item-2" } }); // 새 라벨 → 생성
    queueTable("utility_bill_item_value", { data: null, error: null });

    const result = await saveUtilityBillAction(
      makeFormData(
        makeExtraction({
          items: [{ label: "정화조오물수수료", amount: 5000, section: "부가세제외항목" }],
        }),
        { replaceExisting: true }
      )
    );

    expect(result).toEqual({ status: "success" });
    expect(callLog.filter((c) => c.table === "transaction" && c.method === "delete")).toHaveLength(
      1
    );
    expect(
      callLog.filter((c) => c.table === "utility_bill_item" && c.method === "insert")
    ).toHaveLength(1);
  });

  it("관리비/공과금 카테고리가 없으면 에러를 반환한다", async () => {
    queueTable("category", { data: null });

    const result = await saveUtilityBillAction(makeFormData(makeExtraction()));

    expect(result).toEqual({
      status: "error",
      message: "관리비/공과금 카테고리를 찾을 수 없습니다",
    });
  });

  it("필수 필드가 없으면 에러를 반환한다", async () => {
    const fd = new FormData();
    fd.set("extraction", JSON.stringify(makeExtraction()));
    // paymentMethodId, occurredAt, file 누락

    const result = await saveUtilityBillAction(fd);

    expect(result).toEqual({ status: "error", message: "잘못된 요청입니다" });
  });

  it("extraction JSON이 깨져 있으면 에러를 반환한다", async () => {
    const fd = makeFormData(makeExtraction());
    fd.set("extraction", "{ not json");

    const result = await saveUtilityBillAction(fd);

    expect(result).toEqual({ status: "error", message: "잘못된 요청입니다" });
  });
});

// [F-2-2-2] 화면설계 §2-3 — 항목 선정 화면의 "선택한 항목으로 저장"이 선택되지 않은
// 기존 활성 항목을 is_active=false로 전환하는지 검증.
describe("deactivateUnselectedUtilityBillItemsAction", () => {
  it("선택된 라벨과 일치하는 항목은 비활성화하지 않는다", async () => {
    queueTable("utility_bill_item", { data: [{ id: "item-1", source_labels: ["일반관리비"] }] });

    await deactivateUnselectedUtilityBillItemsAction(["일반관리비"]);

    expect(
      callLog.filter((c) => c.table === "utility_bill_item" && c.method === "update")
    ).toHaveLength(0);
  });

  it("선택되지 않은 기존 활성 항목은 is_active=false로 전환한다", async () => {
    queueTable(
      "utility_bill_item",
      { data: [{ id: "item-2", source_labels: ["정화조오물수수료"] }] },
      { data: null, error: null }
    );

    await deactivateUnselectedUtilityBillItemsAction(["일반관리비"]);

    const updateCall = callLog.find(
      (c) => c.table === "utility_bill_item" && c.method === "update"
    );
    expect(updateCall?.args).toEqual([{ is_active: false }]);
    const inCall = callLog.find((c) => c.table === "utility_bill_item" && c.method === "in");
    expect(inCall?.args).toEqual(["id", ["item-2"]]);
  });

  it("공백 차이만 있는 라벨은 같은 항목으로 보고 비활성화하지 않는다", async () => {
    queueTable("utility_bill_item", { data: [{ id: "item-3", source_labels: ["일반 관리비"] }] });

    await deactivateUnselectedUtilityBillItemsAction(["일반관리비"]);

    expect(
      callLog.filter((c) => c.table === "utility_bill_item" && c.method === "update")
    ).toHaveLength(0);
  });

  it("활성 항목이 없으면 아무것도 하지 않는다", async () => {
    queueTable("utility_bill_item", { data: [] });

    await deactivateUnselectedUtilityBillItemsAction(["일반관리비"]);

    expect(
      callLog.filter((c) => c.table === "utility_bill_item" && c.method === "update")
    ).toHaveLength(0);
  });
});
