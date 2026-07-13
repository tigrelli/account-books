// [F-2-1-2] 관리비 명세서 사진 업로드 전 리사이즈/압축 — 실제 폰카메라 사진(2~3MB대)이
// Server Action 기본 본문 제한(1MB, next.config.ts에서 4MB로 상향)에 걸려 실패하는 걸
// 확인해 추가(2026-07-13). 데이터구조설계 §5 "저장 전 리사이즈/압축(300~500KB 권장)"
// 원칙을 여기서 구현한다. 브라우저 Canvas API만 사용 — 새 npm 패키지 불필요.

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

export async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) return file;

  // 압축 결과가 원본보다 크면(이미 작은 이미지 등) 원본을 그대로 쓴다.
  if (blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
