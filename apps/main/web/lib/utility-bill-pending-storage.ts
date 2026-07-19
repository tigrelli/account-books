import type { UtilityBillExtraction } from "@/lib/utility-bill-parse";

// [F-2-2-1] "/utility-bills/upload"(파일 선택) ↔ "/utility-bills/upload/items"(항목 선정,
// 별도 페이지) 사이에 추출 결과 + 원본 파일을 넘기는 용도. 화면설계 §2-1이 항목 선정을
// 팝업이 아닌 별도 페이지로 못박아서, 서버 액션이 못 지켜주는 상태를 sessionStorage로
// 명시적으로 들고 넘어간다(PM 확인, 2026-07-18) — File은 JSON 직렬화가 안 돼 base64
// data URL로 변환한다. 사진은 업로드 전 이미 압축돼(lib/image-compress.ts, 300~500KB
// 권장) sessionStorage 용량(통상 5MB+) 안에 안전하게 들어간다.
const STORAGE_KEY = "utility-bill-pending-extraction";

export interface ActiveUtilityBillItemInfo {
  name: string;
  sourceLabels: string[];
}

interface PendingExtractionPayload {
  extraction: UtilityBillExtraction;
  replaceExisting: boolean;
  activeItems: ActiveUtilityBillItemInfo[];
  fileName: string;
  fileType: string;
  fileDataUrl: string;
}

export interface PendingExtraction {
  extraction: UtilityBillExtraction;
  replaceExisting: boolean;
  activeItems: ActiveUtilityBillItemInfo[];
  file: File;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl: string, fileName: string, fileType: string): File {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: fileType });
}

export async function savePendingExtraction(
  extraction: UtilityBillExtraction,
  file: File,
  replaceExisting: boolean,
  activeItems: ActiveUtilityBillItemInfo[]
): Promise<void> {
  const payload: PendingExtractionPayload = {
    extraction,
    replaceExisting,
    activeItems,
    fileName: file.name,
    fileType: file.type,
    fileDataUrl: await fileToDataUrl(file),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadPendingExtraction(): PendingExtraction | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  const payload = JSON.parse(raw) as PendingExtractionPayload;
  return {
    extraction: payload.extraction,
    replaceExisting: payload.replaceExisting,
    activeItems: payload.activeItems,
    file: dataUrlToFile(payload.fileDataUrl, payload.fileName, payload.fileType),
  };
}

export function clearPendingExtraction(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
