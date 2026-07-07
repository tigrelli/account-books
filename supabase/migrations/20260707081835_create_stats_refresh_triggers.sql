-- [S-3-4] tx_stats/item_stats/item_unit_stats MV 리프레시 트리거
-- (아키텍처 설계서 5장: "트랜잭션/상세항목 발생 시 즉시 집계 업데이트 — 소규모 가계부 데이터량
-- 기준 실시간 집계로 충분, 사용자 늘면 배치/CQRS로 전환"). Edge Function 스케줄 대신 트리거로
-- 구현 — 저장 즉시 반영되어야 대시보드에 "방금 입력한 지출이 통계에 안 보인다"는 지연이 없다.
--
-- REFRESH MATERIALIZED VIEW CONCURRENTLY는 전체 MV를 다시 계산한다(사용자 단위 부분 갱신이
-- 아님) — 이 단계에서는 전체 사용자 수가 적어 허용 가능한 비용으로 판단(설계서 명시), 사용자가
-- 늘어나 부담되면 배치/큐 방식으로 교체할 것(S-3-5/S-3-6과는 별개 확장 포인트).
-- FOR EACH STATEMENT 사용 — 한 INSERT/UPDATE/DELETE 문이 여러 행에 걸쳐도 MV는 한 번만 갱신.

CREATE OR REPLACE FUNCTION public.refresh_tx_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.tx_stats;
    RETURN NULL;
END;
$$;

CREATE TRIGGER transaction_refresh_tx_stats
    AFTER INSERT OR UPDATE OR DELETE ON public.transaction
    FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_tx_stats();

CREATE OR REPLACE FUNCTION public.refresh_item_level_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.item_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.item_unit_stats;
    RETURN NULL;
END;
$$;

-- transaction_detail 자체의 증감(수정 시 전체 삭제 후 재삽입 방식 포함)은 물론, transaction
-- 삭제 시 FK CASCADE로 발생하는 transaction_detail 삭제도 이 트리거를 그대로 태운다.
CREATE TRIGGER transaction_detail_refresh_item_stats
    AFTER INSERT OR UPDATE OR DELETE ON public.transaction_detail
    FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_item_level_stats();

-- transaction_detail은 안 바뀌어도 transaction.occurred_at만 바뀌면(날짜만 수정) item_stats/
-- item_unit_stats의 period 버킷이 달라지므로 별도로 갱신해야 한다.
CREATE TRIGGER transaction_occurred_at_refresh_item_stats
    AFTER UPDATE OF occurred_at ON public.transaction
    FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_item_level_stats();
