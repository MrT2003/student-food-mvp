-- REVIEW ONLY. Requires postgres, existing private Supabase Vault + pgcrypto in extensions.
-- Provision the named secret through Vault UI BEFORE this migration; never paste its value here.
BEGIN;
DO $$
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'REVIEW_REQUIRES_POSTGRES'; END IF;
  IF pg_has_role('anon','postgres','MEMBER') OR pg_has_role('authenticated','postgres','MEMBER')
     OR has_table_privilege('anon','public.users','TRUNCATE')
     OR has_table_privilege('authenticated','public.users','TRUNCATE') THEN
    RAISE EXCEPTION 'UNSAFE_CLIENT_ROLE_PRIVILEGES_REVIEW_REQUIRED';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('register_seller','update_my_profile','add_staff_by_phone','remove_staff')
      AND (NOT p.prosecdef OR pg_get_userbyid(p.proowner) IN ('anon','authenticated'))) THEN
    RAISE EXCEPTION 'EXISTING_RPC_TRUST_BOUNDARY_REVIEW_REQUIRED';
  END IF;
  IF to_regprocedure('public.join_staff_qr(text)') IS NOT NULL
     OR to_regprocedure('public.sf_guard_staff_identity()') IS NOT NULL THEN
    RAISE EXCEPTION 'OBJECT_ALREADY_EXISTS_REVIEW_REQUIRED';
  END IF;
  IF to_regclass('vault.decrypted_secrets') IS NULL
     OR to_regprocedure('extensions.hmac(bytea,bytea,text)') IS NULL THEN
    RAISE EXCEPTION 'VAULT_OR_PGCRYPTO_PREREQUISITE_MISSING';
  END IF;
  IF has_schema_privilege('anon','vault','USAGE')
     OR has_schema_privilege('authenticated','vault','USAGE')
     OR has_table_privilege('anon','vault.decrypted_secrets','SELECT')
     OR has_table_privilege('authenticated','vault.decrypted_secrets','SELECT') THEN
    RAISE EXCEPTION 'VAULT_MUST_NOT_BE_CLIENT_READABLE';
  END IF;
  IF has_table_privilege('anon','vault.secrets','INSERT,UPDATE,DELETE')
     OR has_table_privilege('authenticated','vault.secrets','INSERT,UPDATE,DELETE')
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='vault' AND p.proname IN ('create_secret','update_secret')
         AND ((has_schema_privilege('anon','vault','USAGE') AND has_function_privilege('anon',p.oid,'EXECUTE'))
           OR (has_schema_privilege('authenticated','vault','USAGE') AND has_function_privilege('authenticated',p.oid,'EXECUTE')))) THEN
    RAISE EXCEPTION 'VAULT_MUST_NOT_BE_CLIENT_WRITABLE';
  END IF;
  IF (SELECT count(*) FROM vault.decrypted_secrets WHERE name='staff_invitation_hmac_v1') <> 1 THEN
    RAISE EXCEPTION 'STAFF_TOKEN_CONFIGURATION_MISSING';
  END IF;
END $$;

