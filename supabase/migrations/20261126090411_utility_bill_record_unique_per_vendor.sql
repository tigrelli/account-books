-- [F-2-4-5] 관리비 등록 "한 달 1건" → "같은 지출처는 한 달 1건" (백로그 B-14, 2026-11-26 PM 결정)
-- 같은 달에 도시가스를 "관리비/공과금"으로 먼저 입력하면 그 달 관리비 입력이 UNIQUE(user_id, period)
-- 위반으로 막히던 운영 버그가 계기. 유니크 제약은 같은 테이블의 컬럼에만 걸 수 있어
-- TRANSACTION.vendor_id를 이 테이블에 중복 저장한다(앱이 지출 수정 시 함께 동기화).
-- 테이블 단위 GRANT/RLS는 기존 그대로 적용되므로 추가 GRANT 불필요.

ALTER TABLE public.utility_bill_record
    ADD COLUMN vendor_id uuid REFERENCES public.vendor(id);

UPDATE public.utility_bill_record r
SET vendor_id = t.vendor_id
FROM public.transaction t
WHERE t.id = r.transaction_id;

ALTER TABLE public.utility_bill_record
    ALTER COLUMN vendor_id SET NOT NULL;

ALTER TABLE public.utility_bill_record
    DROP CONSTRAINT uq_utility_bill_record_user_period;

ALTER TABLE public.utility_bill_record
    ADD CONSTRAINT uq_utility_bill_record_user_period_vendor UNIQUE (user_id, period, vendor_id);
