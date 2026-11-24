-- Run once in SQL Editor before using the updated cart client.
-- Existing grouped JSON is compacted; malformed/legacy flat JSON aborts the transaction.
BEGIN;
CREATE OR REPLACE FUNCTION public.compact_cart_selected_options()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  g jsonb;
  o jsonb;
  groups jsonb := '[]'::jsonb;
  choices jsonb;
BEGIN
  IF NEW.selected_options IS NULL THEN NEW.selected_options := '[]'::jsonb; END IF;
  IF jsonb_typeof(NEW.selected_options) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'INVALID_SELECTED_OPTIONS';
  END IF;
  FOR g IN SELECT value FROM jsonb_array_elements(NEW.selected_options) ORDER BY value->>'group_id' LOOP
    IF jsonb_typeof(g) IS DISTINCT FROM 'object' OR nullif(g->>'group_id','') IS NULL
      OR jsonb_typeof(g->'options') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'INVALID_SELECTED_OPTIONS';
    END IF;
    choices := '[]'::jsonb;
    FOR o IN SELECT value FROM jsonb_array_elements(g->'options') ORDER BY value->>'id' LOOP
      IF jsonb_typeof(o) IS DISTINCT FROM 'object' OR nullif(o->>'id','') IS NULL THEN
        RAISE EXCEPTION 'INVALID_SELECTED_OPTIONS';
      END IF;
      choices := choices || jsonb_build_array(jsonb_build_object('id',(o->>'id')::uuid));
    END LOOP;
    groups := groups || jsonb_build_array(jsonb_build_object('group_id',(g->>'group_id')::uuid,'options',choices));
  END LOOP;
  NEW.selected_options := groups;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS compact_cart_selected_options ON public.cart_items;
CREATE TRIGGER compact_cart_selected_options BEFORE INSERT OR UPDATE OF selected_options
  ON public.cart_items FOR EACH ROW EXECUTE FUNCTION public.compact_cart_selected_options();
UPDATE public.cart_items SET selected_options = selected_options;
COMMIT;
