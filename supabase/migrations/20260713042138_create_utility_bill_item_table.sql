-- [S-2-1] UTILITY_BILL_ITEM 테이블 생성
-- 관리비 명세서 사용자별 지정 항목 마스터. 시스템 공통 시드 없음 — 사용자가 최초 업로드 시
-- 확인한 항목만 생성된다(docs/2차/관리비명세서_데이터구조설계.md §2-3).
-- source_labels: OCR 원문 라벨 매칭용 별칭 배열. 예: ["급탕요금", "온수"]
-- is_active: soft delete (양식 변경 대응, ITEM/CATEGORY와 동일 원칙)
-- RLS 정책/GRANT는 S-2-4에서 UTILITY_BILL_RECORD, UTILITY_BILL_ITEM_VALUE와 함께 작성한다.

CREATE TABLE IF NOT EXISTS public.utility_bill_item (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name           text        NOT NULL,
    has_usage      boolean     NOT NULL DEFAULT false,
    usage_unit     text,
    source_labels  jsonb       NOT NULL DEFAULT '[]'::jsonb,
    is_active      boolean     NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.utility_bill_item ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_utility_bill_item_user_id ON public.utility_bill_item(user_id);
