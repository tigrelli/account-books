"use client";

import { useRef, useState } from "react";

interface PeriodStatus {
  period: string;
  registered: boolean;
}

function formatMonthLabel(period: string): string {
  const month = Number(period.split("-")[1]);
  return `${month}월`;
}

// 재업로드 충돌 판정 API 연동(F-2-1-2)에서 실제 업로드를 트리거한다 — 이 화면(F-2-1-1)은
// 파일 선택/드래그앤드롭 골격과 선택된 파일 미리보기까지만 담당한다.
export function UtilityBillUploadSection({ recentStatus }: { recentStatus: PeriodStatus[] }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) setSelectedFile(file);
  }

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-[var(--paylens-action)] bg-[var(--paylens-action)]/5"
            : "border-[#e2e8f0]"
        }`}
        style={{ borderRadius: "var(--border-radius-m)", boxShadow: "var(--card-shadow)" }}
      >
        {selectedFile ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {selectedFile.name}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              다른 사진을 선택하려면 아래 버튼을 눌러주세요
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">
            여기로 사진을 끌어다 놓거나, 아래 버튼으로 촬영/선택해주세요
          </p>
        )}

        {/* 모바일에서는 capture 속성으로 카메라 촬영이 기본 경로가 되고, 데스크톱에서는
            일반 파일 선택 창이 뜬다(화면설계 §1-1). */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 h-10 rounded-lg bg-[var(--paylens-action)] px-5 text-sm font-medium text-white hover:opacity-90"
        >
          사진 촬영 / 파일 선택
        </button>
      </div>

      <div
        className="rounded-lg p-4"
        style={{ borderRadius: "var(--border-radius-m)", boxShadow: "var(--card-shadow)" }}
      >
        <p className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
          최근 등록 현황
        </p>
        <ul className="space-y-1">
          {recentStatus.map(({ period, registered }) => (
            <li
              key={period}
              className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]"
            >
              <span>{formatMonthLabel(period)}</span>
              <span className={registered ? "text-[var(--paylens-action)]" : ""}>
                {registered ? "업로드됨" : "미등록"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
