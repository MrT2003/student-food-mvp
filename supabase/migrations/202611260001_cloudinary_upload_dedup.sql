BEGIN;
-- Hỗ trợ chống upload trùng ảnh theo mã băm SHA-256 trên cùng user/mục đích/quán.
ALTER TABLE public.cloudinary_uploads
  ADD COLUMN IF NOT EXISTS file_hash text;

CREATE INDEX IF NOT EXISTS cloudinary_uploads_dedup
  ON public.cloudinary_uploads(user_id, purpose, file_hash)
  WHERE verified_url IS NOT NULL AND file_hash IS NOT NULL;

NOTIFY pgrst, 'reload schema';
COMMIT;
