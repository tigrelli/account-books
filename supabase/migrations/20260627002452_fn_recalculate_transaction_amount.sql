-- [S-1-10] TRANSACTION.amount 자동계산 트리거
-- has_detail = true인 경우: amount = SUM(transaction_detail.amount) + adjustment_amount (읽기전용)
-- has_detail = false인 경우: amount 직접 입력 — 이 트리거 미동작 (아키텍처 1-1③)
-- 트리거 시점: TRANSACTION_DETAIL INSERT / UPDATE / DELETE 후 부모 TRANSACTION 갱신

CREATE OR REPLACE FUNCTION public.recalculate_transaction_amount()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_transaction_id uuid;
BEGIN
    v_transaction_id := CASE TG_OP
        WHEN 'DELETE' THEN OLD.transaction_id
        ELSE NEW.transaction_id
    END;

    -- 서브쿼리로 상세항목 합계를 구하고, adjustment_amount는 SET 절에서 더함
    UPDATE public.transaction t
    SET amount = (
        SELECT COALESCE(SUM(td.amount), 0)
        FROM public.transaction_detail td
        WHERE td.transaction_id = v_transaction_id
    ) + COALESCE(t.adjustment_amount, 0)
    WHERE t.id = v_transaction_id
      AND t.has_detail = true;

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER transaction_detail_amount_sync
    AFTER INSERT OR UPDATE OF amount OR DELETE
    ON public.transaction_detail
    FOR EACH ROW EXECUTE FUNCTION public.recalculate_transaction_amount();
