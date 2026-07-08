-- [PM 요청 2026-07-08] 시스템 기본 지출항목 "관리비" -> "관리비/공과금" 개명
-- (관리비뿐 아니라 공과금 성격의 지출도 포괄한다는 걸 이름에서 드러내기 위함)

-- 1. 기존 가입 사용자들의 시스템 기본 행 개명 (사용자가 직접 같은 이름으로 만든 커스텀 항목은
--    is_system_default=false라 영향받지 않음)
UPDATE public.category
SET name = '관리비/공과금'
WHERE name = '관리비' AND is_system_default = true;

-- 2. 신규 가입자에게도 새 이름으로 생성되도록 트리거 함수 갱신
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.category (user_id, name, icon, is_system_default)
    VALUES
        (NEW.id, '식료품',       '🛒', true),
        (NEW.id, '의류',         '👕', true),
        (NEW.id, '주거',         '🏠', true),
        (NEW.id, '보험',         '🛡️', true),
        (NEW.id, '구독료',       '📱', true),
        (NEW.id, '관리비/공과금', '🏢', true),
        (NEW.id, '회비',         '🤝', true),
        (NEW.id, '용돈',         '💸', true),
        (NEW.id, '교통',         '🚗', true),
        (NEW.id, '의료/건강',   '🏥', true),
        (NEW.id, '기타',         '📦', true);
    RETURN NEW;
END;
$$;
