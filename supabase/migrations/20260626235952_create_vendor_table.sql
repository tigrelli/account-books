-- [S-1-3] VENDOR 테이블 생성
-- 지출처(이마트, 11번가, 부모님 등). 삭제 금지 — soft delete(is_active=false)만 허용 (데이터정책 2장).
-- default_category_id: 이 지출처 선택 시 카테고리 자동 추천용 (선택 필드)

CREATE TABLE IF NOT EXISTS public.vendor (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name                text        NOT NULL,
    default_category_id uuid        REFERENCES public.category(id) ON DELETE SET NULL,
    is_active           boolean     NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_select" ON public.vendor
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "vendor_insert" ON public.vendor
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "vendor_update" ON public.vendor
    FOR UPDATE USING (user_id = auth.uid());

-- 삭제 정책 미생성 — soft delete(is_active=false)로 대체

CREATE TRIGGER vendor_set_updated_at
    BEFORE UPDATE ON public.vendor
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_vendor_user_id ON public.vendor(user_id);
