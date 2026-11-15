-- Upgrade only sf_manage_menu after 202611060001_seller_menu.sql.
-- Preserves signature, ACLs, OCC, transaction boundary and existing item slugs.
BEGIN;
CREATE OR REPLACE FUNCTION public.sf_manage_menu(
  p_restaurant_id uuid, p_item_id uuid, p_expected_updated_at timestamptz,
  p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  actor uuid := auth.uid(); item public.menu_items%ROWTYPE;
  g jsonb; o jsonb; gid uuid; oid uuid; item_id uuid;
  group_ids uuid[] := ARRAY[]::uuid[]; option_ids uuid[] := ARRAY[]::uuid[];
  all_ids uuid[] := ARRAY[]::uuid[]; names text[]; group_names text[] := ARRAY[]::text[];
  stamp timestamptz; toggle boolean; k text; label text; amount numeric;
  result jsonb; groups_json jsonb;
  gi integer := -1; oi integer; slug_base text;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  -- Checkout acquires user -> restaurant -> item -> groups -> options. Follow it.
  PERFORM 1 FROM public.users WHERE id=actor AND status='active' AND role='seller' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MENU_FORBIDDEN'; END IF;
  PERFORM 1 FROM public.restaurants WHERE id=p_restaurant_id AND owner_id=actor FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MENU_FORBIDDEN'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR octet_length(p_payload::text)>131072 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', 'payload', 'reason', 'INVALID_OBJECT')::text; END IF;
  toggle := p_item_id IS NOT NULL AND (SELECT count(*) FROM jsonb_object_keys(p_payload))=1
    AND (p_payload ? 'is_active' OR p_payload ? 'is_available');
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) key WHERE key NOT IN
    ('name','description','category','image_url','price','is_active','is_available','groups')) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', 'payload', 'reason', 'UNKNOWN_FIELD')::text; END IF;
  IF p_item_id IS NOT NULL THEN
    SELECT * INTO item FROM public.menu_items WHERE id=p_item_id AND restaurant_id=p_restaurant_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MENU_NOT_FOUND'; END IF;
    IF p_expected_updated_at IS NULL OR item.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'MENU_STALE'; END IF;
    item_id := item.id;
  ELSE
    IF p_expected_updated_at IS NOT NULL THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', 'expected_updated_at', 'reason', 'INVALID_TIMESTAMP')::text; END IF;
    item_id := gen_random_uuid();
  END IF;
  stamp := greatest(clock_timestamp(), coalesce(item.updated_at, '-infinity'::timestamptz) + interval '1 microsecond');
  IF toggle THEN
    k := CASE WHEN p_payload ? 'is_active' THEN 'is_active' ELSE 'is_available' END;
    IF jsonb_typeof(p_payload->k) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', k, 'reason', 'INVALID_BOOLEAN')::text; END IF;
    UPDATE public.menu_items SET
      is_active=CASE WHEN k='is_active' THEN (p_payload->>k)::boolean ELSE is_active END,
      is_available=CASE WHEN k='is_available' THEN (p_payload->>k)::boolean ELSE is_available END,
      updated_at=stamp WHERE id=item_id AND restaurant_id=p_restaurant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'MENU_NOT_FOUND'; END IF;
  ELSE
    IF NOT p_payload ?& ARRAY['name','description','category','image_url','price','is_active','is_available','groups'] THEN
      RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', 'payload', 'reason', 'INVALID_OBJECT')::text; END IF;
    FOREACH k IN ARRAY ARRAY['name','category'] LOOP
      IF jsonb_typeof(p_payload->k) IS DISTINCT FROM 'string' OR btrim(p_payload->>k)='' OR
        length(btrim(p_payload->>k))>CASE WHEN k='name' THEN 120 ELSE 80 END THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', k, 'reason', 'INVALID_TEXT')::text; END IF;
    END LOOP;
    FOREACH k IN ARRAY ARRAY['description','image_url'] LOOP
      IF jsonb_typeof(p_payload->k) NOT IN ('string','null') THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', k, 'reason', 'INVALID_TEXT')::text; END IF;
      IF jsonb_typeof(p_payload->k)='string' AND (btrim(p_payload->>k)='' OR length(btrim(p_payload->>k))>CASE WHEN k='description' THEN 160 ELSE 2048 END) THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', k, 'reason', 'INVALID_TEXT')::text; END IF;
    END LOOP;
    IF p_payload->>'image_url' IS NOT NULL AND (p_payload->>'image_url' !~ '^https://[^/@[:space:]]+([/:?#]|$)' OR p_payload->>'image_url' ~ '^https://[^/]*@') THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', 'image_url', 'reason', 'INVALID_URL')::text; END IF;
    IF jsonb_typeof(p_payload->'price') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', 'price', 'reason', 'INVALID_PRICE')::text; END IF;
    amount := (p_payload->>'price')::numeric;
    IF amount<0 OR amount>10000000 OR amount<>round(amount,2) THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', 'price', 'reason', 'INVALID_PRICE')::text; END IF;
    IF jsonb_typeof(p_payload->'is_active') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_payload->'is_available') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', 'is_active', 'reason', 'INVALID_FLAGS')::text; END IF;
    IF jsonb_typeof(p_payload->'groups') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', 'groups', 'reason', 'INVALID_GROUPS')::text; END IF;
    IF jsonb_array_length(p_payload->'groups')>20 THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', 'groups', 'reason', 'INVALID_GROUPS')::text; END IF;
    -- Lock existing descendants in stable UUID order before editing anything.
    PERFORM id FROM public.menu_item_option_groups WHERE menu_item_id=item_id ORDER BY id FOR UPDATE;
    PERFORM op.id FROM public.menu_item_options op JOIN public.menu_item_option_groups gr ON gr.id=op.group_id
      WHERE gr.menu_item_id=item_id ORDER BY op.id FOR UPDATE OF op;
    FOR g IN SELECT value FROM jsonb_array_elements(p_payload->'groups') LOOP
      gi := gi + 1;
      IF jsonb_typeof(g) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field',format('groups[%s]',gi),'reason','INVALID_OBJECT')::text;
      END IF;
      IF NOT g ?& ARRAY['id','name','is_active','is_multiple','is_required','options'] OR
        EXISTS(SELECT 1 FROM jsonb_object_keys(g) key WHERE key NOT IN ('id','name','is_active','is_multiple','is_required','options')) THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', format('groups[%s]',gi), 'reason', 'INVALID_OBJECT')::text; END IF;
      IF jsonb_typeof(g->'id') IS DISTINCT FROM 'string' OR coalesce(g->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', format('groups[%s].id',gi), 'reason', 'INVALID_UUID')::text; END IF;
      gid := (g->>'id')::uuid;
      IF gid=ANY(all_ids) THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', format('groups[%s].id',gi), 'reason', 'INVALID_UUID')::text; END IF;
      all_ids := array_append(all_ids,gid); group_ids := array_append(group_ids,gid);
      IF EXISTS(SELECT 1 FROM public.menu_item_option_groups WHERE id=gid AND menu_item_id<>item_id) THEN RAISE EXCEPTION 'MENU_FORBIDDEN'; END IF;
      IF jsonb_typeof(g->'name') IS DISTINCT FROM 'string' OR btrim(g->>'name')='' OR length(btrim(g->>'name'))>80 THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', format('groups[%s].name',gi), 'reason', 'INVALID_TEXT')::text; END IF;
      label:=lower(btrim(g->>'name'));
      IF label=ANY(group_names) THEN RAISE EXCEPTION 'MENU_NAME_CONFLICT'; END IF;
      group_names:=array_append(group_names,label);
      FOREACH k IN ARRAY ARRAY['is_active','is_multiple','is_required'] LOOP
        IF jsonb_typeof(g->k) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', format('groups[%s].%s',gi,k), 'reason', 'INVALID_BOOLEAN')::text; END IF;
      END LOOP;
      IF jsonb_typeof(g->'options') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', format('groups[%s].options',gi), 'reason', 'INVALID_OPTIONS')::text; END IF;
      IF jsonb_array_length(g->'options')>50 OR ((g->>'is_active')::boolean AND NOT EXISTS
        (SELECT 1 FROM jsonb_array_elements(g->'options') v WHERE v->'is_active'='true'::jsonb)) THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', format('groups[%s].options',gi), 'reason', 'INVALID_OPTIONS')::text; END IF;
      names:=ARRAY[]::text[];
      oi := -1;
      FOR o IN SELECT value FROM jsonb_array_elements(g->'options') LOOP
        oi := oi + 1;
        IF jsonb_typeof(o) IS DISTINCT FROM 'object' THEN
          RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field',format('groups[%s].options[%s]',gi,oi),'reason','INVALID_OBJECT')::text;
        END IF;
        IF NOT o ?& ARRAY['id','option_name','additional_price','is_active'] OR
          EXISTS(SELECT 1 FROM jsonb_object_keys(o) key WHERE key NOT IN ('id','option_name','additional_price','is_active')) THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', format('groups[%s].options[%s]',gi,oi), 'reason', 'INVALID_OBJECT')::text; END IF;
        IF jsonb_typeof(o->'id') IS DISTINCT FROM 'string' OR coalesce(o->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', format('groups[%s].options[%s].id',gi,oi), 'reason', 'INVALID_UUID')::text; END IF;
        oid:=(o->>'id')::uuid;
        IF oid=ANY(all_ids) THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', format('groups[%s].options[%s].id',gi,oi), 'reason', 'INVALID_UUID')::text; END IF;
        all_ids:=array_append(all_ids,oid); option_ids:=array_append(option_ids,oid);
        IF EXISTS(SELECT 1 FROM public.menu_item_options WHERE id=oid AND group_id<>gid) THEN RAISE EXCEPTION 'MENU_FORBIDDEN'; END IF;
        IF jsonb_typeof(o->'option_name') IS DISTINCT FROM 'string' OR btrim(o->>'option_name')='' OR length(btrim(o->>'option_name'))>80 OR jsonb_typeof(o->'is_active') IS DISTINCT FROM 'boolean' OR jsonb_typeof(o->'additional_price') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', format('groups[%s].options[%s]',gi,oi), 'reason', 'INVALID_OPTION')::text; END IF;
        label:=lower(btrim(o->>'option_name')); amount:=(o->>'additional_price')::numeric;
        IF label=ANY(names) THEN RAISE EXCEPTION 'MENU_NAME_CONFLICT'; END IF;
        names:=array_append(names,label);
        IF amount<0 OR amount>10000000 OR amount<>round(amount,2) THEN RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = jsonb_build_object('field', format('groups[%s].options[%s].additional_price',gi,oi), 'reason', 'INVALID_PRICE')::text; END IF;
      END LOOP;
    END LOOP;
    IF p_item_id IS NULL THEN
      -- Built-in Unicode normalization: no unaccent extension dependency.
      slug_base := lower(translate(normalize(btrim(p_payload->>'name'), NFD), U&'\0111\0110', 'dD'));
      slug_base := regexp_replace(slug_base, U&'[\0300-\036f]', '', 'g');
      slug_base := btrim(left(regexp_replace(slug_base, '[^a-z0-9]+', '-', 'g'), 80), '-');
      slug_base := coalesce(nullif(slug_base, ''), 'mon');
      INSERT INTO public.menu_items(id,restaurant_id,name,slug,price,is_active,is_available)
        VALUES(item_id,p_restaurant_id,btrim(p_payload->>'name'),slug_base||'-'||replace(item_id::text,'-',''),0,false,false) RETURNING * INTO item;
      -- New items get a readable prefix plus the full UUID. Updates keep existing URLs.
      -- Any collision fails the transaction; never retry an uncertain mutation.
    END IF;
    UPDATE public.menu_items SET name=btrim(p_payload->>'name'),description=btrim(p_payload->>'description'),
      category=btrim(p_payload->>'category'),image_url=btrim(p_payload->>'image_url'),price=(p_payload->>'price')::numeric,
      is_active=(p_payload->>'is_active')::boolean,is_available=(p_payload->>'is_available')::boolean,updated_at=stamp
      WHERE id=item_id AND restaurant_id=p_restaurant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'MENU_NOT_FOUND'; END IF;
    -- Omission means inactive, never physical deletion. Existing UUIDs stay attached.
    UPDATE public.menu_item_option_groups SET is_active=false,updated_at=stamp WHERE menu_item_id=item_id AND NOT(id=ANY(group_ids));
    FOR g IN SELECT value FROM jsonb_array_elements(p_payload->'groups') LOOP
      gid:=(g->>'id')::uuid;
      INSERT INTO public.menu_item_option_groups(id,menu_item_id,name,is_multiple,is_required,is_active,updated_at)
        VALUES(gid,item_id,btrim(g->>'name'),(g->>'is_multiple')::boolean,(g->>'is_required')::boolean,(g->>'is_active')::boolean,stamp)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,is_multiple=excluded.is_multiple,is_required=excluded.is_required,is_active=excluded.is_active,updated_at=stamp
        WHERE public.menu_item_option_groups.menu_item_id=item_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'MENU_FORBIDDEN'; END IF;
      UPDATE public.menu_item_options SET is_active=false,updated_at=stamp WHERE group_id=gid AND NOT(id=ANY(option_ids));
      FOR o IN SELECT value FROM jsonb_array_elements(g->'options') LOOP
        INSERT INTO public.menu_item_options(id,group_id,option_name,additional_price,is_active,updated_at)
          VALUES((o->>'id')::uuid,gid,btrim(o->>'option_name'),(o->>'additional_price')::numeric,(o->>'is_active')::boolean,stamp)
          ON CONFLICT(id) DO UPDATE SET option_name=excluded.option_name,additional_price=excluded.additional_price,is_active=excluded.is_active,updated_at=stamp
          WHERE public.menu_item_options.group_id=gid;
        IF NOT FOUND THEN RAISE EXCEPTION 'MENU_FORBIDDEN'; END IF;
      END LOOP;
    END LOOP;
    -- Immediate unique indexes include inactive names: duplicates/rename swaps fail
    -- and roll back everything; do not invent temporary names or resurrect old IDs.
  END IF;
  SELECT to_jsonb(m) INTO result FROM public.menu_items m WHERE id=item_id;
  SELECT coalesce(jsonb_agg(to_jsonb(gr)||jsonb_build_object('options',
    (SELECT coalesce(jsonb_agg(to_jsonb(op) ORDER BY op.id),'[]'::jsonb) FROM public.menu_item_options op WHERE op.group_id=gr.id)) ORDER BY gr.id),'[]'::jsonb)
    INTO groups_json FROM public.menu_item_option_groups gr WHERE gr.menu_item_id=item_id;
  RETURN jsonb_build_object('item',result||jsonb_build_object('option_groups',groups_json));
END;
$fn$;

NOTIFY pgrst, 'reload schema';
COMMIT;
