-- Read-only inspection. Do not execute function bodies returned by these SELECTs.
-- No application/user/bank row data is selected.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       pg_get_function_arguments(p.oid) AS arguments_with_defaults,
       pg_get_function_result(p.oid) AS result_type,
       p.prosecdef AS security_definer,
       pg_get_userbyid(p.proowner) AS owner,
       p.proconfig AS function_settings,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prokind = 'f'
  AND n.nspname NOT IN ('pg_catalog','information_schema','auth','storage')
  AND n.nspname NOT LIKE 'pg_%'
  AND (p.proname ~* '(staff|join|invita|recruit)'
       OR p.prosrc ~* '(work_for_restaurant_id|staff-invite)')
ORDER BY n.nspname, p.proname, identity_arguments;

SELECT 'table' AS kind, c.relname AS object_name,
       jsonb_build_object('rls',c.relrowsecurity,'forced',c.relforcerowsecurity,
         'authenticated_select',has_table_privilege('authenticated',c.oid,'SELECT'),
         'authenticated_update',has_table_privilege('authenticated',c.oid,'UPDATE')) AS details
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('users','restaurants')
UNION ALL
SELECT 'constraint', con.conname,
       jsonb_build_object('table',con.conrelid::regclass::text,'definition',pg_get_constraintdef(con.oid))
FROM pg_constraint con
WHERE con.conrelid IN ('public.users'::regclass,'public.restaurants'::regclass)
UNION ALL
SELECT 'policy',policyname,
       jsonb_build_object('table',tablename,'roles',roles,'command',cmd,'using',qual,'check',with_check)
FROM pg_policies WHERE schemaname='public' AND tablename IN ('users','restaurants')
UNION ALL
SELECT 'trigger',t.tgname,
       jsonb_build_object('table',t.tgrelid::regclass::text,'enabled',t.tgenabled,
         'definition',pg_get_triggerdef(t.oid),'function',t.tgfoid::regprocedure::text,
         'function_definition',pg_get_functiondef(t.tgfoid))
FROM pg_trigger t
WHERE NOT t.tgisinternal AND t.tgrelid IN ('public.users'::regclass,'public.restaurants'::regclass)
ORDER BY kind, object_name;

SELECT table_schema,table_name,column_name,data_type,udt_name,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND ((table_name='users' AND column_name IN ('id','role','status','work_for_restaurant_id','updated_at'))
    OR (table_name='restaurants' AND column_name IN ('id','owner_id','status','operating_status')))
ORDER BY table_name,ordinal_position;

SELECT n.nspname AS schema_name,t.typname,e.enumlabel,e.enumsortorder
FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
JOIN pg_namespace n ON n.oid=t.typnamespace
WHERE n.nspname='public' AND t.typname='user_role'
ORDER BY e.enumsortorder;
