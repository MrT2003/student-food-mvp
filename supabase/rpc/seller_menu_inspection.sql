-- STEP 1 / STEP 3: READ ONLY preflight and postflight. Save every result before applying.
-- Expected version >=17 (existing metadata includes MAINTAIN privilege).
SELECT current_database(),current_setting('server_version_num') AS server_version_num;
-- All input/return columns; stop if menu schema differs from the reviewed metadata.
SELECT table_name,column_name,data_type,is_nullable,column_default,numeric_precision,numeric_scale
FROM information_schema.columns WHERE table_schema='public' AND table_name IN
 ('menu_items','menu_item_option_groups','menu_item_options') ORDER BY table_name,ordinal_position;
SELECT con.conrelid::regclass AS table_name,con.conname,pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con WHERE con.conrelid IN
 ('public.menu_items'::regclass,'public.menu_item_option_groups'::regclass,'public.menu_item_options'::regclass);
SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public'
 AND tablename IN ('menu_items','menu_item_option_groups','menu_item_options');
-- Preserve exact ACL baseline, including column ACL. No credential or business rows.
SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl,a.attname,a.attacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
WHERE n.nspname='public' AND c.relname IN ('menu_items','menu_item_option_groups','menu_item_options') ORDER BY c.relname,a.attnum;
-- Before: known broad rights. After: can_read=true, any_direct_write=false (six rows).
SELECT r.rolname,c.relname,
 has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,
 has_table_privilege(r.oid,c.oid,'SELECT') AS can_read,
 has_table_privilege(r.oid,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') AS any_direct_write
FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE r.rolname IN ('anon','authenticated') AND n.nspname='public'
 AND c.relname IN ('menu_items','menu_item_option_groups','menu_item_options');
-- Before: ZERO rows. After: ONE public function with the exact named four arguments,
-- jsonb return, postgres owner, SECURITY DEFINER=true, search_path="",
-- authenticated_execute=true and anon_execute=false.
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS signature,
 p.proargnames,pg_get_function_result(p.oid) AS result_type,pg_get_userbyid(p.proowner) AS owner,
 p.prosecdef AS security_definer,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.prokind='f' AND p.proname='sf_manage_menu';
-- After: zero rows for direct column write privileges. Table-level grants also
-- appear through this view, so interpret together with the effective check above.
SELECT grantee,table_name,column_name,privilege_type FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name IN ('menu_items','menu_item_option_groups','menu_item_options')
 AND grantee IN ('PUBLIC','anon','authenticated') AND privilege_type IN ('INSERT','UPDATE','REFERENCES');
-- Preflight expects ZERO non-internal triggers based on the supplied metadata.
-- If any appear, review their definitions/dependencies before applying menu SQL.
SELECT c.relname AS table_name,t.tgname,t.tgenabled,
 pg_get_triggerdef(t.oid) AS trigger_definition,pg_get_functiondef(t.tgfoid) AS function_definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE NOT t.tgisinternal AND n.nspname='public'
 AND c.relname IN ('menu_items','menu_item_option_groups','menu_item_options');

-- FINAL SUMMARY: always ONE row, even when there are no functions/triggers.
-- SQL Editor can display only the last statement result; use this for rollout handoff.
WITH functions AS (
 SELECT p.*,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE p.prokind='f' AND p.proname='sf_manage_menu'
)
SELECT
 (SELECT count(*) FROM functions) AS rpc_count,
 EXISTS (SELECT 1 FROM functions WHERE nspname='public'
   AND oid=to_regprocedure('public.sf_manage_menu(uuid,uuid,timestamptz,jsonb)')
   AND proargnames=ARRAY['p_restaurant_id','p_item_id','p_expected_updated_at','p_payload']::text[]
   AND prorettype='jsonb'::regtype AND prosecdef
   AND pg_get_userbyid(proowner)='postgres'
   AND has_function_privilege('authenticated',oid,'EXECUTE')
   AND NOT has_function_privilege('anon',oid,'EXECUTE')
   AND 'search_path=""'=ANY(proconfig)
 ) AS rpc_contract_and_access_ok,
 (SELECT coalesce(jsonb_agg(jsonb_build_object(
   'schema',nspname,'signature',pg_get_function_identity_arguments(oid),
   'parameters',proargnames,'return_type',pg_get_function_result(oid),
   'owner',pg_get_userbyid(proowner),'security_definer',prosecdef,
   'authenticated_execute',has_function_privilege('authenticated',oid,'EXECUTE'),
   'anon_execute',has_function_privilege('anon',oid,'EXECUTE')
 )), '[]'::jsonb) FROM functions) AS rpc_metadata,
 (SELECT jsonb_agg(jsonb_build_object(
   'role',r.rolname,'table',c.relname,
   'can_read',has_table_privilege(r.oid,c.oid,'SELECT'),
   'schema_usage',has_schema_privilege(r.oid,n.oid,'USAGE'),
   'any_direct_write',has_table_privilege(r.oid,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'),
   'any_column_write',has_any_column_privilege(r.oid,c.oid,'INSERT,UPDATE,REFERENCES')
 ) ORDER BY c.relname,r.rolname)
 FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE r.rolname IN ('anon','authenticated') AND n.nspname='public'
   AND c.relname IN ('menu_items','menu_item_option_groups','menu_item_options')
 ) AS menu_permissions;
