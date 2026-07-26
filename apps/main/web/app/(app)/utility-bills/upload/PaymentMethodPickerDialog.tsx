"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import type { PaymentMethodOption } from "../actions";
import { formatPaymentMethodLabel } from "@/lib/payment-method-format";

// [F-2-1-3, PM 결정] 결제수단 + 지출일을 직접 고르는 팝업 — ConfirmDialog/SuccessDialog
// (단순 메시지+버튼)로는 폼 입력을 못 담아 새로 만듦. 직전(지난달) 등록 결제수단이 있으면
// defaultPaymentMethodId로 기본 선택해둔다(2026-07-26 PM 결정 — 확인 팝업 단계 제거).
export function PaymentMethodPickerDialog({
  open,
  onOpenChange,
  paymentMethods,
  defaultPaymentMethodId,
  defaultOccurredAt,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentMethods: PaymentMethodOption[];
  defaultPaymentMethodId: string | undefined;
  defaultOccurredAt: string;
  onConfirm: (paymentMethodId: string, occurredAt: string) => void;
}) {
  // 직전(지난달) 등록에 쓴 결제수단이 있으면 목록에서 기본 선택해둔다 — 단, 그새
  // 비활성화된 결제수단이라 목록에 없으면(paymentMethods는 활성 결제수단만 포함) 첫
  // 번째 항목으로 대체한다.
  const initialPaymentMethodId =
    (defaultPaymentMethodId && paymentMethods.some((pm) => pm.id === defaultPaymentMethodId)
      ? defaultPaymentMethodId
      : paymentMethods[0]?.id) ?? "";
  const [paymentMethodId, setPaymentMethodId] = useState(initialPaymentMethodId);
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
                    {formatPaymentMethodLabel({
                      display_name: pm.displayName,
                      type: pm.type,
                      card_kind: pm.cardKind,
                      subtype: pm.subtype,
                    })}
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
