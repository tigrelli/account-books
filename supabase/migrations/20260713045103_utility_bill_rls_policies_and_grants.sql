-- [S-2-4] UTILITY_BILL_ITEM / UTILITY_BILL_RECORD / UTILITY_BILL_ITEM_VALUE RLS 정책 + GRANT
-- 범위는 데이터정책_및_시드정의서.md 3장 표, docs/2차/관리비명세서_데이터구조설계.md §4와 동일.
-- GRANT 누락 시 RLS와 무관하게 42501 permission denied가 발생한 이력이 있어(S-1-1~S-1-8),
-- 이번엔 처음부터 RLS 정책과 같은 마이그레이션에 GRANT까지 함께 작성한다.

-- UTILITY_BILL_ITEM: 본인 것만 SELECT/INSERT/UPDATE. DELETE 정책 없음(soft delete만, ITEM과 동일 원칙)
CREATE POLICY "utility_bill_item_select" ON public.utility_bill_item
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "utility_bill_item_insert" ON public.utility_bill_item
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "utility_bill_item_update" ON public.utility_bill_item
    FOR UPDATE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.utility_bill_item TO authenticated;

-- UTILITY_BILL_RECORD: 본인 것만 SELECT/INSERT/UPDATE/DELETE (재업로드 시 삭제 필요, TRANSACTION과 동일 원칙)
CREATE POLICY "utility_bill_record_select" ON public.utility_bill_record
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "utility_bill_record_insert" ON public.utility_bill_record
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "utility_bill_record_update" ON public.utility_bill_record
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "utility_bill_record_delete" ON public.utility_bill_record
    FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.utility_bill_record TO authenticated;

-- UTILITY_BILL_ITEM_VALUE: user_id 없음 — 부모 RECORD가 본인 것인 경우만(TRANSACTION_DETAIL과 동일 원칙)
CREATE POLICY "utility_bill_item_value_select" ON public.utility_bill_item_value
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.utility_bill_record r
            WHERE r.id = record_id AND r.user_id = auth.uid()
        )
    );

CREATE POLICY "utility_bill_item_value_insert" ON public.utility_bill_item_value
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.utility_bill_record r
            WHERE r.id = record_id AND r.user_id = auth.uid()
        )
    );

CREATE POLICY "utility_bill_item_value_update" ON public.utility_bill_item_value
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.utility_bill_record r
            WHERE r.id = record_id AND r.user_id = auth.uid()
        )
    );

CREATE POLICY "utility_bill_item_value_delete" ON public.utility_bill_item_value
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.utility_bill_record r
            WHERE r.id = record_id AND r.user_id = auth.uid()
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.utility_bill_item_value TO authenticated;
