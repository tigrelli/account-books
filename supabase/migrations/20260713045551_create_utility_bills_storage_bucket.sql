-- [S-2-5] 관리비 명세서 원본 파일용 Storage 버킷 생성 + 경로기반 RLS
-- 경로 규칙: {user_id}/{period}.{ext} (예: 11111111-.../2026-07.jpg) — 경로 자체에 소유자
-- 정보를 담아 RLS를 단순화한다(docs/2차/관리비명세서_데이터구조설계.md §5).
-- 비공개 버킷 — public 열람 URL 없음, 서버가 signed URL을 그때그때 발급(S-2-6에서 구현).

INSERT INTO storage.buckets (id, name, public)
VALUES ('utility-bills', 'utility-bills', false)
ON CONFLICT (id) DO NOTHING;

-- 경로 첫 세그먼트(폴더명)가 본인 user_id와 일치하는 경우만 허용
CREATE POLICY "utility_bills_select_own"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'utility-bills'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "utility_bills_insert_own"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'utility-bills'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "utility_bills_update_own"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'utility-bills'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "utility_bills_delete_own"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'utility-bills'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
