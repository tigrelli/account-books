-- [S-1-1] CATEGORY 테이블 생성
-- 항목분류(카테고리). user_id = null이면 시스템 기본 카테고리, 사용자 정의 시 user_id 설정.
-- 삭제 금지 정책 — soft delete(is_active=false)만 허용 (데이터정책_및_시드정의서 2장).

CREATE TABLE IF NOT EXISTS public.category (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_id        uuid        REFERENCES public.category(id) ON DELETE RESTRICT,
    name             text        NOT NULL,
    icon             text,
    is_system_default boolean    NOT NULL DEFAULT false,
    is_active        boolean     NOT NULL DEFAULT true,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 시스템 기본 카테고리: user_id IS NULL이고 is_system_default = true
-- SELECT 정책: 본인 것 + 시스템 기본(user_id IS NULL) 조회 허용
ALTER TABLE public.category ENABLE ROW LEVEL SECURITY;

-- 조회: 본인 카테고리 + 시스템 기본 카테고리
CREATE POLICY "category_select" ON public.category
    FOR SELECT
    USING (user_id = auth.uid() OR user_id IS NULL);

-- 삽입: 본인 user_id만 허용 (시스템 기본은 Service Role로만 삽입)
CREATE POLICY "category_insert" ON public.category
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- 수정: 본인 카테고리만 허용, 시스템 기본은 수정 불가
CREATE POLICY "category_update" ON public.category
    FOR UPDATE
    USING (user_id = auth.uid() AND is_system_default = false);

-- 삭제 정책 미생성 — soft delete(is_active=false)로 대체

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER category_set_updated_at
    BEFORE UPDATE ON public.category
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 인덱스
CREATE INDEX idx_category_user_id ON public.category(user_id);
CREATE INDEX idx_category_parent_id ON public.category(parent_id);
