-- [S-2-3] UTILITY_BILL_ITEM_VALUE 테이블 생성
-- 월별 항목 값(영수증표 기준 금액 + 사용량표 보조 데이터).
-- amount: 항목 금액. usage_value/meter_previous/meter_current: has_usage=true인 항목만 값이 있음.
-- 값이 없는 달(그 달 명세서에 항목이 없어서 패스된 경우)은 행 자체를 만들지 않는다(§3-4) —
-- 통계 화면에서 실제 0원과 구분해 "-"로 표시하기 위함.
-- RLS: 이 테이블에 user_id 없음 — 부모 UTILITY_BILL_RECORD의 user_id로 접근 제어(TRANSACTION_DETAIL과 동일 원칙).
-- RLS 정책/GRANT는 S-2-4에서 UTILITY_BILL_ITEM, UTILITY_BILL_RECORD와 함께 작성한다.

CREATE TABLE IF NOT EXISTS public.utility_bill_item_value (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id       uuid        NOT NULL REFERENCES public.utility_bill_record(id) ON DELETE CASCADE,
    item_id         uuid        NOT NULL REFERENCES public.utility_bill_item(id),
    amount          numeric     NOT NULL CHECK (amount > 0),
    usage_value     numeric,
    meter_previous  numeric,
    meter_current   numeric,
    created_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_utility_bill_item_value_record_item UNIQUE (record_id, item_id)
);

ALTER TABLE public.utility_bill_item_value ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_utility_bill_item_value_record_id ON public.utility_bill_item_value(record_id);
CREATE INDEX idx_utility_bill_item_value_item_id   ON public.utility_bill_item_value(item_id);
