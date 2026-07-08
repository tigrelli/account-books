-- [S-3-1] tx_stats Materialized View — 기간×카테고리×지출처×지출분류 사전 집계
-- (아키텍처 설계서 5장). 월별 추이/카테고리별/지출분류별/지출처 Top N 화면이 모두
-- 이 하나의 MV를 기준으로 필요한 차원만 추가 GROUP BY 해서 재사용한다.
--
-- ⚠️ 보안 설계 노트: PostgreSQL Materialized View는 RLS(Row Level Security)를 지원하지
-- 않는다(ALTER MATERIALIZED VIEW ... ENABLE ROW LEVEL SECURITY 자체가 불가) — 데이터정책_
-- 및_시드정의서.md 3장의 "테이블과 동일하게 GRANT" 전제가 MV에는 그대로 적용되지 않는다.
-- 그래서 이 MV 자체는 authenticated/anon 어느 롤에도 SELECT GRANT하지 않고(기본값 유지),
-- 대신 호출자의 auth.uid()로 내부에서 직접 필터링하는 SECURITY DEFINER 함수
-- (get_tx_stats)만 authenticated에 EXECUTE 권한을 부여해 우회 접근을 막는다
-- (fn_recalculate_transaction_amount와 동일한 SECURITY DEFINER 패턴 재사용).

CREATE MATERIALIZED VIEW public.tx_stats AS
SELECT
    user_id,
    to_char(occurred_at, 'YYYY-MM') AS period,
    category_id,
    vendor_id,
    payment_method_id,
    SUM(amount) AS total_amount,
    COUNT(*) AS transaction_count
FROM public.transaction
GROUP BY user_id, to_char(occurred_at, 'YYYY-MM'), category_id, vendor_id, payment_method_id;

-- REFRESH MATERIALIZED VIEW CONCURRENTLY는 유니크 인덱스가 있어야 동작(S-3-4에서 사용).
CREATE UNIQUE INDEX tx_stats_unique_idx
    ON public.tx_stats (user_id, period, category_id, vendor_id, payment_method_id);

-- MV 자체는 어떤 롤에도 GRANT하지 않음(기본값) — PUBLIC 기본 권한도 명시적으로 제거.
REVOKE ALL ON public.tx_stats FROM PUBLIC, anon, authenticated;

-- 호출자 소유 행만 반환하는 안전한 접근 경로. p_period가 NULL이면 전체 기간 반환(추이 차트용),
-- 값이 있으면 해당 월만 반환(카테고리별/지출분류별/지출처 화면용).
CREATE OR REPLACE FUNCTION public.get_tx_stats(p_period text DEFAULT NULL)
RETURNS SETOF public.tx_stats
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT *
    FROM public.tx_stats
    WHERE user_id = auth.uid()
      AND (p_period IS NULL OR period = p_period);
$$;

REVOKE ALL ON FUNCTION public.get_tx_stats(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tx_stats(text) TO authenticated;
