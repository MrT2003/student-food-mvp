-- REVIEW ONLY. Roll back application first. Never discard saved shop numbers.
BEGIN;
DO $review$
BEGIN
  IF EXISTS (SELECT 1 FROM public.restaurants WHERE contact_phone IS NOT NULL) THEN
    RAISE EXCEPTION 'CONTACT_DATA_PRESENT_BACKUP_AND_REVIEW_REQUIRED';
  END IF;
END;
$review$;
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS sf_restaurant_contact_phone_format;
ALTER TABLE public.restaurants DROP COLUMN contact_phone;
COMMIT;
-- Only for the column introduced by the reviewed migration; do not run if it
-- predates this change or another caller now depends on it. No CASCADE.
