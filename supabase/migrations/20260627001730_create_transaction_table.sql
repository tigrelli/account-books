-- [S-1-6] TRANSACTION 테이블 생성
-- amount: has_detail=false면 직접 입력, has_detail=true면 S-1-10 트리거가 TRANSACTION_DETAIL 합계로 자동계산.
-- adjustment_amount: 부가세/할인 등 보정액. amount = SUM(detail.amount) + adjustment_amount (데이터정책 2장).
-- external_id + source_app: 서브앱 Webhook 멱등성 키 — 두 값이 모두 있을 때만 유니크 (MANUAL은 둘 다 null).
-- 직접 삭제 허용 (soft delete 없음, 데이터정책 2장).

CREATE TABLE IF NOT EXISTS public.transaction (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    payment_method_id   uuid        NOT NULL REFERENCES public.payment_method(id),
    category_id         uuid        NOT NULL REFERENCES public.category(id),
    vendor_id           uuid        NOT NULL REFERENCES public.vendor(id),
    input_type          text        NOT NULL CHECK (input_type IN ('MANUAL', 'SUBAPP')),
    source_app          text,
    external_id         text,
    amount              numeric     NOT NULL CHECK (amount > 0),
    adjustment_amount   numeric     NOT NULL DEFAULT 0,
    has_detail          boolean     NOT NULL DEFAULT false,
    occurred_at         timestamptz NOT NULL,
    memo                text,
    raw_payload         jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    -- 서브앱 멱등성: source_app + external_id 조합이 있을 때만 유니크 강제
    CONSTRAINT uq_transaction_external UNIQUE (source_app, external_id)
);

ALTER TABLE public.transaction ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transaction_select" ON public.transaction
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "transaction_insert" ON public.transaction
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "transaction_update" ON public.transaction
    FOR UPDATE USING (user_id = auth.uid());

-- 직접 삭제 허용 (데이터정책 2장 — 트랜잭션은 soft delete 없음)
CREATE POLICY "transaction_delete" ON public.transaction
    FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER transaction_set_updated_at
    BEFORE UPDATE ON public.transaction
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_transaction_user_id       ON public.transaction(user_id);
CREATE INDEX idx_transaction_occurred_at   ON public.transaction(user_id, occurred_at DESC);
CREATE INDEX idx_transaction_category_id   ON public.transaction(category_id);
CREATE INDEX idx_transaction_vendor_id     ON public.transaction(vendor_id);
CREATE INDEX idx_transaction_payment_method ON public.transaction(payment_method_id);
