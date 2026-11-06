-- Dedicated TEST database only, after migration. Never run on production.
-- DBA first provisions an Auth test seller + owned test restaurant through supported setup.
-- Supply only their UUIDs using psql -v seller_id=... -v restaurant_id=...
-- This is DB role/transaction testing, NOT proof of a real OAuth/API session.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claim.sub', :'seller_id', true);
SELECT set_config('sf_test.restaurant', :'restaurant_id', true);
SET LOCAL ROLE authenticated;
DO $test$
DECLARE rid uuid:=current_setting('sf_test.restaurant')::uuid; saved jsonb; changed jsonb;
  item_id uuid; v text; gid uuid:=gen_random_uuid(); oid uuid:=gen_random_uuid(); before_count bigint;
  body jsonb; snapshots jsonb; restored jsonb; foreign_tree jsonb;
BEGIN
 body:=jsonb_build_object('name','SQL MENU TEST','description',NULL,'category','TEST','image_url',NULL,
  'price',12.34,'is_active',true,'is_available',true,'groups',jsonb_build_array(jsonb_build_object(
  'id',gid,'name','SQL GROUP','is_active',true,'is_required',true,'is_multiple',false,'options',jsonb_build_array(
   jsonb_build_object('id',oid,'option_name','SQL OPTION','additional_price',0.05,'is_active',true)))));
 saved:=public.sf_manage_menu(rid,NULL,NULL,body); item_id:=(saved#>>'{item,id}')::uuid; v:=saved#>>'{item,updated_at}';
 ASSERT saved#>>'{item,option_groups,0,id}'=gid::text;
 SELECT count(*) INTO before_count FROM public.order_items;
 SELECT coalesce(jsonb_agg(to_jsonb(oi) ORDER BY oi.id),'[]'::jsonb) INTO snapshots
 FROM public.order_items oi JOIN public.orders ord ON ord.id=oi.order_id WHERE ord.restaurant_id=rid;
 changed:=public.sf_manage_menu(rid,item_id,v::timestamptz,'{"is_available":false}'::jsonb);
 ASSERT changed#>>'{item,is_available}'='false';
 ASSERT changed#>>'{item,is_active}'='true';
 BEGIN
   PERFORM public.sf_manage_menu(rid,item_id,v::timestamptz,'{"is_active":false}'::jsonb);
   RAISE EXCEPTION 'TEST expected stale';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'MENU_STALE' THEN RAISE; END IF; END;
 v:=changed#>>'{item,updated_at}';
 -- Duplicate name with a different UUID hits the real unique index AFTER the item UPDATE.
 body:=jsonb_set(body,'{name}','"MUST ROLLBACK"');
 body:=jsonb_set(body,'{groups,0,id}',to_jsonb(gen_random_uuid()::text));
 body:=jsonb_set(body,'{groups,0,options,0,id}',to_jsonb(gen_random_uuid()::text));
 BEGIN
   PERFORM public.sf_manage_menu(rid,item_id,v::timestamptz,body);
   RAISE EXCEPTION 'TEST expected duplicate rejection';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 ASSERT (SELECT name FROM public.menu_items WHERE id=item_id)='SQL MENU TEST';
 BEGIN
   UPDATE public.menu_items SET is_active=false WHERE id=item_id;
   RAISE EXCEPTION 'TEST direct update unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 changed:=public.sf_manage_menu(rid,item_id,v::timestamptz,'{"is_active":false}'::jsonb);
 ASSERT changed#>>'{item,is_active}'='false';
 ASSERT (SELECT id FROM public.menu_item_option_groups WHERE id=gid)=gid;
 ASSERT (SELECT count(*) FROM public.order_items)=before_count;
 ASSERT (SELECT coalesce(jsonb_agg(to_jsonb(oi) ORDER BY oi.id),'[]'::jsonb)
   FROM public.order_items oi JOIN public.orders ord ON ord.id=oi.order_id WHERE ord.restaurant_id=rid)=snapshots;
 -- Reuse the original UUIDs after omission. No new ID is invented to bypass names.
 body:=jsonb_set(body,'{name}','"SQL MENU TEST"');
 body:=jsonb_set(body,'{groups,0,id}',to_jsonb(gid::text));
 body:=jsonb_set(body,'{groups,0,options,0,id}',to_jsonb(oid::text));
 v:=changed#>>'{item,updated_at}';
 restored:=public.sf_manage_menu(rid,item_id,v::timestamptz,jsonb_set(body,'{groups}','[]'::jsonb));
 ASSERT NOT (SELECT is_active FROM public.menu_item_option_groups WHERE id=gid);
 restored:=public.sf_manage_menu(rid,item_id,(restored#>>'{item,updated_at}')::timestamptz,body);
 ASSERT restored#>>'{item,option_groups,0,id}'=gid::text;
 ASSERT restored#>>'{item,option_groups,0,options,0,id}'=oid::text;
 foreign_tree:=public.sf_manage_menu(rid,NULL,NULL,jsonb_set(jsonb_set(body,'{groups,0,id}',to_jsonb(gen_random_uuid()::text)),'{groups,0,options,0,id}',to_jsonb(gen_random_uuid()::text)));
 BEGIN
   PERFORM public.sf_manage_menu(rid,(foreign_tree#>>'{item,id}')::uuid,(foreign_tree#>>'{item,updated_at}')::timestamptz,body);
   RAISE EXCEPTION 'TEST foreign child accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'MENU_FORBIDDEN' THEN RAISE; END IF; END;
END;
$test$;
ROLLBACK;
-- Also test two DB sessions: both use the SAME prior updated_at, session A holds
-- successful RPC transaction open; B waits, then receives MENU_STALE after A commits.
-- Repeat edit/edit, edit/toggle, edit/soft-hide and checkout/menu concurrency.
-- Use only dedicated fixture rows, compare complete order snapshot JSON before/after.
