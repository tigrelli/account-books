-- [S-1-2] PAYMENT_METHOD 테이블 생성 + 회원가입 시 기본 현금 자동 생성 트리거
-- subtype 값: CASH_SPEND(지갑/현금), AUTO_TRANSFER(은행 계좌) — UI에는 노출하지 않음
-- 비활성화(is_active=false) 제한은 앱 레벨에서 처리 (is_system_default=true인 경우)

CREATE TABLE IF NOT EXISTS public.payment_method (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type         text        NOT NULL CHECK (type IN ('CASH', 'CARD')),
    subtype      text        CHECK (
                                 (type = 'CASH' AND subtype IN ('CASH_SPEND', 'AUTO_TRANSFER'))
                                 OR (type = 'CARD' AND subtype IS NULL)
                             ),
    card_issuer  text,
    card_kind    text        CHECK (card_kind IN ('CHECK', 'CREDIT') OR card_kind IS NULL),
    display_name text        NOT NULL,
    is_system_default boolean NOT NULL DEFAULT false,
    is_active    boolean     NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_method ENABLE ROW LEVEL SECURITY;

-- 조회/삽입/수정: 본인 것만 (데이터정책_및_시드정의서 3장)
CREATE POLICY "payment_method_select" ON public.payment_method
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "payment_method_insert" ON public.payment_method
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "payment_method_update" ON public.payment_method
    FOR UPDATE USING (user_id = auth.uid());

-- 삭제 정책 미생성 — soft delete(is_active=false)로 대체

-- updated_at 자동 갱신
CREATE TRIGGER payment_method_set_updated_at
    BEFORE UPDATE ON public.payment_method
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 인덱스
CREATE INDEX idx_payment_method_user_id ON public.payment_method(user_id);

-- 회원가입 시 지갑(현금) 자동 생성 트리거
-- is_system_default=true: 앱 레벨에서 비활성화 불가 처리 기준
CREATE OR REPLACE FUNCTION public.create_default_payment_methods()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.payment_method (user_id, type, subtype, display_name, is_system_default)
    VALUES (NEW.id, 'CASH', 'CASH_SPEND', '지갑(현금)', true);
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_payment_method
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.create_default_payment_methods();
