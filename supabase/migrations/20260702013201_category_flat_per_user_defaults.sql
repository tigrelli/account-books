-- [F-1-4-2 후속 PM 요청] CATEGORY(지출항목) 단일 계층화 + 시스템 기본값을 payment_method와 동일한
-- "회원가입 트리거로 사용자별 소유 행 생성" 패턴으로 전환.
-- 기존 방식(user_id IS NULL 전역 공유 행)은 한 사용자의 is_active 토글이 전체 사용자에게 영향을 주는
-- 문제가 있어 폐기 — 이제 시스템 기본 지출항목도 사용자마다 개별 소유 행이라 안전하게 활성/비활성 가능.

-- 1. 부모-자식 계층 제거 (지출항목은 단일 레벨)
DROP INDEX IF EXISTS public.idx_category_parent_id;
ALTER TABLE public.category DROP CONSTRAINT IF EXISTS category_parent_id_fkey;
ALTER TABLE public.category DROP COLUMN IF EXISTS parent_id;

-- 전역 공유 행 모델 폐기에 맞춰 user_id를 payment_method와 동일하게 필수화
-- (아래 5번에서 레거시 user_id IS NULL 행을 삭제하므로 그 이후에 NOT NULL 부여)

-- 2. RLS 단순화 — payment_method와 동일하게 본인 것만 (시스템 기본도 이제 본인 소유 행이라 예외 불필요)
DROP POLICY IF EXISTS "category_select" ON public.category;
DROP POLICY IF EXISTS "category_update" ON public.category;

CREATE POLICY "category_select" ON public.category
    FOR SELECT
    USING (user_id = auth.uid());

-- is_active 토글은 시스템 기본 행도 허용(본인 소유이므로 안전). 이름/아이콘 수정은 계속 앱 레벨에서
-- is_system_default=false인 경우만 허용하도록 제한(서버 액션에서 처리).
CREATE POLICY "category_update" ON public.category
    FOR UPDATE
    USING (user_id = auth.uid());

-- 3. 회원가입 시 사용자별 기본 지출항목 자동 생성 트리거 (데이터정책_및_시드정의서 1-1)
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.category (user_id, name, icon, is_system_default)
    VALUES
        (NEW.id, '식료품',     '🛒', true),
        (NEW.id, '의류',       '👕', true),
        (NEW.id, '주거',       '🏠', true),
        (NEW.id, '보험',       '🛡️', true),
        (NEW.id, '구독료',     '📱', true),
        (NEW.id, '관리비',     '🏢', true),
        (NEW.id, '회비',       '🤝', true),
        (NEW.id, '용돈',       '💸', true),
        (NEW.id, '교통',       '🚗', true),
        (NEW.id, '의료/건강', '🏥', true),
        (NEW.id, '기타',       '📦', true);
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_category
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.create_default_categories();

-- 4. 기존 가입 사용자 백필 (트리거 적용 전 가입자에게도 동일 기본 지출항목 부여)
INSERT INTO public.category (user_id, name, icon, is_system_default)
SELECT u.id, d.name, d.icon, true
FROM auth.users u
CROSS JOIN (VALUES
    ('식료품', '🛒'), ('의류', '👕'), ('주거', '🏠'), ('보험', '🛡️'),
    ('구독료', '📱'), ('관리비', '🏢'), ('회비', '🤝'), ('용돈', '💸'),
    ('교통', '🚗'), ('의료/건강', '🏥'), ('기타', '📦')
) AS d(name, icon)
WHERE NOT EXISTS (
    SELECT 1 FROM public.category c
    WHERE c.user_id = u.id AND c.name = d.name AND c.is_system_default = true
);

-- 5. 레거시 전역 공유 기본 지출항목(user_id IS NULL) 삭제 — 이제 사용자별 행으로 대체됨
DELETE FROM public.category WHERE user_id IS NULL AND is_system_default = true;

-- 6. user_id 필수화 (payment_method와 동일 — 전역 공유 행 모델 폐기 확정)
ALTER TABLE public.category ALTER COLUMN user_id SET NOT NULL;
