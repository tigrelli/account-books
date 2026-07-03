"use client";

import { useActionState, useState, useTransition } from "react";
import type { Database } from "@account-books/types";
import {
  addVendorAction,
  updateVendorAction,
  setActiveAction,
  type VendorActionState,
} from "./actions";

type Vendor = Database["public"]["Tables"]["vendor"]["Row"];

const initialState: VendorActionState = { status: "idle" };

type FieldValues = { name: string };

function toFieldValues(vendor: Vendor): FieldValues {
  return { name: vendor.name };
}

// 2026-07-03 PM 결정: 지출처는 여러 카테고리의 지출이 섞일 수 있어(예: GS슈퍼에서 식료품+의류) 특정
// 카테고리에 고정 매칭하지 않음 — 기본 카테고리 추천 select를 제거하고 이름만 입력받음.
function VendorFields({
  errors,
  values,
  onChange,
  trailingButton,
}: {
  errors: Partial<Record<string, string[]>>;
  values: FieldValues;
  onChange: (values: FieldValues) => void;
  // 등록 폼에서만 입력창과 같은 줄에 "등록" 버튼을 넣기 위한 슬롯 — 수정 폼(VendorRow)은 아래에
  // "취소"/"저장" 버튼을 별도 줄로 두는 기존 레이아웃을 유지하므로 비워둠.
  trailingButton?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex gap-2">
        <input
          name="name"
          type="text"
          placeholder="이름 (예: 이마트)"
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          className={`h-10 min-w-0 flex-1 rounded-lg border px-3.5 text-sm outline-none focus:border-[var(--paylens-action)] focus:ring-2 focus:ring-[var(--paylens-action)]/15 ${errors.name ? "border-[var(--paylens-accent)]" : "border-[#e2e8f0]"}`}
        />
        {trailingButton}
      </div>
      {errors.name && <p className="text-xs text-[var(--paylens-accent)]">{errors.name[0]}</p>}
    </>
  );
}

function VendorRow({ vendor }: { vendor: Vendor }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateVendorAction, initialState);
  const [isToggling, startToggle] = useTransition();
  const [values, setValues] = useState<FieldValues>(toFieldValues(vendor));

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setEditing(false);
  }

  const errors = state.status === "validation_error" ? state.errors : {};

  if (editing) {
    return (
      <form action={formAction} className="space-y-1.5 rounded-lg border border-[#e2e8f0] p-3">
        <input type="hidden" name="id" value={vendor.id} />
        <VendorFields errors={errors} values={values} onChange={setValues} />
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
      className={`flex items-center justify-between rounded-lg border border-[#e2e8f0] p-3 ${vendor.is_active ? "" : "opacity-50"}`}
    >
      <p className="text-sm text-[var(--color-text-primary)]">{vendor.name}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-[var(--paylens-action)] hover:underline"
        >
          수정
        </button>
        <button
          type="button"
          disabled={isToggling}
          onClick={() => startToggle(() => setActiveAction(vendor.id, !vendor.is_active))}
          className="text-xs font-medium text-[var(--color-text-secondary)] hover:underline"
        >
          {vendor.is_active ? "비활성화" : "활성화"}
        </button>
      </div>
    </div>
  );
}

const emptyValues: FieldValues = { name: "" };

function AddVendorForm() {
  const [state, formAction, isPending] = useActionState(addVendorAction, initialState);
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
      <VendorFields
        errors={errors}
        values={values}
        onChange={setValues}
        trailingButton={
          <button
            type="submit"
            disabled={isPending}
            className="h-10 shrink-0 rounded-lg bg-[var(--paylens-action)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "등록 중…" : "등록"}
          </button>
        }
      />
    </form>
  );
}

export function VendorSection({ vendors }: { vendors: Vendor[] }) {
  return (
    <div className="space-y-3">
      {vendors.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">등록된 지출처가 없습니다</p>
      ) : (
        <div className="space-y-2">
          {vendors.map((vendor) => (
            <VendorRow key={vendor.id} vendor={vendor} />
          ))}
        </div>
      )}
      <AddVendorForm />
    </div>
  );
}
