-- [S-3-2] item_stats Materialized View — (user_id, item_id, period) 기준 상세품목 집계
-- (아키텍처 설계서 5장). transaction_detail은 user_id/occurred_at이 없어 transaction과
-- 조인해서 구한다. Top10/드릴다운(F-3-1-3)의 기반 데이터.
--
-- 병합(merge, F-1-6-3) 처리 노트: mergeItemAction이 병합 시점에 transaction_detail.item_id를
-- 즉시 대표 품목으로 재배정하므로 item_id는 보통 이미 대표 품목 기준이다. 다만 멀티 스테이트먼트
-- 트랜잭션 미지원으로 재배정이 누락된 과거 데이터가 섞여 있을 가능성이 있는데, 이 경우까지 MV
-- 안에서 병합 체인을 재귀적으로 재해석하진 않는다 — lib/item-merge.ts의 resolveCanonicalItemId가
-- 이미 그 방어 로직으로 설계돼 있고(다단계 체인 + 순환 참조 방어), F-3-1-3 착수 시 이 MV 조회
-- 결과에 그 함수를 적용하는 걸로 역할을 분리한다(중복 구현 방지).
--
-- ⚠️ tx_stats(S-3-1)와 동일한 보안 설계: PostgreSQL Materialized View는 RLS를 지원하지 않아
-- MV 자체는 GRANT하지 않고, auth.uid()로 필터링하는 SECURITY DEFINER 함수만 노출한다.

CREATE MATERIALIZED VIEW public.item_stats AS
SELECT
    t.user_id,
    to_char(t.occurred_at, 'YYYY-MM') AS period,
    td.item_id,
    SUM(td.amount) AS total_amount,
    COUNT(*) AS transaction_count,
    AVG(td.amount) AS avg_amount
FROM public.transaction_detail td
JOIN public.transaction t ON t.id = td.transaction_id
GROUP BY t.user_id, to_char(t.occurred_at, 'YYYY-MM'), td.item_id;

CREATE UNIQUE INDEX item_stats_unique_idx
    ON public.item_stats (user_id, period, item_id);

REVOKE ALL ON public.item_stats FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_item_stats(p_period text DEFAULT NULL)
RETURNS SETOF public.item_stats
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT *
    FROM public.item_stats
    WHERE user_id = auth.uid()
      AND (p_period IS NULL OR period = p_period);
$$;

REVOKE ALL ON FUNCTION public.get_item_stats(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_item_stats(text) TO authenticated;
