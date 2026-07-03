-- [F-1-7-1] BUDGET_TOTAL 테이블 생성 (2026-07-03 PM 결정)
-- 월별 "전체 예산" — 카테고리별 예산(budget)과 별개 엔티티로 분리 관리.
-- 화면 흐름: 전체 예산을 먼저 등록해야 그 아래 카테고리별 예산을 등록할 수 있고,
-- 카테고리별 예산 합계가 전체 예산을 초과하면 저장 자체를 막는다(경고만 표시하는
-- 기존 "지출이 예산 초과" 정책과는 별개의 검증 — actions.ts의 upsertBudgetAction 참고).
-- period: 'YYYY-MM' 형식 텍스트, budget 테이블과 동일 규칙.

CREATE TABLE IF NOT EXISTS public.budget_total (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    limit_amount    numeric     NOT NULL CHECK (limit_amount > 0),
    period          text        NOT NULL CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_budget_total_user_period UNIQUE (user_id, period)
);

ALTER TABLE public.budget_total ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_total_select" ON public.budget_total
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "budget_total_insert" ON public.budget_total
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "budget_total_update" ON public.budget_total
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "budget_total_delete" ON public.budget_total
    FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER budget_total_set_updated_at
    BEFORE UPDATE ON public.budget_total
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_budget_total_user_period ON public.budget_total(user_id, period);

-- RLS 정책과 동일 범위로 GRANT 함께 부여 (CLAUDE.md 규칙 — RLS만으로는 부족,
-- authenticated 롤에 명시적 GRANT 없으면 42501 permission denied로 조용히 막힘).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_total TO authenticated;
