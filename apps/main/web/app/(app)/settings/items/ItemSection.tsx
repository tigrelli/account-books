"use client";

import { useActionState, useState, useTransition } from "react";
import type { Database } from "@account-books/types";
import { itemAliasesToArray } from "@/lib/item-aliases";
import {
  addAliasAction,
  removeAliasAction,
  mergeItemAction,
  type ItemActionState,
} from "./actions";

type Item = Database["public"]["Tables"]["item"]["Row"];
type Category = Database["public"]["Tables"]["category"]["Row"];

const initialState: ItemActionState = { status: "idle" };

function AliasTag({ itemId, alias }: { itemId: string; alias: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--paylens-bg)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
      {alias}
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => removeAliasAction(itemId, alias))}
        aria-label={`별칭 '${alias}' 삭제`}
        className="leading-none text-[var(--color-text-secondary)] hover:text-[var(--paylens-accent)] disabled:opacity-50"
      >
        ×
      </button>
    </span>
  );
}

// 품목이 여러 개라 행마다 독립된 "별칭 추가" 폼 상태(펼침 여부/입력값)를 가짐.
function AddAliasForm({ itemId }: { itemId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState("");
  const [state, formAction, isPending] = useActionState(
    addAliasAction.bind(null, itemId),
    initialState
  );

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") {
      setValue("");
      setIsOpen(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-xs font-medium text-[var(--paylens-action)] hover:underline"
      >
        + 별칭 추가
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input
        name="alias"
        type="text"
        autoFocus
        autoComplete="off"
        placeholder="별칭 (예: 대파)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-7 w-28 rounded-lg border border-[#e2e8f0] px-2 text-xs outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15"
      />
      <button
        type="submit"
        disabled={isPending}
        className="text-xs font-medium text-[var(--paylens-action)] hover:underline disabled:opacity-50"
      >
        추가
      </button>
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="text-xs text-[var(--color-text-secondary)] hover:underline"
      >
        취소
      </button>
      {state.status === "error" && (
        <p className="text-xs text-[var(--paylens-accent)]">{state.message}</p>
      )}
    </form>
  );
}

// 대상 품목이 없으면(등록된 품목이 1개뿐) 병합 자체가 불가능해 컨트롤을 아예 숨김.
function MergeControl({
  item,
  otherItems,
}: {
  item: Item;
  otherItems: Pick<Item, "id" | "name">[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [isPending, startTransition] = useTransition();

  if (otherItems.length === 0) return null;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-xs font-medium text-[var(--color-text-secondary)] hover:underline"
      >
        병합
      </button>
    );
  }

  function handleMerge() {
    const target = otherItems.find((o) => o.id === targetId);
    if (!target) return;
    if (!confirm(`'${item.name}'을(를) '${target.name}'(으)로 합치시겠습니까? 되돌릴 수 없습니다.`))
      return;

    startTransition(async () => {
      await mergeItemAction(item.id, target.id);
      setIsOpen(false);
      setTargetId("");
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        className="h-7 rounded-lg border border-[#e2e8f0] bg-white px-1.5 text-xs outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15"
      >
        <option value="" disabled>
          합칠 품목 선택
        </option>
        {otherItems.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!targetId || isPending}
        onClick={handleMerge}
        className="text-xs font-medium text-[var(--paylens-action)] hover:underline disabled:opacity-50"
      >
        {isPending ? "병합 중…" : "병합하기"}
      </button>
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="text-xs text-[var(--color-text-secondary)] hover:underline"
      >
        취소
      </button>
    </div>
  );
}

function ItemRow({
  item,
  categoryById,
  otherItems,
}: {
  item: Item;
  categoryById: Map<string, Category>;
  otherItems: Pick<Item, "id" | "name">[];
}) {
  const aliases = itemAliasesToArray(item.aliases);
  const defaultCategory = item.default_category_id
    ? categoryById.get(item.default_category_id)
    : undefined;

  return (
    <div className="rounded-lg border border-[#e2e8f0] p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-primary)]">{item.name}</p>
        {defaultCategory && (
          <span className="text-xs text-[var(--color-text-secondary)]">
            {defaultCategory.icon ? `${defaultCategory.icon} ` : ""}
            {defaultCategory.name}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {aliases.map((alias) => (
            <AliasTag key={alias} itemId={item.id} alias={alias} />
          ))}
          <AddAliasForm itemId={item.id} />
        </div>
        <MergeControl item={item} otherItems={otherItems} />
      </div>
    </div>
  );
}

export function ItemSection({
  items,
  allItems,
  categories,
}: {
  items: Item[];
  // 병합 대상 드롭다운용 전체 품목 목록 — 현재 페이지(items)에 없는 품목도 합칠 수 있어야 하므로 별도로 받음.
  allItems: Pick<Item, "id" | "name">[];
  categories: Category[];
}) {
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        등록된 품목이 없습니다 — 지출 입력에서 상세항목을 추가하면 여기에 쌓입니다
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          categoryById={categoryById}
          otherItems={allItems.filter((other) => other.id !== item.id)}
        />
      ))}
    </div>
  );
}
