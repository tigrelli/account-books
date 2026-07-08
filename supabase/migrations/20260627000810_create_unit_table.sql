-- [S-1-5] UNIT 테이블 생성
-- 수량 단위(개, kg, 팩 등). user_id = null이면 시스템 기본 단위, 사용자 정의 시 user_id 설정.
-- CATEGORY와 동일한 패턴 — SELECT 시 본인 것 + 시스템 기본(user_id IS NULL) 모두 조회.

CREATE TABLE IF NOT EXISTS public.unit (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
    name              text        NOT NULL,
    is_system_default boolean     NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.unit ENABLE ROW LEVEL SECURITY;

-- 조회: 본인 단위 + 시스템 기본 단위
CREATE POLICY "unit_select" ON public.unit
    FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

-- 삽입: 본인 것만 (시스템 기본은 Service Role로만 삽입)
CREATE POLICY "unit_insert" ON public.unit
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- 수정: 본인 것만, 시스템 기본은 수정 불가
CREATE POLICY "unit_update" ON public.unit
    FOR UPDATE USING (user_id = auth.uid() AND is_system_default = false);

-- 삭제 정책 미생성

CREATE TRIGGER unit_set_updated_at
    BEFORE UPDATE ON public.unit
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_unit_user_id ON public.unit(user_id);
