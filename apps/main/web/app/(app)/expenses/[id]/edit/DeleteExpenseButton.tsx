"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteExpenseAction } from "../../actions";

export function DeleteExpenseButton({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("이 지출 내역을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
        startTransition(async () => {
          await deleteExpenseAction(transactionId);
          router.push("/expenses");
        });
      }}
      className="text-sm font-medium text-[var(--paylens-accent)] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "삭제 중…" : "이 지출 내역 삭제"}
    </button>
  );
}