-- Invoker trigger: current_user remains the actual executing DB role, not JWT role.
-- Never trust a client-settable GUC/claim/flag to bypass this guard.
CREATE FUNCTION public.sf_guard_staff_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF current_user IN ('anon','authenticated') THEN
    IF TG_TABLE_NAME='users' THEN
      -- Browser inserts/deletes could recreate inactive/privileged profiles.
      -- Existing repo profile creation is Auth-trigger/admin, not direct browser INSERT.
      IF TG_OP <> 'UPDATE' THEN RAISE EXCEPTION 'PROFILE_SERVER_MANAGED'; END IF;
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.role IS DISTINCT FROM OLD.role
         OR NEW.status IS DISTINCT FROM OLD.status
         OR NEW.work_for_restaurant_id IS DISTINCT FROM OLD.work_for_restaurant_id
         OR NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
        RAISE EXCEPTION 'STAFF_IDENTITY_SERVER_MANAGED';
      END IF;
    ELSE
      IF TG_OP='UPDATE' THEN
        IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.id IS DISTINCT FROM OLD.id THEN
          RAISE EXCEPTION 'RESTAURANT_OWNER_SERVER_MANAGED';
        END IF;
      END IF;
      IF TG_OP='INSERT' THEN
        IF auth.uid() IS NULL OR NEW.owner_id IS DISTINCT FROM auth.uid()
           OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id=auth.uid()
                           AND u.role='seller' AND u.status='active') THEN
          RAISE EXCEPTION 'RESTAURANT_OWNER_SERVER_MANAGED';
        END IF;
      END IF;
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
ALTER FUNCTION public.sf_guard_staff_identity() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sf_guard_staff_identity() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER sf_guard_staff_user BEFORE INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sf_guard_staff_identity();
CREATE TRIGGER sf_guard_staff_owner BEFORE INSERT OR UPDATE ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.sf_guard_staff_identity();

