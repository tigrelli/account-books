"use client";

import { useActionState, useState, useTransition } from "react";
import { Popover } from "@base-ui/react/popover";
import type { Database } from "@account-books/types";
import { CATEGORY_ICON_PRESETS } from "@/lib/category-schemas";
import {
  addCategoryAction,
  updateCategoryAction,
  setActiveAction,
  type CategoryActionState,
} from "./actions";

type Category = Database["public"]["Tables"]["category"]["Row"];

const initialState: CategoryActionState = { status: "idle" };

type FieldValues = { name: string; icon: string };

function toFieldValues(category: Category): FieldValues {
  return { name: category.name, icon: category.icon ?? "" };
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <input type="hidden" name="icon" value={value} />
      <Popover.Trigger
        type="button"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-lg"
      >
        {value || "🙂"}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6}>
          <Popover.Popup className="w-56 rounded-lg border border-[#e2e8f0] bg-white p-2 shadow-lg">
            <div className="grid grid-cols-6 gap-1.5">
              {CATEGORY_ICON_PRESETS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => {
                    onChange(value === icon ? "" : icon);
                    setOpen(false);
                  }}
                  aria-pressed={value === icon}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border text-base ${
                    value === icon
                      ? "border-[var(--paylens-action)] bg-[var(--paylens-action)]/10"
                      : "border-[#e2e8f0] bg-white"
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function CategoryFields({
  errors,
  values,
  onChange,
}: {
  errors: Partial<Record<string, string[]>>;
  values: FieldValues;
  onChange: (values: FieldValues) => void;
}) {
  return (
    <>
      <div className="flex gap-2">
        <IconPicker value={values.icon} onChange={(icon) => onChange({ ...values, icon })} />
        <input
          name="name"
          type="text"
          placeholder="이름 (예: 외식)"
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          className={`h-10 flex-1 rounded-lg border px-3.5 text-sm outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15 ${errors.name ? "border-[var(--paylens-accent)]" : "border-[#e2e8f0]"}`}
        />
      </div>
      {(errors.name || errors.icon) && (
        <p className="text-xs text-[var(--paylens-accent)]">
          {errors.name?.[0] ?? errors.icon?.[0]}
        </p>
      )}
    </>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateCategoryAction, initialState);
  const [isToggling, startToggle] = useTransition();
  const [values, setValues] = useState<FieldValues>(toFieldValues(category));

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setEditing(false);
  }

  const errors = state.status === "validation_error" ? state.errors : {};

  if (editing) {
    return (
      <form action={formAction} className="space-y-1.5 rounded-lg border border-[#e2e8f0] p-3">
        <input type="hidden" name="id" value={category.id} />
        <CategoryFields errors={errors} values={values} onChange={setValues} />
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-9 rounded-lg px-2 text-xs text-[var(--color-text-secondary)] hover:underline"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="h-9 rounded-lg bg-[var(--paylens-action)] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div
      className={`flex items-center justify-between rounded-lg border border-[#e2e8f0] p-3 ${category.is_active ? "" : "opacity-50"}`}
    >
      <span className="text-sm text-[var(--color-text-primary)]">
        {category.icon ? `${category.icon} ` : ""}
        {category.name}
        {category.is_system_default && (
          <span className="ml-2 text-xs text-[var(--color-text-secondary)]">(기본)</span>
        )}
      </span>
      <div className="flex items-center gap-3">
        {!category.is_system_default && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-[var(--paylens-action)] hover:underline"
          >
            수정
          </button>
        )}
        <button
          type="button"
          disabled={isToggling}
          onClick={() => startToggle(() => setActiveAction(category.id, !category.is_active))}
          className="text-xs font-medium text-[var(--color-text-secondary)] hover:underline"
        >
          {category.is_active ? "비활성화" : "활성화"}
        </button>
      </div>
    </div>
  );
}

const emptyValues: FieldValues = { name: "", icon: "" };

function AddCategoryForm() {
  const [state, formAction, isPending] = useActionState(addCategoryAction, initialState);
  const [values, setValues] = useState<FieldValues>(emptyValues);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setValues(emptyValues);
  }

  const errors = state.status === "validation_error" ? state.errors : {};

  return (
    <form action={formAction} className="space-y-1.5">
      {state.status === "error" && (
        <p className="text-sm font-medium text-[var(--paylens-accent)]">{state.message}</p>
      )}
      <CategoryFields errors={errors} values={values} onChange={setValues} />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-lg bg-[var(--paylens-action)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "등록 중…" : "등록"}
        </button>
      </div>
    </form>
  );
}

export function CategorySection({ categories }: { categories: Category[] }) {
  return (
    <div className="space-y-3">
      {categories.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">등록된 지출항목이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </div>
      )}
      <AddCategoryForm />
    </div>
  );
}
