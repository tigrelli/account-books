"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";

// 시스템 alert/confirm 대신 앱 디자인을 따르는 레이어 팝업(2026-07-03 PM 결정) — 이미
// IconPicker(CategorySection.tsx)에서 쓰고 있는 @base-ui/react 계열 컴포넌트를 그대로 활용.
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
        <AlertDialog.Backdrop className="fixed inset-0 bg-black/40" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
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
