-- [S-1-4] ITEM 테이블 생성
-- 정규화된 품목명(양파, 계란, 두부 등). 삭제 기능 미제공 — 병합(merge)으로만 통합 가능 (데이터정책 2장).
-- merged_into_item_id: 이 항목이 다른 항목으로 병합된 경우 대상 id (자기참조). null이면 유효한 항목.
-- aliases: 별칭 배열 ['대파','파'] — 자동완성 및 유사 항목 제안 시 활용 (F-1-5-7).

CREATE TABLE IF NOT EXISTS public.item (
    id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name                 text        NOT NULL,
    default_category_id  uuid        REFERENCES public.category(id) ON DELETE SET NULL,
    aliases              jsonb       NOT NULL DEFAULT '[]'::jsonb,
    merged_into_item_id  uuid        REFERENCES public.item(id) ON DELETE SET NULL,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_select" ON public.item
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "item_insert" ON public.item
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE: 일반 수정 + 병합(merged_into_item_id 설정) 모두 포함
CREATE POLICY "item_update" ON public.item
    FOR UPDATE USING (user_id = auth.uid());

-- 삭제 정책 미생성 — 삭제 기능 자체 미제공, 병합(merge)으로만 통합

CREATE TRIGGER item_set_updated_at
    BEFORE UPDATE ON public.item
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_item_user_id ON public.item(user_id);
-- 병합 체인 조회용 (merged_into_item_id 추적)
CREATE INDEX idx_item_merged_into ON public.item(merged_into_item_id) WHERE merged_into_item_id IS NOT NULL;
