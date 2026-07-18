-- [F-2-1-2] UTILITY_BILL_ITEM_VALUE.amount 음수 허용
-- "관리비차감"처럼 실제 고지서에 음수(차감) 항목이 존재하는데, 기존 CHECK(amount > 0)이
-- 이를 저장 자체를 막고 있었다(2026-07-14 실사진 재검토 중 발견). 값이 없는 달은 행을
-- 아예 안 만드는 기존 원칙(§3-4)은 그대로 유지 — 0은 계속 금지하고 음수만 허용한다.

ALTER TABLE public.utility_bill_item_value
    DROP CONSTRAINT utility_bill_item_value_amount_check;

ALTER TABLE public.utility_bill_item_value
    ADD CONSTRAINT utility_bill_item_value_amount_check CHECK (amount <> 0);
