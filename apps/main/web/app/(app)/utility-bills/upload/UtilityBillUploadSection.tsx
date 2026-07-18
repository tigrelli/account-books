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
import {
  UTILITY_BILL_SECTIONS,
  ELECTRICITY_SEDAE_LABEL,
  ELECTRICITY_GONGDONG_LABEL,
  WATER_SEDAE_LABEL,
  WATER_GONGDONG_LABEL,
  type UtilityBillItemCandidate,
} from "@/lib/utility-bill-parse";

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
    }
  | {
      step: "confirm-previous-payment";
      extraction: SuccessExtraction;
      file: File;
      replaceExisting: boolean;
      paymentMethodId: string;
      displayName: string;
    }
  | {
      step: "select-payment";
      extraction: SuccessExtraction;
      file: File;
      replaceExisting: boolean;
      options: PaymentMethodOption[];
    }
  | {
      step: "ready";
      extraction: SuccessExtraction;
      file: File;
      replaceExisting: boolean;
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

// 명세서 원본의 구획(부가세항목/부가세제외항목/전기·수도료)별로 표+소계를 따로 보여준다
// (2026-07-14, PM 요청 — 원본 영수증 구조를 그대로 반영). 웹/태블릿(sm 이상)은
// 부가세항목·부가세제외항목을 나란히 2열로, 전기·수도료는 그 아래 전체 폭으로 배치하고,
// 모바일은 세 구획을 1열로 쌓되 타이틀로 구분한다.
function ItemSectionTable({ title, items }: { title: string; items: UtilityBillItemCandidate[] }) {
  if (items.length === 0) return null;
  const subtotal = items.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {items.map((item, i) => (
              <tr key={`${title}-${i}`} className="border-b border-[#e2e8f0] last:border-b-0">
                <td className="py-1.5 pr-3 text-[var(--color-text-secondary)]">{item.label}</td>
                <td className="py-1.5 text-right font-mono text-[var(--color-text-primary)]">
                  {item.amount.toLocaleString("ko-KR")}원
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-2 text-sm font-semibold text-[var(--color-text-primary)]">소계</td>
              <td className="pt-2 text-right font-mono text-sm font-semibold text-[var(--color-text-primary)]">
                {subtotal.toLocaleString("ko-KR")}원
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// "전기·수도료" 섹션 전용 레이아웃(2026-07-14, PM 확인) — 원본 영수증의 해당 구역이
// "전기료(세대/공동) | 수도료(세대/공동)" 2열 구조에 "부가세" 한 줄이 그 아래 따로
// 붙는 형태라, 다른 두 섹션(부가세항목/부가세제외항목)과 달리 ItemSectionTable의 단순
// 1열 표를 쓰지 않고 이 구조를 그대로 재현한다.
function UtilityFeeSectionTable({ items }: { items: UtilityBillItemCandidate[] }) {
  if (items.length === 0) return null;
  const electricity = items.filter(
    (i) => i.label === ELECTRICITY_SEDAE_LABEL || i.label === ELECTRICITY_GONGDONG_LABEL
  );
  const water = items.filter(
    (i) => i.label === WATER_SEDAE_LABEL || i.label === WATER_GONGDONG_LABEL
  );
  const rest = items.filter((i) => !electricity.includes(i) && !water.includes(i)); // "부가세" 등
  const subtotal = items.reduce((sum, i) => sum + i.amount, 0);

  const feeRows = (rows: UtilityBillItemCandidate[], keyPrefix: string) =>
    rows.map((item, i) => (
      <tr key={`${keyPrefix}-${i}`} className="border-b border-[#e2e8f0] last:border-b-0">
        <td className="py-1.5 pr-3 text-[var(--color-text-secondary)]">
          {item.label.replace(/^(전기료|수도료)/, "").replace(/[()]/g, "")}
        </td>
        <td className="py-1.5 text-right font-mono text-[var(--color-text-primary)]">
          {item.amount.toLocaleString("ko-KR")}원
        </td>
      </tr>
    ));

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">전기·수도료</p>
      <div className="grid grid-cols-2 gap-x-4">
        <div className="overflow-x-auto">
          <p className="mb-1 text-xs text-[var(--color-text-secondary)]/70">전기료</p>
          <table className="w-full border-collapse text-sm">
            <tbody>{feeRows(electricity, "electricity")}</tbody>
          </table>
        </div>
        <div className="overflow-x-auto">
          <p className="mb-1 text-xs text-[var(--color-text-secondary)]/70">수도료</p>
          <table className="w-full border-collapse text-sm">
            <tbody>{feeRows(water, "water")}</tbody>
          </table>
        </div>
      </div>

      {rest.map((item, i) => (
        <div
          key={`rest-${i}`}
          className="mt-2 flex items-center justify-between border-t border-[#e2e8f0] pt-2 text-sm"
        >
          <span className="text-[var(--color-text-secondary)]">{item.label}</span>
          <span className="font-mono text-[var(--color-text-primary)]">
            {item.amount.toLocaleString("ko-KR")}원
          </span>
        </div>
      ))}

      <div className="mt-1 flex items-center justify-between pt-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span>소계</span>
        <span className="font-mono">{subtotal.toLocaleString("ko-KR")}원</span>
      </div>
    </div>
  );
}

// [F-2-1-1~3, F-2-2-1] 명세서 업로드: 파일 선택 → OCR 미리보기 → 재업로드 충돌 판정
// (케이스 A/B) → 매칭률 판정(S-2-9, §1-2 3번) — 동일 양식이면 바로, 최초/형식변경이면
// 항목 선정 화면(/utility-bills/upload/items)을 거쳐 → 결제수단/지출일 확정 →
// 저장(TRANSACTION + UTILITY_BILL_RECORD + UTILITY_BILL_ITEM_VALUE 생성, 원본 파일
// Storage 업로드).
export function UtilityBillUploadSection({ recentStatus }: { recentStatus: PeriodStatus[] }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // ConfirmDialog의 확인/취소 버튼이 둘 다 AlertDialog.Close라 어느 쪽을 눌러도
  // onOpenChange(false)가 같이 호출된다. "이 결제수단으로"(확인) 클릭 시 onConfirm이
  // stage를 "ready"로 바꾼 직후 onOpenChange의 비동기 select-payment 전환이 그 위에
  // 덮어써서, 확인을 눌렀는데도 결제수단 선택 팝업으로 넘어가는 문제가 있었다
  // (2026-07-14 PM 실사용 중 발견). onOpenChange는 클릭 시점의 stage를 클로저로 들고
  // 있어 onConfirm이 이미 stage를 바꿨어도 그걸 못 보고 옛 stage 기준으로 판단한다 —
  // 확인 버튼을 눌렀다는 사실 자체를 ref로 표시해 onOpenChange가 건너뛰게 한다.
  const paymentConfirmedRef = useRef(false);

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
      await savePendingExtraction(extraction, file, replaceExisting, formatMatch.activeItems);
      router.push("/utility-bills/upload/items");
      return;
    }
    await resolvePaymentMethod(extraction, file, replaceExisting);
  }

  async function resolvePaymentMethod(
    extraction: SuccessExtraction,
    file: File,
    replaceExisting: boolean
  ) {
    setStage({ step: "checking-payment", extraction, file, replaceExisting });
    const recent = await getRecentPaymentMethodAction();
    if (recent.found) {
      setStage({
        step: "confirm-previous-payment",
        extraction,
        file,
        replaceExisting,
        paymentMethodId: recent.paymentMethodId,
        displayName: recent.displayName,
      });
      return;
    }
    const options = await getActivePaymentMethodsAction();
    setStage({ step: "select-payment", extraction, file, replaceExisting, options });
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
    void resolvePaymentMethod(extraction, pending.file, pending.replaceExisting);
  }, []);

  async function processFile(file: File) {
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

      const conflict = await checkPeriodConflictAction(extraction.period);
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
    const { extraction, file, replaceExisting, paymentMethodId, occurredAt } = stage;

    setStage({ step: "saving" });
    const formData = new FormData();
    formData.set("extraction", JSON.stringify(extraction));
    formData.set("paymentMethodId", paymentMethodId);
    formData.set("occurredAt", occurredAt);
    formData.set("replaceExisting", String(replaceExisting));
    formData.set("file", file);

    const result = await saveUtilityBillAction(formData);
    if (result.status === "error") {
      setStage({ step: "error", message: result.message });
      return;
    }
    setStage({ step: "saved", occurredAt, period: extraction.period ?? "" });
  }

  const isProcessing = stage.step === "processing" || stage.step === "saving";
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

          {mismatch && (
            <p className="text-xs text-[var(--paylens-accent)]">
              지정 항목 합계({itemsTotal.toLocaleString("ko-KR")}원)와 총액이 다릅니다 — 저장 후
              통계 화면에서 계속 확인할 수 있습니다.
            </p>
          )}

          {/* 명세서의 "관리비 납입" 표를 원본 구획(부가세항목/부가세제외항목/전기·수도료)
              그대로 옮긴 형태 — 사용량별 지침(전월/당월)은 여기서 보여주지 않는다.
              저장 후 통계 화면에서 확인한다. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {UTILITY_BILL_SECTIONS.slice(0, 2).map((section) => (
              <ItemSectionTable
                key={section}
                title={section}
                items={stage.extraction.items.filter((i) => i.section === section)}
              />
            ))}
          </div>
          <UtilityFeeSectionTable
            items={stage.extraction.items.filter((i) => i.section === "전기·수도료")}
          />

          <div className="flex items-center justify-between border-t border-[#e2e8f0] pt-3">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">합계</span>
            <span className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
              {itemsTotal.toLocaleString("ko-KR")}원
            </span>
          </div>

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
        message={`이미 등록한 ${stage.step === "blocked" ? formatMonthLabel(stage.period) : ""} 관리비 내역이 있습니다.\n관리비 내역을 삭제 후 명세서를 업로드할 수 있습니다.`}
      />

      <ConfirmDialog
        open={stage.step === "confirm-reupload"}
        onOpenChange={(open) => {
          if (!open) setStage({ step: "idle" });
        }}
        message={`이미 등록된 ${stage.step === "confirm-reupload" ? formatMonthLabel(stage.extraction.period ?? "") : ""} 명세가 있습니다.\n재업로드 할 경우 기존 데이터는 삭제됩니다.`}
        confirmLabel="재업로드"
        onConfirm={() => {
          if (stage.step === "confirm-reupload") {
            void proceedAfterConflictResolved(stage.extraction, stage.file, true);
          }
        }}
      />

      <ConfirmDialog
        open={stage.step === "confirm-previous-payment"}
        onOpenChange={(open) => {
          if (open) return;
          if (paymentConfirmedRef.current) {
            paymentConfirmedRef.current = false;
            return;
          }
          if (stage.step === "confirm-previous-payment") {
            void getActivePaymentMethodsAction().then((options) =>
              setStage({
                step: "select-payment",
                extraction: stage.extraction,
                file: stage.file,
                replaceExisting: stage.replaceExisting,
                options,
              })
            );
          }
        }}
        message={
          stage.step === "confirm-previous-payment"
            ? `직전에는 "${stage.displayName}"(으)로 등록하셨습니다.\n이 결제수단으로 등록할까요?`
            : ""
        }
        confirmLabel="이 결제수단으로"
        cancelLabel="직접 선택"
        onConfirm={() => {
          paymentConfirmedRef.current = true;
          if (stage.step === "confirm-previous-payment") {
            setStage({
              step: "ready",
              extraction: stage.extraction,
              file: stage.file,
              replaceExisting: stage.replaceExisting,
              paymentMethodId: stage.paymentMethodId,
              occurredAt: lastDayOfPeriod(stage.extraction.period ?? ""),
            });
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
          defaultOccurredAt={lastDayOfPeriod(stage.extraction.period ?? "")}
          onConfirm={(paymentMethodId, occurredAt) => {
            if (stage.step === "select-payment") {
              setStage({
                step: "ready",
                extraction: stage.extraction,
                file: stage.file,
                replaceExisting: stage.replaceExisting,
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
