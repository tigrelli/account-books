-- [F-3-1-5] SYNONYM_DICTIONARY 테이블 생성 (아키텍처 5장/1-1⑤, 데이터정책_및_시드정의서 1-4장)
-- 시스템 전역 테이블(사용자 소유 아님) — 운영자가 미리 큐레이션해두는 동의어 그룹.
-- "대파"="파"="쪽파"처럼 group_key가 같으면 같은 그룹(F-1-5-7 유사 항목 제안이 참고).
--
-- RLS: 전체 로그인 사용자에게 SELECT는 공개(전체 사용자 공통 참고 자료), INSERT/UPDATE/DELETE는
-- "운영자만" — 별도 운영자 role 없이 1단계와 동일하게 authenticated용 쓰기 정책 자체를 만들지
-- 않는다(=클라이언트로는 절대 쓰기 불가, Service Role Key로만 가능). 어드민 화면(F-3-1-5)의
-- 서버 액션이 ADMIN_EMAILS 화이트리스트 확인 후 Service Role 클라이언트로 직접 쓴다.

CREATE TABLE IF NOT EXISTS public.synonym_dictionary (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_key  text        NOT NULL,
    term       text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (group_key, term)
);

ALTER TABLE public.synonym_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "synonym_dictionary_select" ON public.synonym_dictionary
    FOR SELECT
    TO authenticated
    USING (true);

-- INSERT/UPDATE/DELETE 정책 없음(운영자만, Service Role Key로만 가능) — 의도된 설계.

CREATE TRIGGER synonym_dictionary_set_updated_at
    BEFORE UPDATE ON public.synonym_dictionary
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_synonym_dictionary_group_key ON public.synonym_dictionary(group_key);

-- RLS 정책과 정확히 같은 범위로 GRANT — SELECT만(데이터정책_및_시드정의서 3장 경고 참고,
-- 정책 없는 동작에는 GRANT도 부여하지 않음).
GRANT SELECT ON public.synonym_dictionary TO authenticated;
