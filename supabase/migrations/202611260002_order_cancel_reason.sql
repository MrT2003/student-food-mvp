BEGIN;
-- Bổ sung cột lưu lý do sinh viên hủy đơn (tối đa 200 ký tự) để hiển thị cho chủ quán.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancel_reason text;

DROP FUNCTION IF EXISTS public.cancel_pending_order(uuid);

CREATE OR REPLACE FUNCTION public.cancel_pending_order(
  p_order_id uuid,
  p_cancel_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_reason text := nullif(left(btrim(coalesce(p_cancel_reason, '')), 200), '');
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id = v_user AND status = 'active') THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND student_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_order.order_status::text = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'order_status', 'cancelled');
  END IF;
  IF v_order.order_status::text <> 'pending' THEN RAISE EXCEPTION 'ORDER_INVALID_STATUS'; END IF;
  UPDATE public.orders
    SET order_status = 'cancelled',
        cancel_reason = v_reason
  WHERE id = p_order_id;
  INSERT INTO public.notification_outbox(order_id, event_type)
    VALUES(p_order_id, 'order_cancelled')
    ON CONFLICT(order_id, event_type) DO NOTHING;
  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'order_status', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_pending_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_pending_order(uuid, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
