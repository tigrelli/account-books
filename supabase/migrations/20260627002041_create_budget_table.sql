-- [S-1-8] BUDGET 테이블 생성
-- 카테고리별 월 예산 한도. 초과 시 입력을 막지 않고 경고만 표시 (데이터정책 2장).
-- period: 'YYYY-MM' 형식 텍스트 (예: '2026-06'). 월 단위 예산 관리.
-- (user_id, category_id, period) 유니크 — 같은 달 같은 카테고리 예산 중복 방지.

CREATE TABLE IF NOT EXISTS public.budget (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id     uuid        NOT NULL REFERENCES public.category(id),
    limit_amount    numeric     NOT NULL CHECK (limit_amount > 0),
    period          text        NOT NULL CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_budget_user_category_period UNIQUE (user_id, category_id, period)
);

ALTER TABLE public.budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_select" ON public.budget
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "budget_insert" ON public.budget
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "budget_update" ON public.budget
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "budget_delete" ON public.budget
    FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER budget_set_updated_at
    BEFORE UPDATE ON public.budget
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_budget_user_period ON public.budget(user_id, period);
