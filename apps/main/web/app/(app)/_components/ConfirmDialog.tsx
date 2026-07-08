"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";

// 시스템 alert/confirm 대신 앱 디자인을 따르는 레이어 팝업(2026-07-03 PM 결정) — 이미
// IconPicker(CategorySection.tsx)에서 쓰고 있는 @base-ui/react 계열 컴포넌트를 그대로 활용.
// budgets(예산 리셋 확인)뿐 아니라 expenses(지출 삭제 확인) 등 여러 화면에서 재사용하므로
// 화면별 폴더가 아닌 공용 컴포넌트 폴더(_components)에 둔다.
export function ConfirmDialog({
  open,
  onOpenChange,
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        {/* 캘린더 수정 팝업(EditExpenseDialog, z-50) 등 다른 Dialog 위에 중첩되어 열릴 수 있어,
            그보다 높은 z-index를 명시하지 않으면 z-index:auto가 z-50보다 낮게 계산되어
            뒤에 깔린 채 렌더링되고 클릭도 뒤쪽 다이얼로그 요소가 가로챈다. */}
        <AlertDialog.Backdrop className="fixed inset-0 z-[60] bg-black/40" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-[61] w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
          <AlertDialog.Description className="text-sm text-[var(--color-text-primary)]">
            {message}
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Close className="h-9 rounded-lg px-3 text-sm font-medium text-[var(--color-text-secondary)] hover:underline">
              {cancelLabel}
            </AlertDialog.Close>
            <AlertDialog.Close
              onClick={onConfirm}
              className="h-9 rounded-lg bg-[var(--paylens-action)] px-3 text-sm font-semibold text-white"
            >
              {confirmLabel}
            </AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
