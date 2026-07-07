"use client";

import { Dialog } from "@base-ui/react/dialog";

// 등록 완료 안내도 ConfirmDialog와 같은 레이어 팝업 디자인을 쓰되, 선택을 요구하지 않는
// 단순 안내라 AlertDialog가 아닌 일반 Dialog(바깥 클릭/Esc로도 닫힘)를 사용한다.
export function SuccessDialog({
  open,
  onOpenChange,
  message,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
          <Dialog.Description className="text-sm text-[var(--color-text-primary)]">
            {message}
          </Dialog.Description>
          <div className="mt-5 flex justify-end">
            <Dialog.Close className="h-9 rounded-lg bg-[var(--paylens-action)] px-3 text-sm font-semibold text-white">
              확인
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
