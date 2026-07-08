-- [S-1-7] TRANSACTION_DETAIL 테이블 생성
-- 상세항목(품목별 금액). transaction.has_detail=true일 때만 사용.
-- RLS: 이 테이블에 user_id 없음 — 부모 TRANSACTION의 user_id로 접근 제어.
-- quantity_value/unit_id: 수량 파싱 성공 시만 저장, 실패(1+1 등)는 quantity_raw_text에만 기록.

CREATE TABLE IF NOT EXISTS public.transaction_detail (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id    uuid        NOT NULL REFERENCES public.transaction(id) ON DELETE CASCADE,
    item_id           uuid        NOT NULL REFERENCES public.item(id),
    item_raw_text     text        NOT NULL,
    quantity_value    numeric,
    unit_id           uuid        REFERENCES public.unit(id),
    quantity_raw_text text,
    amount            numeric     NOT NULL CHECK (amount > 0),
    created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_detail ENABLE ROW LEVEL SECURITY;

-- RLS: 부모 TRANSACTION이 본인 것인 경우만 접근 허용
CREATE POLICY "transaction_detail_select" ON public.transaction_detail
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.transaction t
            WHERE t.id = transaction_id AND t.user_id = auth.uid()
        )
    );

CREATE POLICY "transaction_detail_insert" ON public.transaction_detail
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.transaction t
            WHERE t.id = transaction_id AND t.user_id = auth.uid()
        )
    );

CREATE POLICY "transaction_detail_update" ON public.transaction_detail
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.transaction t
            WHERE t.id = transaction_id AND t.user_id = auth.uid()
        )
    );

CREATE POLICY "transaction_detail_delete" ON public.transaction_detail
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.transaction t
            WHERE t.id = transaction_id AND t.user_id = auth.uid()
        )
    );

CREATE INDEX idx_transaction_detail_transaction_id ON public.transaction_detail(transaction_id);
CREATE INDEX idx_transaction_detail_item_id        ON public.transaction_detail(item_id);
