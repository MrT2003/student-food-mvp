-- Read-only; run BEFORE review/apply and capture results without secret values.
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef,pg_get_userbyid(p.proowner) AS owner,pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f' AND
 (p.proname IN ('register_seller','update_my_profile','add_staff_by_phone','remove_staff','join_staff_qr','sf_guard_staff_identity')
  OR (p.prosecdef AND p.prosrc ~* '(users|restaurants|execute|vault|secret)'))
ORDER BY p.proname;
SELECT c.oid::regclass AS relation,c.relrowsecurity,c.relforcerowsecurity,
 has_table_privilege('authenticated',c.oid,'INSERT') AS client_insert,
 has_table_privilege('authenticated',c.oid,'UPDATE') AS client_update,
 has_table_privilege('authenticated',c.oid,'DELETE') AS client_delete,
 has_table_privilege('authenticated',c.oid,'TRUNCATE') AS client_truncate
FROM pg_class c WHERE c.oid IN ('public.users'::regclass,'public.restaurants'::regclass);
SELECT extname,extnamespace::regnamespace FROM pg_extension WHERE extname IN ('pgcrypto','supabase_vault');
-- Run only when vault exists. Returns readiness counts, never secret values/hashes.
SELECT count(*) AS matching_keys, bool_and(octet_length(decrypted_secret)>=32) AS minimum_length
FROM vault.decrypted_secrets WHERE name='staff_invitation_hmac_v1';
SELECT has_table_privilege('anon','vault.decrypted_secrets','SELECT') AS anon_can_read,
       has_table_privilege('authenticated','vault.decrypted_secrets','SELECT') AS client_can_read;
SELECT name,setting FROM pg_settings
WHERE name IN ('log_statement','log_parameter_max_length','log_parameter_max_length_on_error');
-- AFTER apply: definitions contain no key. Review same function output above as well.
SELECT p.oid::regprocedure AS function,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS client_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('join_staff_qr','sf_guard_staff_identity');
SELECT tgname,tgrelid::regclass,tgenabled,pg_get_triggerdef(oid)
FROM pg_trigger WHERE tgname IN ('sf_guard_staff_user','sf_guard_staff_owner');

SELECT p.oid::regprocedure AS vault_function,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS client_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='vault' AND p.proname IN ('create_secret','update_secret');
SELECT has_schema_privilege('anon','vault','USAGE') AS anon_vault_usage,
 has_schema_privilege('authenticated','vault','USAGE') AS client_vault_usage,
 has_table_privilege('authenticated','vault.secrets','INSERT,UPDATE,DELETE') AS client_secret_mutation;
