-- F-3-1-5: synonym_dictionary는 INSERT/DELETE 정책이 아예 없다(운영자만, Service Role
-- 클라이언트로만 쓰기). service_role은 RLS는 우회하지만 테이블 GRANT는 RLS와 별개로
-- 검사되는데, auto_expose_new_tables가 꺼져 있어 service_role에도 자동으로 권한이
-- 부여되지 않는다 — 명시적으로 GRANT하지 않으면 42501 permission denied로 막힌다.
-- SELECT도 필요한 이유: PostgREST의 delete()가 내부적으로 RETURNING을 사용해서, DELETE
-- 권한만으로는 부족하고 SELECT 권한도 같이 있어야 42501 없이 동작한다.
GRANT SELECT, INSERT, DELETE ON public.synonym_dictionary TO service_role;
