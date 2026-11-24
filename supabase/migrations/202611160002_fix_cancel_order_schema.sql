-- Sửa RPC đã triển khai; orders không có updated_at. Không thay worker/trigger.
BEGIN;
CREATE OR REPLACE FUNCTION public.cancel_pending_order(p_order_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_order public.orders%ROWTYPE;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=v_user AND status='active') THEN
   RAISE EXCEPTION 'NOT_ALLOWED';
 END IF;
 -- Khóa cùng dòng với accept/reject. Sau khi chờ khóa phải kiểm tra trạng thái mới.
 SELECT * INTO v_order FROM public.orders WHERE id=p_order_id AND student_id=v_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 -- Retry sau mất response không tạo event lần hai.
 IF v_order.order_status::text='cancelled' THEN
   RETURN jsonb_build_object('success',true,'order_id',p_order_id,'order_status','cancelled');
 END IF;
 IF v_order.order_status::text<>'pending' THEN RAISE EXCEPTION 'ORDER_INVALID_STATUS'; END IF;
 UPDATE public.orders SET order_status='cancelled' WHERE id=p_order_id;
 INSERT INTO public.notification_outbox(order_id,event_type) VALUES(p_order_id,'order_cancelled')
 ON CONFLICT(order_id,event_type) DO NOTHING;
 RETURN jsonb_build_object('success',true,'order_id',p_order_id,'order_status','cancelled');
END; $$;
REVOKE ALL ON FUNCTION public.cancel_pending_order(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cancel_pending_order(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
