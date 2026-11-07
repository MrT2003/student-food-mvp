-- Review/apply only when rolling back 202610310001. No user-data reversal.
BEGIN;
DROP TRIGGER IF EXISTS sf_guard_staff_user ON public.users;
DROP TRIGGER IF EXISTS sf_guard_staff_owner ON public.restaurants;
DROP FUNCTION IF EXISTS public.join_staff_qr(text);
DROP FUNCTION IF EXISTS public.sf_guard_staff_identity();
-- No existing grants/policies/functions were modified by the forward migration.
-- Dropping the guards restores prior broad direct-write exposure: restrict traffic
-- during rollback and roll application back to fail-closed join before this step.
-- Keep the Vault secret for controlled review; do not automatically delete shared keys.
NOTIFY pgrst,'reload schema';
COMMIT;
