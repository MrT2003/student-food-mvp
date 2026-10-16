-- Merged RPC: grouped cart options, per-restaurant preferences, expected prices.
-- total_price = base + options PER UNIT; line amount = total_price * quantity.
-- Existing RPCs are not removed. Switch callers to this new name and payload.
BEGIN;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS total_price numeric;
COMMENT ON COLUMN public.order_items.total_price IS
  'Snapshot price per unit including options; line amount = total_price * quantity. Historical rows may be NULL.';
CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_checkout_items jsonb,
  p_delivery_address text,
  p_restaurant_preferences jsonb,
  p_expected_total numeric,
  p_checkout_session_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_session uuid := coalesce(p_checkout_session_id, gen_random_uuid());
  v_request jsonb;
  v_preference jsonb;
  v_cart_id uuid;
  v_group jsonb;
  v_choice jsonb;
  v_cart public.cart_items%ROWTYPE;
  v_menu public.menu_items%ROWTYPE;
  v_restaurant public.restaurants%ROWTYPE;
  v_option public.menu_item_options%ROWTYPE;
  v_option_group public.menu_item_option_groups%ROWTYPE;
  v_group_ids uuid[];
  v_option_ids uuid[];
  v_group_id uuid;
  v_option_id uuid;
  v_quantity integer;
  v_expected numeric;
  v_unit numeric;
  v_total numeric := 0;
  v_subtotal numeric;
  v_snapshot jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_restaurant_id uuid;
  v_order_id uuid;
  v_order_code text;
  v_orders jsonb := '[]'::jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  -- Serializes checkout requests from this user, including multiple tabs.
  PERFORM pg_advisory_xact_lock(hashtextextended('checkout:' || v_user::text, 0));
  PERFORM 1 FROM public.users WHERE id=v_user AND role IN ('student','staff') AND status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_ALLOWED'; END IF;
  IF nullif(btrim(p_delivery_address), '') IS NULL THEN RAISE EXCEPTION 'ADDRESS_REQUIRED'; END IF;
  IF jsonb_typeof(p_restaurant_preferences) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'RESTAURANT_PREFERENCES_INVALID';
  END IF;
  FOR v_preference IN SELECT value FROM jsonb_array_elements(p_restaurant_preferences) LOOP
    IF jsonb_typeof(v_preference) IS DISTINCT FROM 'object'
      OR coalesce(v_preference->>'restaurant_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR coalesce(v_preference->>'payment_method','') NOT IN ('cash','bank_transfer') THEN
      RAISE EXCEPTION 'RESTAURANT_PREFERENCE_INVALID';
    END IF;
    IF v_preference ? 'customer_notes' AND jsonb_typeof(v_preference->'customer_notes') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'CUSTOMER_NOTES_INVALID';
    END IF;
  END LOOP;
  IF (SELECT count(DISTINCT (value->>'restaurant_id')::uuid) FROM jsonb_array_elements(p_restaurant_preferences))
      <> jsonb_array_length(p_restaurant_preferences) THEN
    RAISE EXCEPTION 'DUPLICATE_RESTAURANT_PREFERENCE';
  END IF;
  IF p_expected_total IS NULL OR p_expected_total < 0 OR p_expected_total::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'EXPECTED_TOTAL_REQUIRED';
  END IF;
  IF jsonb_typeof(p_checkout_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_CHECKOUT_ITEMS'; END IF;
  IF jsonb_array_length(p_checkout_items)=0 THEN RAISE EXCEPTION 'EMPTY_CHECKOUT_ITEMS'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE session_checkout_id=v_session) THEN
    RAISE EXCEPTION 'CHECKOUT_SESSION_ALREADY_USED';
  END IF;
  -- Validate before taking cart/catalog locks; reject duplicate cart IDs.
  FOR v_request IN SELECT value FROM jsonb_array_elements(p_checkout_items) LOOP
    IF jsonb_typeof(v_request) IS DISTINCT FROM 'object'
      OR coalesce(v_request->>'cart_item_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR coalesce(v_request->>'quantity','') !~ '^[1-9][0-9]*$'
      OR jsonb_typeof(v_request->'expected_unit_price') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'INVALID_CHECKOUT_ITEM';
    END IF;
    IF (v_request->>'expected_unit_price')::numeric < 0 THEN RAISE EXCEPTION 'INVALID_EXPECTED_PRICE'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT (value->>'cart_item_id')::uuid) FROM jsonb_array_elements(p_checkout_items))
      <> jsonb_array_length(p_checkout_items) THEN RAISE EXCEPTION 'DUPLICATE_CART_ITEM'; END IF;

  SELECT id INTO v_cart_id FROM public.carts WHERE student_id=v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CART_NOT_FOUND'; END IF;

  -- Freeze selected cart rows against quantity/options updates until commit.
  PERFORM ci.id FROM public.cart_items ci JOIN public.carts c ON c.id=ci.cart_id
    WHERE c.student_id=v_user AND ci.id IN (
      SELECT (value->>'cart_item_id')::uuid FROM jsonb_array_elements(p_checkout_items)
    ) ORDER BY ci.id FOR UPDATE OF ci;

  FOR v_request IN SELECT value FROM jsonb_array_elements(p_checkout_items) ORDER BY value->>'cart_item_id' LOOP
    SELECT ci.* INTO v_cart FROM public.cart_items ci JOIN public.carts c ON c.id=ci.cart_id
      WHERE ci.id=(v_request->>'cart_item_id')::uuid AND c.student_id=v_user;
    IF NOT FOUND THEN RAISE EXCEPTION 'SOME_ITEMS_NOT_FOUND_OR_INVALID_OWNER'; END IF;
    v_quantity := (v_request->>'quantity')::integer;
    IF v_cart.quantity IS NULL OR v_quantity > v_cart.quantity THEN RAISE EXCEPTION 'INVALID_QUANTITY_TO_BUY'; END IF;

    SELECT * INTO v_restaurant FROM public.restaurants WHERE id=v_cart.restaurant_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'RESTAURANT_UNAVAILABLE'; END IF;
    IF v_restaurant.status IS DISTINCT FROM 'active' OR v_restaurant.operating_status IS DISTINCT FROM 'open' THEN
      RAISE EXCEPTION 'RESTAURANT_UNAVAILABLE';
    END IF;
    SELECT * INTO v_menu FROM public.menu_items
      WHERE id=v_cart.menu_item_id AND restaurant_id=v_cart.restaurant_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MENU_ITEM_UNAVAILABLE'; END IF;
    IF v_menu.is_active IS NOT TRUE OR v_menu.is_available IS NOT TRUE THEN RAISE EXCEPTION 'MENU_ITEM_UNAVAILABLE'; END IF;
    IF v_menu.price IS NULL OR v_menu.price < 0 OR v_menu.price::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION 'INVALID_CATALOG_PRICE';
    END IF;
    -- Protect current option/group prices and flags while validating and building snapshots.
    PERFORM id FROM public.menu_item_option_groups WHERE menu_item_id=v_menu.id ORDER BY id FOR SHARE;
    PERFORM o.id FROM public.menu_item_options o JOIN public.menu_item_option_groups g ON g.id=o.group_id
      WHERE g.menu_item_id=v_menu.id ORDER BY o.id FOR SHARE OF o;

    v_unit := v_menu.price;
    v_snapshot := '[]'::jsonb;
    v_group_ids := ARRAY[]::uuid[];
    v_option_ids := ARRAY[]::uuid[];
    IF jsonb_typeof(coalesce(v_cart.selected_options,'[]'::jsonb)) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'INVALID_SELECTED_OPTIONS';
    END IF;
    FOR v_group IN SELECT value FROM jsonb_array_elements(coalesce(v_cart.selected_options,'[]'::jsonb)) ORDER BY value->>'group_id' LOOP
      IF jsonb_typeof(v_group) IS DISTINCT FROM 'object' OR nullif(v_group->>'group_id','') IS NULL
        OR jsonb_typeof(v_group->'options') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_SELECTED_OPTIONS'; END IF;
      v_group_id := (v_group->>'group_id')::uuid;
      IF v_group_id=ANY(v_group_ids) THEN RAISE EXCEPTION 'DUPLICATE_OPTION_GROUP'; END IF;
      v_group_ids := array_append(v_group_ids,v_group_id);
      SELECT * INTO v_option_group FROM public.menu_item_option_groups WHERE id=v_group_id AND menu_item_id=v_menu.id;
      IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_OPTION_GROUP'; END IF;
      IF v_option_group.is_active IS NOT TRUE THEN RAISE EXCEPTION 'OPTION_UNAVAILABLE'; END IF;
      IF (v_option_group.is_required AND jsonb_array_length(v_group->'options')=0)
        OR (NOT v_option_group.is_multiple AND jsonb_array_length(v_group->'options')>1) THEN
        RAISE EXCEPTION 'INVALID_OPTION_SELECTION';
      END IF;
      FOR v_choice IN SELECT value FROM jsonb_array_elements(v_group->'options') ORDER BY value->>'id' LOOP
        IF jsonb_typeof(v_choice) IS DISTINCT FROM 'object' OR nullif(v_choice->>'id','') IS NULL THEN
          RAISE EXCEPTION 'INVALID_SELECTED_OPTIONS';
        END IF;
        v_option_id := (v_choice->>'id')::uuid;
        IF v_option_id=ANY(v_option_ids) THEN RAISE EXCEPTION 'DUPLICATE_OPTION'; END IF;
        v_option_ids := array_append(v_option_ids,v_option_id);
        SELECT * INTO v_option FROM public.menu_item_options WHERE id=v_option_id AND group_id=v_group_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_OPTION'; END IF;
        IF v_option.is_active IS NOT TRUE THEN RAISE EXCEPTION 'OPTION_UNAVAILABLE'; END IF;
        IF v_option.additional_price IS NULL OR v_option.additional_price < 0
          OR v_option.additional_price::text IN ('NaN','Infinity','-Infinity') THEN
          RAISE EXCEPTION 'INVALID_CATALOG_PRICE';
        END IF;
        v_unit := v_unit + v_option.additional_price;
        v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
          'option_id',v_option.id,'group_name',v_option_group.name,
          'option_name',v_option.option_name,'additional_price',v_option.additional_price));
      END LOOP;
    END LOOP;
    IF EXISTS (SELECT 1 FROM public.menu_item_option_groups WHERE menu_item_id=v_menu.id
      AND is_active AND is_required AND NOT (id=ANY(v_group_ids))) THEN RAISE EXCEPTION 'REQUIRED_OPTION_MISSING'; END IF;
    v_expected := (v_request->>'expected_unit_price')::numeric;
    IF v_unit <> v_expected THEN
      RAISE EXCEPTION 'PRICE_MISMATCH: cart_item %, expected %, current %', v_cart.id,v_expected,v_unit;
    END IF;
    v_total := v_total + v_unit*v_quantity;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'cart_item_id',v_cart.id,'restaurant_id',v_cart.restaurant_id,'menu_item_id',v_menu.id,
      'name',v_menu.name,'image_url',v_menu.image_url,'base_price',v_menu.price,
      'unit_price',v_unit,'quantity',v_quantity,'options',v_snapshot));
  END LOOP;
  IF v_total <> p_expected_total THEN
    RAISE EXCEPTION 'PRICE_MISMATCH: expected total %, current %',p_expected_total,v_total;
  END IF;

  -- Match preferences to purchased restaurants, not all restaurants in the cart.
  IF (SELECT count(DISTINCT (value->>'restaurant_id')::uuid) FROM jsonb_array_elements(v_lines))
       <> jsonb_array_length(p_restaurant_preferences)
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_restaurant_preferences) p
      WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_lines) l
        WHERE (l.value->>'restaurant_id')::uuid=(p.value->>'restaurant_id')::uuid)
    ) THEN RAISE EXCEPTION 'RESTAURANT_PREFERENCES_MISMATCH'; END IF;

  -- Write only AFTER every row has passed validation. Reuse the same snapshots used for pricing.
  FOR v_restaurant_id IN SELECT DISTINCT (value->>'restaurant_id')::uuid FROM jsonb_array_elements(v_lines) ORDER BY 1 LOOP
    SELECT sum((value->>'unit_price')::numeric*(value->>'quantity')::integer) INTO v_subtotal
      FROM jsonb_array_elements(v_lines) WHERE (value->>'restaurant_id')::uuid=v_restaurant_id;
    SELECT value INTO v_preference FROM jsonb_array_elements(p_restaurant_preferences)
      WHERE (value->>'restaurant_id')::uuid=v_restaurant_id;
    v_order_code := 'ORD-' || replace(gen_random_uuid()::text,'-','');
    INSERT INTO public.orders(session_checkout_id,order_code,student_id,restaurant_id,order_status,
      payment_method,subtotal,total,delivery_address,customer_notes)
    VALUES(v_session,v_order_code,v_user,v_restaurant_id,'pending',(v_preference->>'payment_method')::public.payment_method_type,
      v_subtotal,v_subtotal,btrim(p_delivery_address),nullif(btrim(coalesce(v_preference->>'customer_notes','')),'')) RETURNING id INTO v_order_id;
    FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) WHERE (value->>'restaurant_id')::uuid=v_restaurant_id LOOP
      INSERT INTO public.order_items(order_id,menu_item_id,image_url,item_name_snapshot,unit_price_snapshot,total_price,quantity,option_snapshot_price)
      VALUES(v_order_id,(v_line->>'menu_item_id')::uuid,v_line->>'image_url',v_line->>'name',
        (v_line->>'base_price')::numeric,(v_line->>'unit_price')::numeric,(v_line->>'quantity')::integer,v_line->'options');
      -- Base price snapshot excludes options; option_snapshot_price holds option prices.
      DELETE FROM public.cart_items WHERE id=(v_line->>'cart_item_id')::uuid AND quantity=(v_line->>'quantity')::integer;
      IF NOT FOUND THEN
        UPDATE public.cart_items SET quantity=quantity-(v_line->>'quantity')::integer,updated_at=now()
          WHERE id=(v_line->>'cart_item_id')::uuid;
      END IF;
    END LOOP;
    v_orders := v_orders || jsonb_build_array(jsonb_build_object('orderId',v_order_id,'orderCode',v_order_code,
      'restaurantId',v_restaurant_id,'subtotal',v_subtotal,'total',v_subtotal));
  END LOOP;
  RETURN jsonb_build_object('sessionCheckoutId',v_session,'orders',v_orders);
END;
$$;
REVOKE ALL ON FUNCTION public.create_checkout_order(jsonb,text,jsonb,numeric,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(jsonb,text,jsonb,numeric,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