CREATE FUNCTION public.join_staff_qr(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_parts text[]; v_payload text; v_raw bytea; v_mac bytea; v_expected bytea;
  v_key text; v_diff integer := 0; v_i integer; v_claims jsonb;
  v_issuer uuid; v_restaurant uuid; v_iat bigint; v_exp bigint; v_now bigint;
  v_student public.users%rowtype; v_owner public.users%rowtype;
  v_owner_id uuid; v_rows integer;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  IF p_token IS NULL OR octet_length(p_token)>4096
     OR p_token !~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'INVALID_STAFF_TOKEN';
  END IF;
  SELECT count(*), min(decrypted_secret) INTO v_rows, v_key FROM vault.decrypted_secrets
    WHERE name='staff_invitation_hmac_v1';
  IF v_rows<>1 OR v_key IS NULL OR octet_length(v_key)<32
     OR v_key ~* 'REPLACE_WITH|CHANGE_ME|YOUR[_-]?(SECRET|KEY)|PLACEHOLDER|EXAMPLE[_-]?(SECRET|KEY)'
     OR (SELECT count(DISTINCT ch) FROM regexp_split_to_table(v_key,'') AS chars(ch)) < 8 THEN
    RAISE EXCEPTION 'STAFF_TOKEN_CONFIGURATION_MISSING';
  END IF;
  v_parts := string_to_array(p_token,'.'); v_payload := v_parts[1];
  BEGIN
    v_raw := decode(translate(v_payload,'-_','+/') || repeat('=',(4-length(v_payload)%4)%4),'base64');
    v_mac := decode(translate(v_parts[2],'-_','+/') || repeat('=',(4-length(v_parts[2])%4)%4),'base64');
    IF translate(rtrim(replace(encode(v_raw,'base64'),E'\n',''),'='),'+/','-_') <> v_payload
       OR translate(rtrim(replace(encode(v_mac,'base64'),E'\n',''),'='),'+/','-_') <> v_parts[2]
       OR octet_length(v_mac) <> 32 THEN RAISE EXCEPTION 'INVALID_STAFF_TOKEN'; END IF;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'INVALID_STAFF_TOKEN'; END;
  v_expected := extensions.hmac(convert_to('studentfood.staff-invite:v1:' || v_payload,'UTF8'),convert_to(v_key,'UTF8'),'sha256');
  -- Fixed 32-byte comparison; no prefix comparison/early return on mismatching byte.
  FOR v_i IN 0..31 LOOP
    v_diff := v_diff | (get_byte(v_mac,v_i) # get_byte(v_expected,v_i));
  END LOOP;
  IF v_diff <> 0 THEN RAISE EXCEPTION 'INVALID_STAFF_TOKEN'; END IF;
  BEGIN
    v_claims := convert_from(v_raw,'UTF8')::jsonb;
    IF jsonb_typeof(v_claims) <> 'object' THEN RAISE EXCEPTION 'INVALID_STAFF_TOKEN'; END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(v_claims)) <> 7
       OR NOT (v_claims ?& ARRAY['purpose','version','restaurantId','issuedBy','iat','exp','nonce'])
       OR v_claims->>'purpose' IS DISTINCT FROM 'studentfood.staff-invite'
       OR v_claims->'version' IS DISTINCT FROM '1'::jsonb
       OR jsonb_typeof(v_claims->'restaurantId') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_claims->'issuedBy') IS DISTINCT FROM 'string'
       OR (v_claims->>'restaurantId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR (v_claims->>'issuedBy') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR jsonb_typeof(v_claims->'nonce') IS DISTINCT FROM 'string'
       OR (v_claims->>'nonce') !~ '^[A-Za-z0-9_-]{43}$'
       OR jsonb_typeof(v_claims->'iat') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_claims->'exp') IS DISTINCT FROM 'number'
       OR (v_claims->>'iat') !~ '^(0|[1-9][0-9]*)$'
       OR (v_claims->>'exp') !~ '^(0|[1-9][0-9]*)$' THEN RAISE EXCEPTION 'INVALID_STAFF_TOKEN'; END IF;
    v_issuer := (v_claims->>'issuedBy')::uuid; v_restaurant := (v_claims->>'restaurantId')::uuid;
    v_iat := (v_claims->>'iat')::bigint; v_exp := (v_claims->>'exp')::bigint;
    v_now := floor(extract(epoch FROM clock_timestamp()))::bigint;
    IF v_iat>9007199254740691 OR v_exp<>v_iat+300 OR v_iat>v_now THEN RAISE EXCEPTION 'INVALID_STAFF_TOKEN'; END IF;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'INVALID_STAFF_TOKEN'; END;
  IF v_exp<=v_now THEN RAISE EXCEPTION 'STAFF_TOKEN_EXPIRED'; END IF;

  -- All user rows in UUID order, THEN restaurant; stable across competing joins.
  PERFORM u.id FROM public.users u WHERE u.id IN (v_actor,v_issuer) ORDER BY u.id FOR UPDATE;
  SELECT * INTO v_student FROM public.users WHERE id=v_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  IF v_student.status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'ACCOUNT_INACTIVE'; END IF;
  IF v_student.work_for_restaurant_id IS NOT NULL THEN RAISE EXCEPTION 'STAFF_MEMBERSHIP_CONFLICT'; END IF;
  IF v_student.role IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'STAFF_ROLE_CONFLICT'; END IF;
  SELECT * INTO v_owner FROM public.users WHERE id=v_issuer;
  IF NOT FOUND OR v_owner.role IS DISTINCT FROM 'seller' OR v_owner.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'ISSUER_NOT_ALLOWED';
  END IF;
  SELECT owner_id INTO v_owner_id FROM public.restaurants WHERE id=v_restaurant FOR UPDATE;
  IF NOT FOUND OR v_owner_id IS DISTINCT FROM v_issuer THEN RAISE EXCEPTION 'RESTAURANT_NOT_FOUND'; END IF;
  -- clock_timestamp(), not transaction-start now(): check AFTER waiting on all locks.
  IF v_exp<=floor(extract(epoch FROM clock_timestamp()))::bigint THEN RAISE EXCEPTION 'STAFF_TOKEN_EXPIRED'; END IF;
  UPDATE public.users SET role='staff',work_for_restaurant_id=v_restaurant,updated_at=clock_timestamp()
    WHERE id=v_actor AND role='student' AND status='active' AND work_for_restaurant_id IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows<>1 THEN RAISE EXCEPTION 'STAFF_ROLE_CONFLICT'; END IF;
  RETURN jsonb_build_object('profile',jsonb_build_object('id',v_actor,'role','staff','work_for_restaurant_id',v_restaurant));
END $$;
ALTER FUNCTION public.join_staff_qr(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.join_staff_qr(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.join_staff_qr(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
