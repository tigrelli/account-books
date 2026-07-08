-- [S-3-3] item_unit_stats Materialized View — (user_id, item_id, unit_id, period) 기준
-- 수량 기반 단가 통계 (아키텍처 설계서 5장 "수량 기반 통계(단가 분석)"). 단가 추이 차트(F-3-1-4)의
-- 기반 데이터 — "양파(kg 단위) 평균 단가가 이번 달 얼마나 올랐는지" 같은 화면에 쓰인다.
--
-- 제외 기준: quantity_value 또는 unit_id가 NULL인 레코드("1+1" 등 구조화 실패)는 단가 통계에서
-- 자동 제외한다. 다만 금액 자체는 item_stats(S-3-2)의 Top10 집계에는 계속 포함되고, 오직 이
-- "수량 기반" 통계에서만 빠진다 — 같은 데이터가 통계 종류에 따라 포함/제외가 갈리는 설계(설계서
-- 5장에 명시된 의도된 동작).
-- 단위가 섞여 있으면 합치지 않음: 같은 품목이라도 unit_id가 다르면 별도 그룹으로 분리된다.
--
-- ⚠️ tx_stats(S-3-1)/item_stats(S-3-2)와 동일한 보안 설계: Materialized View는 RLS를 지원하지
-- 않아 MV 자체는 GRANT하지 않고, auth.uid()로 필터링하는 SECURITY DEFINER 함수만 노출한다.

CREATE MATERIALIZED VIEW public.item_unit_stats AS
SELECT
    t.user_id,
    to_char(t.occurred_at, 'YYYY-MM') AS period,
    td.item_id,
    td.unit_id,
    SUM(td.quantity_value) AS total_quantity,
    SUM(td.amount) AS total_amount,
    AVG(td.amount / td.quantity_value) AS avg_unit_price
FROM public.transaction_detail td
JOIN public.transaction t ON t.id = td.transaction_id
WHERE td.quantity_value IS NOT NULL
  AND td.unit_id IS NOT NULL
GROUP BY t.user_id, to_char(t.occurred_at, 'YYYY-MM'), td.item_id, td.unit_id;

CREATE UNIQUE INDEX item_unit_stats_unique_idx
    ON public.item_unit_stats (user_id, period, item_id, unit_id);

REVOKE ALL ON public.item_unit_stats FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_item_unit_stats(p_period text DEFAULT NULL)
RETURNS SETOF public.item_unit_stats
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT *
    FROM public.item_unit_stats
    WHERE user_id = auth.uid()
      AND (p_period IS NULL OR period = p_period);
$$;

REVOKE ALL ON FUNCTION public.get_item_unit_stats(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_item_unit_stats(text) TO authenticated;
