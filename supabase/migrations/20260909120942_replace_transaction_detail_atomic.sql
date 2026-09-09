-- [HOTFIX] 지출 수정 시 상세항목(transaction_detail) 교체가 delete → insert 두 번의
-- 별도 PostgREST 요청(별도 트랜잭션)으로 이뤄져 원자성이 없던 버그 수정.
--
-- 실제 원인: 기존 상세항목이 있는 채로 delete()만 먼저 호출하면, transaction_detail_amount_sync
-- 트리거(fn_recalculate_transaction_amount.sql)가 마지막 행이 지워지는 순간 TRANSACTION.amount를
-- 0으로 재계산하려 하고, transaction_amount_check(amount > 0) 제약을 위반해 그 delete 문 전체가
-- 롤백된다(아무것도 안 지워짐). 그런데 apps/main/web/app/(app)/expenses/actions.ts의
-- updateExpenseAction은 이 delete()의 error를 검사하지 않고 곧바로 새 상세항목을 insert했기
-- 때문에, 화면에서는 "삭제"했지만 실제 DB에는 "기존 항목 + 새 항목"이 함께 남아 중복되는
-- 현상이 발생했다.
--
-- 이 함수 하나의 호출(= 하나의 DB 트랜잭션)로 삭제+삽입을 묶어 원자성을 보장하고, 부모
-- TRANSACTION 행을 FOR UPDATE로 잠가 같은 transaction_id에 대한 동시 호출도 직렬화한다.
-- 트리거 문제를 피하기 위해 새 상세항목을 먼저 insert하고(기존 행과 잠시 공존 — 합계가
-- 0 밑으로 내려가지 않음) 기존 행을 나중에 delete한다(반대 순서면 위와 동일하게 실패한다).
--
-- SECURITY INVOKER(기본값, 명시 생략)로 작성 — TRANSACTION/TRANSACTION_DETAIL 모두 이미
-- RLS로 소유자 검증을 하므로 함수 안에서 auth.uid() 체크를 중복 구현하지 않는다.
-- (get_tx_stats류의 SECURITY DEFINER 패턴과는 이유가 다르다: 그쪽은 RLS를 지원하지 않는
-- Materialized View라 함수 안에서 직접 필터링이 필요했지만, 여긴 RLS가 있는 일반 테이블이라
-- 호출자 권한 그대로 실행해도 RLS가 자동으로 소유자 범위를 강제한다.)
CREATE OR REPLACE FUNCTION public.replace_transaction_detail(
    p_transaction_id uuid,
    p_details jsonb
)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    v_old_ids uuid[];
BEGIN
    -- 같은 transaction_id에 대한 동시 호출을 직렬화 + 소유자 검증(RLS로 자동 필터링됨 —
    -- 본인 소유가 아니거나 존재하지 않으면 0행이 되어 아래 NOT FOUND로 걸러진다).
    PERFORM 1 FROM public.transaction WHERE id = p_transaction_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'transaction % not found or not owned by caller', p_transaction_id;
    END IF;

    SELECT array_agg(id) INTO v_old_ids
    FROM public.transaction_detail
    WHERE transaction_id = p_transaction_id;

    -- p_details가 빈 배열이면 삽입 없이 기존 행만 지운다(직접입력 모드 전환 시 상세행 정리 용도로도
    -- 재사용 — 이 경로는 호출 전에 TRANSACTION.has_detail이 이미 false로 바뀌어 있어 트리거가
    -- no-op이므로 순서와 무관하게 안전하다).
    INSERT INTO public.transaction_detail (
        transaction_id, item_id, item_raw_text, quantity_value, unit_id, quantity_raw_text, amount
    )
    SELECT
        p_transaction_id,
        (elem->>'item_id')::uuid,
        elem->>'item_raw_text',
        NULLIF(elem->>'quantity_value', '')::numeric,
        NULLIF(elem->>'unit_id', '')::uuid,
        elem->>'quantity_raw_text',
        (elem->>'amount')::numeric
    FROM jsonb_array_elements(p_details) AS elem;

    DELETE FROM public.transaction_detail WHERE id = ANY(v_old_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_transaction_detail(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_transaction_detail(uuid, jsonb) TO authenticated;
