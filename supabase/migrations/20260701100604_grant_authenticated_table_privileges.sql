-- [버그 수정] authenticated 롤 테이블 권한 GRANT 누락 보완
--
-- config.toml의 `auto_expose_new_tables`가 기본 비활성화(신규 클라우드 프로젝트 기본값)라
-- S-1-1~S-1-8에서 생성한 테이블 전부가 anon/authenticated 롤에 테이블 단위 권한이
-- 부여되지 않은 상태였다. PostgreSQL은 RLS 정책 평가 이전에 테이블 GRANT부터 확인하므로,
-- RLS 정책 자체는 올바르게 작성되어 있었지만 authenticated 사용자는 어떤 테이블도
-- 실제로 조회/저장할 수 없었다(42501 permission denied).
--
-- 모든 테이블이 개인별 사용자 전용 데이터이므로 anon에는 권한을 부여하지 않는다.
-- 범위는 각 테이블 마이그레이션에 이미 작성된 RLS 정책과 동일하게 맞춘다
-- (데이터정책_및_시드정의서 3장 RLS 정책 표 기준).

-- DELETE 정책 없음(soft delete만 허용) — SELECT/INSERT/UPDATE만 부여
GRANT SELECT, INSERT, UPDATE ON public.category TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payment_method TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.vendor TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.item TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.unit TO authenticated;

-- 실제 DELETE 정책 존재 — DELETE 포함
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_detail TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget TO authenticated;
