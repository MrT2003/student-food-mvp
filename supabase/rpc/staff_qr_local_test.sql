-- LOCAL DISPOSABLE SUPABASE TEST DATABASE ONLY; NOT production.
-- psql -v ON_ERROR_STOP=1 -v actor_uuid=... -v seller_uuid=... -v restaurant_uuid=... -f ...
-- Provision test Auth accounts via supported Auth admin API first, then test seller/restaurant.
-- Never use real identities. Vault key must be test-only and never printed.
BEGIN;
SET LOCAL staff_test.actor = :'actor_uuid';
SET LOCAL staff_test.seller = :'seller_uuid';
SET LOCAL staff_test.restaurant = :'restaurant_uuid';
DO $$
DECLARE
  actor uuid:=current_setting('staff_test.actor')::uuid;
  seller uuid:=current_setting('staff_test.seller')::uuid;
  restaurant uuid:=current_setting('staff_test.restaurant')::uuid;
  issued_at bigint:=floor(extract(epoch FROM clock_timestamp()))::bigint;
  payload text; token text; key text; reply jsonb; before_time timestamptz; after_time timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=actor AND role='student' AND status='active' AND work_for_restaurant_id IS NULL)
     OR NOT EXISTS (SELECT 1 FROM public.restaurants r JOIN public.users u ON u.id=r.owner_id
                     WHERE r.id=restaurant AND u.id=seller AND u.role='seller' AND u.status='active') THEN
    RAISE EXCEPTION 'USE_DEDICATED_ELIGIBLE_TEST_FIXTURES';
  END IF;
  SELECT decrypted_secret INTO STRICT key FROM vault.decrypted_secrets WHERE name='staff_invitation_hmac_v1';
  payload:=translate(rtrim(replace(encode(convert_to(jsonb_build_object(
    'purpose','studentfood.staff-invite','version',1,'restaurantId',restaurant,'issuedBy',seller,
    'iat',issued_at,
    'exp',issued_at+300,
    'nonce',translate(rtrim(encode(extensions.gen_random_bytes(32),'base64'),'='),'+/','-_'))::text,'UTF8'),'base64'),E'\n',''),'='),'+/','-_');
  token:=payload||'.'||translate(rtrim(encode(extensions.hmac(convert_to('studentfood.staff-invite:v1:'||payload,'UTF8'),convert_to(key,'UTF8'),'sha256'),'base64'),'='),'+/','-_');
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  -- Real session-role privilege checks: SET ROLE changes current_user for invoker guards.
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.users SET role='staff',work_for_restaurant_id=restaurant WHERE id=actor;
    RAISE EXCEPTION 'TEST_FAILED_DIRECT_WRITE_ALLOWED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'STAFF_IDENTITY_SERVER_MANAGED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.restaurants SET owner_id=actor WHERE id=restaurant;
    RAISE EXCEPTION 'TEST_FAILED_OWNER_WRITE_ALLOWED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'RESTAURANT_OWNER_SERVER_MANAGED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.join_staff_qr(token||'x');
    RAISE EXCEPTION 'TEST_FAILED_TAMPER_ALLOWED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'INVALID_STAFF_TOKEN' THEN RAISE; END IF;
  END;
  reply:=public.join_staff_qr(token);
  IF reply->'profile'->>'id'<>actor::text OR reply->'profile'->>'role'<>'staff'
     OR reply->'profile'->>'work_for_restaurant_id'<>restaurant::text THEN RAISE EXCEPTION 'TEST_FAILED_RESPONSE'; END IF;
  SELECT updated_at INTO before_time FROM public.users WHERE id=actor;
  BEGIN
    PERFORM public.join_staff_qr(token);
    RAISE EXCEPTION 'TEST_FAILED_REPLAY_ALLOWED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'STAFF_MEMBERSHIP_CONFLICT' THEN RAISE; END IF;
  END;
  SELECT updated_at INTO after_time FROM public.users WHERE id=actor;
  IF after_time IS DISTINCT FROM before_time THEN RAISE EXCEPTION 'TEST_FAILED_REPLAY_TIMESTAMP'; END IF;
  RESET ROLE;
  RAISE NOTICE 'Local guard, signature, atomic assignment and replay checks passed; transaction will roll back.';
END $$;
ROLLBACK;
