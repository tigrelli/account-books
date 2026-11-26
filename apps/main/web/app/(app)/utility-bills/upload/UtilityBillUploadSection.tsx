"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  extractUtilityBillAction,
  checkPeriodConflictAction,
  checkUtilityBillFormatMatchAction,
  getRecentPaymentMethodAction,
  getActivePaymentMethodsAction,
  saveUtilityBillAction,
  type ExtractUtilityBillResult,
  type PaymentMethodOption,
} from "../actions";
import { ConfirmDialog } from "../../_components/ConfirmDialog";
import { SuccessDialog } from "../../_components/SuccessDialog";
import { PaymentMethodPickerDialog } from "./PaymentMethodPickerDialog";
import { compressImage } from "@/lib/image-compress";
import { lastDayOfPeriod } from "@/lib/period-utils";
import {
  savePendingExtraction,
  loadPendingExtraction,
  clearPendingExtraction,
} from "@/lib/utility-bill-pending-storage";
import { UtilityBillItemBreakdown } from "../_components/UtilityBillItemBreakdown";
import { VendorCombobox, type VendorOption } from "../../_components/VendorCombobox";
import { DEFAULT_UTILITY_VENDOR_NAME } from "@/lib/utility-bill-record-sync";

const vendorInputClassName =
  "h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15 disabled:bg-[var(--paylens-bg)]";

interface PeriodStatus {
  period: string;
  registered: boolean;
}

type SuccessExtraction = Extract<ExtractUtilityBillResult, { status: "success" }>;

type Stage =
  | { step: "idle" }
  | { step: "processing" }
  | { step: "blocked"; period: string }
  | { step: "confirm-reupload"; extraction: SuccessExtraction; file: File } // 케이스 B
  | {
      step: "checking-payment";
      extraction: SuccessExtraction;
      file: File;
      replaceExisting: boolean;
      vendorName: string;
    }
  | {
      step: "select-payment";
      extraction: SuccessExtraction;
      file: File;
      replaceExisting: boolean;
      vendorName: string;
      options: PaymentMethodOption[];
      defaultPaymentMethodId: string | undefined;
    }
  | {
      step: "ready";
      extraction: SuccessExtraction;
      file: File;
      replaceExisting: boolean;
      vendorName: string;
      paymentMethodId: string;
      occurredAt: string;
    }
  | { step: "saving" }
  | { step: "saved"; occurredAt: string; period: string }
  | { step: "error"; message: string };

function formatMonthLabel(period: string): string {
  const month = Number(period.split("-")[1]);
  return `${month}월`;
}

