-- [S-2-2] UTILITY_BILL_RECORD 테이블 생성
-- 사용자의 월별 관리비 등록 1건. TRANSACTION과 1:1 — 총액은 TRANSACTION에, 항목별 값은
-- UTILITY_BILL_ITEM_VALUE에 별도 저장한다(docs/2차/관리비명세서_데이터구조설계.md §2-3).
-- source: 수동입력/업로드 구분 — 재업로드 충돌 판정(§3-2, 케이스 A/B)에 사용.
-- file_path: Storage 경로. source='UPLOAD'인 경우만 값이 있다.
-- RLS 정책/GRANT는 S-2-4에서 UTILITY_BILL_ITEM, UTILITY_BILL_ITEM_VALUE와 함께 작성한다.

CREATE TABLE IF NOT EXISTS public.utility_bill_record (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    period          text        NOT NULL,
    transaction_id  uuid        NOT NULL UNIQUE REFERENCES public.transaction(id) ON DELETE CASCADE,
    source          text        NOT NULL CHECK (source IN ('MANUAL', 'UPLOAD')),
    file_path       text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_utility_bill_record_user_period UNIQUE (user_id, period)
);

ALTER TABLE public.utility_bill_record ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER utility_bill_record_set_updated_at
    BEFORE UPDATE ON public.utility_bill_record
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_utility_bill_record_user_id ON public.utility_bill_record(user_id);
