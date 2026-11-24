BEGIN;

CREATE FUNCTION public.leave_staff_restaurant(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  changed_id uuid;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- One atomic row update. PostgreSQL rechecks these predicates after waiting
  -- on a concurrent row writer, so a stale request for A cannot leave B.
  UPDATE public.users
  SET role = 'student',
      work_for_restaurant_id = NULL,
      updated_at = pg_catalog.clock_timestamp()
  WHERE id = actor
    AND status = 'active'
    AND role = 'staff'
    AND work_for_restaurant_id = p_restaurant_id
  RETURNING id INTO changed_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_LEAVE_CONFLICT';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'id', changed_id, 'role', 'student', 'work_for_restaurant_id', NULL::uuid
  );
END;
$function$;

ALTER FUNCTION public.leave_staff_restaurant(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.leave_staff_restaurant(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_staff_restaurant(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
