"use client";

import { useRef, useState } from "react";
import {
  extractUtilityBillAction,
  checkPeriodConflictAction,
  type ExtractUtilityBillResult,
} from "../actions";
import { ConfirmDialog } from "../../_components/ConfirmDialog";
import { SuccessDialog } from "../../_components/SuccessDialog";
import { compressImage } from "@/lib/image-compress";

interface PeriodStatus {
  period: string;
  registered: boolean;
}

type SuccessExtraction = Extract<ExtractUtilityBillResult, { status: "success" }>;

type Stage =
  | { step: "idle" }
  | { step: "processing" }
  | { step: "blocked"; period: string }
  | { step: "confirm"; extraction: SuccessExtraction }
  | { step: "ready"; extraction: SuccessExtraction }
  | { step: "error"; message: string };

function formatMonthLabel(period: string): string {
  const month = Number(period.split("-")[1]);
  return `${month}월`;
}

// [F-2-1-2] 재업로드 충돌 판정 API 연동 + 케이스 A/B 팝업. 실제 Storage 저장 및
// TRANSACTION/UTILITY_BILL_RECORD 생성은 F-2-1-3(업로드 완료 확인 화면)에서 진행 —
// 여기서는 OCR 미리보기 + 충돌 확인까지만 담당한다.
export function UtilityBillUploadSection({ recentStatus }: { recentStatus: PeriodStatus[] }) {
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setStage({ step: "confirm", extraction });
        return;
      }
      setStage({ step: "ready", extraction });
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

  const isProcessing = stage.step === "processing";

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
          {isProcessing ? "처리 중..." : "사진 촬영 / 파일 선택"}
        </button>

        {stage.step === "error" && (
          <p className="mt-3 text-sm text-[var(--paylens-accent)]">{stage.message}</p>
        )}
      </div>

      {stage.step === "ready" && (
        <div
          className="space-y-2 rounded-lg p-4"
          style={{ borderRadius: "var(--border-radius-m)", boxShadow: "var(--card-shadow)" }}
        >
          {/* F-2-1-3에서 정식 확인 화면(매칭값+총액+저장)으로 교체될 임시 표시 */}
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {stage.extraction.period} 청구월 · 총액{" "}
            {stage.extraction.total?.toLocaleString("ko-KR") ?? "-"}원
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            추출된 항목 {stage.extraction.items.length}건 — 저장 화면은 다음 단계에서 이어집니다
          </p>
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
        open={stage.step === "confirm"}
        onOpenChange={(open) => {
          if (!open) setStage({ step: "idle" });
        }}
        message={`이미 등록된 ${stage.step === "confirm" ? formatMonthLabel(stage.extraction.period ?? "") : ""} 명세가 있습니다.\n재업로드 할 경우 기존 데이터는 삭제됩니다.`}
        confirmLabel="재업로드"
        onConfirm={() => {
          if (stage.step === "confirm") setStage({ step: "ready", extraction: stage.extraction });
        }}
      />
    </div>
  );
}
