-- REVIEWED against restaurants column metadata supplied on 2026-11-14:
-- no shop contact column exists. Not applied by the application or agent.
-- Current DB triggers/permissions still require deployment review.
-- Do not run if an existing shop contact column should be reused instead.
BEGIN;
DO $review$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='restaurants'
      AND column_name <> 'contact_phone' AND column_name ~* '(phone|telephone|mobile|contact.*number)') THEN
    RAISE EXCEPTION 'REVIEW_EXISTING_RESTAURANT_CONTACT_COLUMN';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='restaurants' AND column_name='contact_phone') THEN
    RAISE EXCEPTION 'COLUMN_EXISTS_REUSE_AND_REVIEW_DO_NOT_RECREATE';
  END IF;
END;
$review$;
ALTER TABLE public.restaurants ADD COLUMN contact_phone text NULL;
-- No user backfill, no Auth/profile/owner/default/status change, no new privileges.
ALTER TABLE public.restaurants ADD CONSTRAINT sf_restaurant_contact_phone_format
  CHECK (contact_phone IS NULL OR contact_phone ~ '^[+]?[0-9]{9,15}$');
COMMENT ON COLUMN public.restaurants.contact_phone IS
  'Optional shop contact number; separate from users.phone/Auth identity.';
COMMIT;
-- Postflight (metadata only):
SELECT column_name,data_type,is_nullable FROM information_schema.columns
WHERE table_schema='public' AND table_name='restaurants' AND column_name='contact_phone';
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid='public.restaurants'::regclass AND conname='sf_restaurant_contact_phone_format';
