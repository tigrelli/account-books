"use client";

import { useActionState, useState, useTransition } from "react";
import type { Database } from "@account-books/types";
import { addSynonymTermAction, deleteSynonymTermAction, type SynonymActionState } from "./actions";

type SynonymRow = Database["public"]["Tables"]["synonym_dictionary"]["Row"];

const initialState: SynonymActionState = { status: "idle" };

const inputClassName =
  "h-10 min-w-0 flex-1 rounded-lg border border-[#e2e8f0] px-3 text-sm outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15";

function DeleteTermButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => deleteSynonymTermAction(id))}
      aria-label="삭제"
      className="text-[var(--color-text-secondary)] hover:text-[var(--paylens-accent)] disabled:cursor-not-allowed"
    >
      ×
    </button>
  );
}

// F-3-1-5: 동의어 그룹 CRUD — group_key는 자유 텍스트라 새 값을 입력하면 새 그룹이 그 자리에서
// 생기고(F-1-4-x 지출처/품목과 동일한 "입력하면 없으면 생성" 관례), 기존 group_key를 그대로
// 입력하면 그 그룹에 단어만 추가된다. 삭제는 단어(term) 단위 — soft delete 정책 없음(운영자가
// 직접 큐레이션하는 참고 자료라 되돌릴 필요 있으면 다시 추가하면 됨).
export function SynonymSection({ rows }: { rows: SynonymRow[] }) {
  const [state, formAction, isPending] = useActionState(addSynonymTermAction, initialState);
  const [groupKey, setGroupKey] = useState("");
  const [term, setTerm] = useState("");

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") {
      setTerm("");
    }
  }

  const errors = state.status === "validation_error" ? state.errors : {};

  const groups = new Map<string, SynonymRow[]>();
  for (const row of rows) {
    const list = groups.get(row.group_key) ?? [];
    list.push(row);
    groups.set(row.group_key, list);
  }

  return (
    <div className="space-y-4">
      <form
        action={formAction}
        className="space-y-1.5 rounded-lg border border-[var(--paylens-action)] bg-[var(--paylens-action)]/5 p-3"
      >
        <div className="flex gap-2">
          <input
            name="groupKey"
            type="text"
            placeholder="그룹 키 (예: GROUP_GREEN_ONION)"
            value={groupKey}
            onChange={(e) => setGroupKey(e.target.value)}
            className={`${inputClassName} ${errors.groupKey ? "border-[var(--paylens-accent)]" : ""}`}
          />
          <input
            name="term"
            type="text"
            placeholder="단어 (예: 대파)"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className={`${inputClassName} ${errors.term ? "border-[var(--paylens-accent)]" : ""}`}
          />
          <button
            type="submit"
            disabled={isPending}
            className="h-10 shrink-0 rounded-lg bg-[var(--paylens-action)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "등록 중…" : "등록"}
          </button>
        </div>
        {(errors.groupKey || errors.term) && (
          <p className="text-xs text-[var(--paylens-accent)]">
            {errors.groupKey?.[0] ?? errors.term?.[0]}
          </p>
        )}
        {state.status === "error" && (
          <p className="text-xs text-[var(--paylens-accent)]">{state.message}</p>
        )}
      </form>

      {groups.size === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">등록된 동의어 그룹이 없습니다</p>
      ) : (
        <div className="space-y-3">
          {Array.from(groups.entries()).map(([key, terms]) => (
            <div key={key} className="rounded-lg border border-[#e2e8f0] p-3">
              <p className="mb-2 text-xs font-semibold text-[var(--color-text-secondary)]">{key}</p>
              <div className="flex flex-wrap gap-2">
                {terms.map((row) => (
                  <span
                    key={row.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paylens-bg)] px-3 py-1 text-sm text-[var(--color-text-primary)]"
                  >
                    {row.term}
                    <DeleteTermButton id={row.id} />
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
