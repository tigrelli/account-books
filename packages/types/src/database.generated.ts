/**
 * Supabase가 자동 생성하는 타입 파일 (supabase gen types typescript)
 * S-1-x DB 마이그레이션 완료 후 실제 타입으로 교체됩니다.
 * 직접 편집하지 말 것.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
