"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { deleteExpenseAction } from "../../actions";
import { ConfirmDialog } from "../../../_components/ConfirmDialog";

// onDeleted를 넘기면(캘린더 수정 팝업 등) 목록으로 이동하는 대신 그 콜백만 호출 —
// 기본값(목록 페이지의 전체화면 수정)은 redirectHref(진입한 목록 페이지/필터, 없으면 /expenses)로 이동.
// 삭제 확인은 시스템 confirm() 대신 공용 ConfirmDialog(레이어 팝업)를 사용한다(PM 요청,
// 2026-07-05 — 다른 삭제/초기화 확인 UI와 동일한 팝업 컴포넌트를 공유).
export function DeleteExpenseButton({
  transactionId,
  onDeleted,
  redirectHref = "/expenses",
  className = "",
}: {
  transactionId: string;
  onDeleted?: () => void;
  redirectHref?: string;
  className?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      await deleteExpenseAction(transactionId);
      // deleteExpenseAction의 revalidatePath는 서버(RSC) 캐시만 무효화한다 — 목록 화면은
      // ExpensesListClient가 /api/expenses를 React Query로 가져오는 별도 클라이언트 캐시라
      // 여기서 직접 invalidate하지 않으면 staleTime(30초) 동안 삭제된 행이 그대로 남아 보인다.
      await queryClient.invalidateQueries({ queryKey: ["expenses-offset"] });
      await queryClient.invalidateQueries({ queryKey: ["expenses-cursor"] });
      if (onDeleted) {
        onDeleted();
      } else {
        router.push(redirectHref);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setConfirmOpen(true)}
        className={`h-10 rounded-lg bg-[var(--paylens-accent)]/10 text-sm font-semibold text-[var(--paylens-accent)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        {isPending ? "삭제 중…" : "삭제"}
      </button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        message="이 지출 내역을 삭제하시겠습니까? 되돌릴 수 없습니다."
        confirmLabel="삭제"
        onConfirm={handleDelete}
      />
    </>
  );
}
