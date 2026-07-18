"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import type { PaymentMethodOption } from "../actions";

// [F-2-1-3, PM 결정] 직전 등록 이력이 없을 때(최초) 결제수단 + 지출일을 직접 고르는
// 팝업 — ConfirmDialog/SuccessDialog(단순 메시지+버튼)로는 폼 입력을 못 담아 새로 만듦.
export function PaymentMethodPickerDialog({
  open,
  onOpenChange,
  paymentMethods,
  defaultOccurredAt,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentMethods: PaymentMethodOption[];
  defaultOccurredAt: string;
  onConfirm: (paymentMethodId: string, occurredAt: string) => void;
}) {
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? "");
  const [occurredAt, setOccurredAt] = useState(defaultOccurredAt);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
          <Dialog.Description className="text-sm text-[var(--color-text-primary)]">
            결제수단과 지출일을 선택해주세요
          </Dialog.Description>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                결제수단
              </label>
              <select
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#e2e8f0] px-3 text-sm outline-none focus:border-[var(--paylens-action)]"
              >
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                지출일
              </label>
              <input
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#e2e8f0] px-3 text-sm outline-none focus:border-[var(--paylens-action)]"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close className="h-9 rounded-lg px-3 text-sm font-medium text-[var(--color-text-secondary)] hover:underline">
              취소
            </Dialog.Close>
            <button
              type="button"
              disabled={!paymentMethodId}
              onClick={() => onConfirm(paymentMethodId, occurredAt)}
              className="h-9 rounded-lg bg-[var(--paylens-action)] px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              확인
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
