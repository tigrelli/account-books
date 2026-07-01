-- 로컬 개발용 시드 데이터
-- 각 S-1-x 마이그레이션 완료 후 docs/데이터정책_및_시드정의서.md 기준으로 추가됩니다.

-- [S-1-1] 시스템 기본 카테고리 (데이터정책_및_시드정의서 1-1)
-- is_system_default = true, user_id = null
-- 고정 UUID 사용 — 개발/운영 환경 간 참조 일관성 보장

INSERT INTO public.category (id, user_id, parent_id, name, icon, is_system_default, is_active)
VALUES
    ('00000000-0000-0000-0001-000000000001', NULL, NULL, '식료품',    '🛒', true, true),
    ('00000000-0000-0000-0001-000000000002', NULL, NULL, '의류',      '👕', true, true),
    ('00000000-0000-0000-0001-000000000003', NULL, NULL, '주거',      '🏠', true, true),
    ('00000000-0000-0000-0001-000000000004', NULL, NULL, '보험',      '🛡️', true, true),
    ('00000000-0000-0000-0001-000000000005', NULL, NULL, '구독료',    '📱', true, true),
    ('00000000-0000-0000-0001-000000000006', NULL, NULL, '관리비',    '🏢', true, true),
    ('00000000-0000-0000-0001-000000000007', NULL, NULL, '회비',      '🤝', true, true),
    ('00000000-0000-0000-0001-000000000008', NULL, NULL, '용돈',      '💸', true, true),
    ('00000000-0000-0000-0001-000000000009', NULL, NULL, '교통',      '🚗', true, true),
    ('00000000-0000-0000-0001-000000000010', NULL, NULL, '의료/건강', '🏥', true, true),
    ('00000000-0000-0000-0001-000000000011', NULL, NULL, '기타',      '📦', true, true)
ON CONFLICT (id) DO NOTHING;

-- [S-1-5] 시스템 기본 단위 시드 데이터 (데이터정책_및_시드정의서 1-3)
-- is_system_default = true, user_id = null

INSERT INTO public.unit (id, user_id, name, is_system_default)
VALUES
    ('00000000-0000-0000-0005-000000000001', NULL, '개',  true),
    ('00000000-0000-0000-0005-000000000002', NULL, 'ea',  true),
    ('00000000-0000-0000-0005-000000000003', NULL, 'g',   true),
    ('00000000-0000-0000-0005-000000000004', NULL, 'kg',  true),
    ('00000000-0000-0000-0005-000000000005', NULL, 'ml',  true),
    ('00000000-0000-0000-0005-000000000006', NULL, 'L',   true),
    ('00000000-0000-0000-0005-000000000007', NULL, '봉',  true),
    ('00000000-0000-0000-0005-000000000008', NULL, '팩',  true),
    ('00000000-0000-0000-0005-000000000009', NULL, '묶음', true),
    ('00000000-0000-0000-0005-000000000010', NULL, 'box', true)
ON CONFLICT (id) DO NOTHING;

-- [S-1-2] PAYMENT_METHOD 시드 없음
-- 현금(지갑) 1종은 auth.users INSERT 트리거(create_default_payment_methods)가 자동 생성.
-- 로컬 개발 시 테스트 사용자를 Supabase 대시보드 또는 Auth API로 생성하면 트리거가 동작함.
-- 은행 계좌(AUTO_TRANSFER) 및 카드(CARD)는 사용자가 앱에서 직접 등록.
