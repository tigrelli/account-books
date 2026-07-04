"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteExpenseAction } from "../../actions";

// onDeleted를 넘기면(캘린더 수정 팝업 등) 목록으로 이동하는 대신 그 콜백만 호출 —
// 기본값(목록 페이지의 전체화면 수정)은 기존과 동일하게 /expenses로 이동.
export function DeleteExpenseButton({
  transactionId,
  onDeleted,
}: {
  transactionId: string;
  onDeleted?: () => void;
}) {
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
          if (onDeleted) {
            onDeleted();
          } else {
            router.push("/expenses");
          }
        });
      }}
      className="text-sm font-medium text-[var(--paylens-accent)] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "삭제 중…" : "이 지출 내역 삭제"}
    </button>
  );
}