// [F-2-1-1~3, F-2-2-1] 명세서 업로드: 파일 선택 → OCR 미리보기 → 재업로드 충돌 판정
// (케이스 A/B) → 매칭률 판정(S-2-9, §1-2 3번) — 동일 양식이면 바로, 최초/형식변경이면
// 항목 선정 화면(/utility-bills/upload/items)을 거쳐 → 결제수단/지출일 확정 →
// 저장(TRANSACTION + UTILITY_BILL_RECORD + UTILITY_BILL_ITEM_VALUE 생성, 원본 파일
// Storage 업로드).
export function UtilityBillUploadSection({
  recentStatus,
  defaultVendorName,
  vendors,
}: {
  recentStatus: PeriodStatus[];
  defaultVendorName: string;
  vendors: VendorOption[];
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  // [F-2-4-6] 업로드 지출처 — 사진을 고르기 전에 정해서, 재업로드 충돌 판정(케이스 A/B)이
  // 처음부터 이 지출처 기준으로 이뤄지게 한다. 같은 달의 다른 지출처(예: 도시가스) 등록은
  // 충돌이 아니다. 기본값은 직전 업로드 지출처(최초면 "관리사무소").
  const [vendorName, setVendorName] = useState(defaultVendorName);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 화면설계 §1-2 3번 — 매칭률 ≥ 50%면 바로 결제수단 확정(F-2-1-3)으로, 미만(지정 항목이
  // 하나도 없는 최초 업로드 포함)이면 항목 선정 화면(F-2-2-1)으로 보낸다.
  async function proceedAfterConflictResolved(
    extraction: SuccessExtraction,
    file: File,
    replaceExisting: boolean
  ) {
    const labels = extraction.items.map((i) => i.label);
    const formatMatch = await checkUtilityBillFormatMatchAction(labels);
    if (!formatMatch.isSameFormat) {
      await savePendingExtraction(
        extraction,
        file,
        replaceExisting,
        formatMatch.activeItems,
        vendorName
      );
      router.push("/utility-bills/upload/items");
      return;
    }
    await resolvePaymentMethod(extraction, file, replaceExisting, vendorName);
  }

  // [PM 결정, 2026-07-26] "직전 결제수단으로 등록할까요?" 확인 팝업 없이 항상 결제수단/
  // 지출일 선택 팝업으로 바로 이어간다 — 대신 직전(지난달) 등록 결제수단을 선택 목록에서
  // 기본값으로 미리 선택해둔다.
  // 충돌 판정에 쓴 지출처를 stage에 실어 저장까지 그대로 넘긴다 — 항목 선정 화면을 거쳐
  // 돌아온 경우(sessionStorage 복원)에도 같은 경로로 전달돼 별도 state 동기화가 필요 없다.
  async function resolvePaymentMethod(
    extraction: SuccessExtraction,
    file: File,
    replaceExisting: boolean,
    stageVendorName: string
  ) {
    setStage({
      step: "checking-payment",
      extraction,
      file,
      replaceExisting,
      vendorName: stageVendorName,
    });
    const [recent, options] = await Promise.all([
      getRecentPaymentMethodAction(),
      getActivePaymentMethodsAction(),
    ]);
    setStage({
      step: "select-payment",
      extraction,
      file,
      replaceExisting,
      vendorName: stageVendorName,
      options,
      defaultPaymentMethodId: recent.found ? recent.paymentMethodId : undefined,
    });
  }

  // [F-2-2-1] 항목 선정 화면(별도 페이지)에서 "선택한 항목으로 저장" 후 돌아왔을 때 —
  // sessionStorage에 필터링된 extraction이 남아있으면 파일 선택 단계를 건너뛰고 바로
  // 결제수단 확정으로 이어간다(PM 확인: 항목 선정은 선택만 저장하고 기존 확인화면으로
  // 이동하는 구조, 2026-07-18).
  useEffect(() => {
    const pending = loadPendingExtraction();
    if (!pending) return;
    clearPendingExtraction();
    const extraction: SuccessExtraction = { status: "success", ...pending.extraction };
    void resolvePaymentMethod(
      extraction,
      pending.file,
      pending.replaceExisting,
      // 배포 직후 이전 형식으로 저장된 세션 값엔 지출처가 없어 이전 고정값으로 처리한다.
      pending.vendorName || DEFAULT_UTILITY_VENDOR_NAME
    );
  }, []);

  async function processFile(file: File) {
    if (vendorName.trim().length === 0) {
      setStage({ step: "error", message: "지출처를 입력해 주세요" });
      return;
    }
    setStage({ step: "processing" });

    try {
      // 실제 폰카메라 사진(2~3MB대)이 Server Action 본문 제한에 걸리는 문제가 있어
      // 전송 전 압축한다(2026-07-13 실사진 검증에서 발견, lib/image-compress.ts).
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.set("file", compressed);
      const extraction = await extractUtilityBillAction(formData);

      if (extraction.status === "error") {
        setStage({ step: "error", message: extraction.message });
        return;
      }
      if (!extraction.period) {
        setStage({
          step: "error",
          message: "청구월을 읽어내지 못했습니다. 다른 사진으로 다시 시도해주세요.",
        });
        return;
      }

      const conflict = await checkPeriodConflictAction(extraction.period, vendorName);
      if (conflict.status === "blocked") {
        setStage({ step: "blocked", period: extraction.period });
        return;
      }
      if (conflict.status === "confirm_needed") {
        setStage({ step: "confirm-reupload", extraction, file: compressed });
        return;
      }
      await proceedAfterConflictResolved(extraction, compressed, false);
    } catch {
      // 서버 액션이 예외로 끊기는 경우(네트워크 오류, 본문 크기 초과 등) "처리 중..."에
      // 멈춰있지 않도록 방어.
      setStage({ step: "error", message: "처리에 실패했습니다. 다시 시도해주세요." });
    }
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) void processFile(file);
  }

  async function handleSave() {
    if (stage.step !== "ready") return;
    const { extraction, file, replaceExisting, vendorName, paymentMethodId, occurredAt } = stage;

    setStage({ step: "saving" });
    const formData = new FormData();
    formData.set("extraction", JSON.stringify(extraction));
    formData.set("paymentMethodId", paymentMethodId);
    formData.set("occurredAt", occurredAt);
    formData.set("replaceExisting", String(replaceExisting));
    formData.set("vendorName", vendorName);
    formData.set("file", file);

    const result = await saveUtilityBillAction(formData);
    if (result.status === "error") {
      setStage({ step: "error", message: result.message });
      return;
    }
    setStage({ step: "saved", occurredAt, period: extraction.period ?? "" });
  }

  const isProcessing = stage.step === "processing" || stage.step === "saving";
  // 충돌 판정이 끝난 뒤 지출처가 바뀌면 판정과 저장 대상이 어긋나므로, 새 업로드를 시작할
  // 수 있는 상태에서만 수정 가능하게 한다.
  const canEditVendor = stage.step === "idle" || stage.step === "error";
  const lockedVendorName = "vendorName" in stage ? stage.vendorName : vendorName;
  const showItems = stage.step === "ready";

  // usageTable(사용량별 지침표)은 전월/당월/사용량 참고용일 뿐, 관리비납입 금액은 모두
  // items에 들어있다(전기/수도 세대·공동 요금, 부가세 포함 — F-2-1-1~3 PM 확인,
  // 2026-07-14). 여기서 usageTable을 더하면 이중 계산이 된다.
  const rawItemsTotal = showItems
    ? stage.extraction.items.reduce((sum, i) => sum + i.amount, 0)
    : 0;
  // 원단위 반올림 등 고지서 자체의 계산 오차로 몇 원 단위 잔차가 남는 걸 실사진에서
  // 여러 번 확인했다(예: 165,596원 vs 총액 165,600원, 4원 차이 — PM 확인, 2026-07-14).
  // 이 정도 오차는 항목 누락이 아니라 반올림 잔차로 보고 "합계"를 총액에 맞춰 보여주고
  // 불일치 경고도 띄우지 않는다. 실제 누락(예: 전기·수도료 공동분 13,520원 차이)은 이
  // 허용폭보다 훨씬 커서 여전히 경고가 뜬다 — 관측된 가장 작은 실제 항목 금액(60원)보다
  // 충분히 작은 값(10원 미만)으로 잡아 진짜 누락을 가려버리지 않게 한다.
  const ROUNDING_TOLERANCE_WON = 9;
  const officialTotal = showItems ? stage.extraction.total : null;
  const gap = officialTotal != null ? officialTotal - rawItemsTotal : 0;
  const isRoundingGap = gap !== 0 && Math.abs(gap) <= ROUNDING_TOLERANCE_WON;
  const itemsTotal = isRoundingGap && officialTotal != null ? officialTotal : rawItemsTotal;
  const mismatch = officialTotal != null && rawItemsTotal !== officialTotal && !isRoundingGap;

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-[var(--paylens-action)] bg-[var(--paylens-action)]/5"
            : "border-[#e2e8f0]"
        }`}
        style={{ borderRadius: "var(--border-radius-m)", boxShadow: "var(--card-shadow)" }}
      >
        <div className="mx-auto mb-5 max-w-xs text-left">
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
            지출처
          </label>
          {canEditVendor ? (
            <VendorCombobox
              vendors={vendors}
              value={vendorName}
              onChange={setVendorName}
              inputClassName={vendorInputClassName}
              placeholder="지출처 입력 (예: 오피스텔 관리비)"
            />
          ) : (
            <input value={lockedVendorName} disabled className={vendorInputClassName} />
          )}
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            지출 입력에서 직접 등록한 관리비와 같은 지출처를 선택하면 중복 등록을 막을 수 있습니다.
          </p>
        </div>

        <p className="text-sm text-[var(--color-text-secondary)]">
          여기로 사진을 끌어다 놓거나, 아래 버튼으로 촬영/선택해주세요
        </p>

        {/* 모바일에서는 capture 속성으로 카메라 촬영이 기본 경로가 되고, 데스크톱에서는
            일반 파일 선택 창이 뜬다(화면설계 §1-1). */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 h-10 rounded-lg bg-[var(--paylens-action)] px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {stage.step === "processing"
            ? "처리 중..."
            : stage.step === "saving"
              ? "저장 중..."
              : "사진 촬영 / 파일 선택"}
        </button>

        {stage.step === "error" && (
          <p className="mt-3 text-sm text-[var(--paylens-accent)]">{stage.message}</p>
        )}
      </div>

      {showItems && (
        <div
          className="space-y-3 rounded-lg p-4"
          style={{ borderRadius: "var(--border-radius-m)", boxShadow: "var(--card-shadow)" }}
        >
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {stage.extraction.period} 청구월 · 총액{" "}
            {stage.extraction.total?.toLocaleString("ko-KR") ?? "-"}원
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">지출처: {stage.vendorName}</p>

          {mismatch && (
            <p className="text-xs text-[var(--paylens-accent)]">
              지정 항목 합계({itemsTotal.toLocaleString("ko-KR")}원)와 총액이 다릅니다 — 저장 후
              통계 화면에서 계속 확인할 수 있습니다.
            </p>
          )}

          {/* 명세서의 "관리비 납입" 표를 원본 구획(부가세항목/부가세제외항목/전기·수도료)
              그대로 옮긴 형태 — 사용량별 지침(전월/당월)은 여기서 보여주지 않는다.
              저장 후 통계 화면에서 확인한다. */}
          <UtilityBillItemBreakdown items={stage.extraction.items} total={itemsTotal} />

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => void handleSave()}
            className="h-10 w-full rounded-lg bg-[var(--paylens-action)] text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            저장
          </button>
        </div>
      )}

      <div
        className="rounded-lg p-4"
        style={{ borderRadius: "var(--border-radius-m)", boxShadow: "var(--card-shadow)" }}
      >
        <p className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
          최근 등록 현황
        </p>
        <ul className="space-y-1">
          {recentStatus.map(({ period, registered }) => (
            <li
              key={period}
              className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]"
            >
              <span>{formatMonthLabel(period)}</span>
              <span className={registered ? "text-[var(--paylens-action)]" : ""}>
                {registered ? "업로드됨" : "미등록"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <SuccessDialog
        open={stage.step === "blocked"}
        onOpenChange={(open) => {
          if (!open) setStage({ step: "idle" });
        }}
        message={`이미 등록한 ${stage.step === "blocked" ? formatMonthLabel(stage.period) : ""} '${vendorName}' 관리비 내역이 있습니다.\n관리비 내역을 삭제 후 명세서를 업로드할 수 있습니다.`}
      />

      <ConfirmDialog
        open={stage.step === "confirm-reupload"}
        onOpenChange={(open) => {
          if (!open) setStage({ step: "idle" });
        }}
        message={`이미 등록된 ${stage.step === "confirm-reupload" ? formatMonthLabel(stage.extraction.period ?? "") : ""} '${vendorName}' 명세가 있습니다.\n재업로드 할 경우 기존 데이터는 삭제됩니다.`}
        confirmLabel="재업로드"
        onConfirm={() => {
          if (stage.step === "confirm-reupload") {
            void proceedAfterConflictResolved(stage.extraction, stage.file, true);
          }
        }}
      />

      {stage.step === "select-payment" && (
        <PaymentMethodPickerDialog
          open
          onOpenChange={(open) => {
            if (!open) setStage({ step: "idle" });
          }}
          paymentMethods={stage.options}
          defaultPaymentMethodId={stage.defaultPaymentMethodId}
          defaultOccurredAt={lastDayOfPeriod(stage.extraction.period ?? "")}
          onConfirm={(paymentMethodId, occurredAt) => {
            if (stage.step === "select-payment") {
              setStage({
                step: "ready",
                extraction: stage.extraction,
                file: stage.file,
                replaceExisting: stage.replaceExisting,
                vendorName: stage.vendorName,
                paymentMethodId,
                occurredAt,
              });
            }
          }}
        />
      )}

      <SuccessDialog
        open={stage.step === "saved"}
        onOpenChange={(open) => {
          if (!open) router.push("/expenses");
        }}
        // 기본값(청구월 말일) 그대로 저장했을 때만 "말일로 등록됩니다" 안내가 맞다 —
        // 결제수단 선택 팝업에서 지출일을 직접 바꾼 경우에는 그 날짜로 저장됐다고 알려야
        // 한다(2026-07-14 PM 실사용 중 발견 — 날짜를 바꿔 저장했는데도 항상 "말일로
        // 등록됩니다"라고 떠서 혼동).
        message={
          stage.step === "saved"
            ? stage.occurredAt === lastDayOfPeriod(stage.period)
              ? "관리비는 말일로 지출 등록됩니다.\n지출 내역에서 지출일을 수정하실 수 있습니다."
              : `선택하신 ${stage.occurredAt} 지출일로 등록됐습니다.`
            : ""
        }
      />
    </div>
  );
}
