-- REVIEW ONLY. This restores the specific preflight ACL supplied on 2026-11-06:
-- anon/authenticated had ALL table privileges; no column-specific ACL/PUBLIC DML.
-- Do not run if preflight differs. Pause menu writes and deploy old app in coordination.
-- No menu/user/cart/order rows are reverted/deleted. Does not undo joins or snapshots.
BEGIN;
DROP FUNCTION public.sf_manage_menu(uuid,uuid,timestamptz,jsonb);
GRANT ALL PRIVILEGES ON public.menu_items,public.menu_item_option_groups,public.menu_item_options TO anon,authenticated;
COMMIT;
-- This restores known broad/unsafe access; an emergency rollback must be DBA approved.
