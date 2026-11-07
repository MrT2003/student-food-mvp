-- Chạy sau migration 202611040001; giữ nguyên dữ liệu và worker hiện có.
BEGIN;
ALTER TABLE public.notification_outbox ADD COLUMN event_type text NOT NULL DEFAULT 'restaurant_order_created'
  CHECK(event_type IN ('restaurant_order_created','order_accepted','order_rejected'));
ALTER TABLE public.notification_outbox DROP CONSTRAINT notification_outbox_order_id_key;
ALTER TABLE public.notification_outbox ADD CONSTRAINT notification_outbox_order_event_key UNIQUE(order_id,event_type);
CREATE OR REPLACE FUNCTION public.enqueue_restaurant_order_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.order_status::text='pending' THEN
    INSERT INTO public.notification_outbox(order_id) VALUES(NEW.id) ON CONFLICT(order_id,event_type) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
-- Chỉ chuyển pending sang accepted/rejected mới tạo event. Update lặp không gửi trùng.
CREATE FUNCTION public.enqueue_student_order_decision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF OLD.order_status::text='pending' AND NEW.order_status::text IN ('accepted','rejected') THEN
    INSERT INTO public.notification_outbox(order_id,event_type)
    VALUES(NEW.id,CASE NEW.order_status::text WHEN 'accepted' THEN 'order_accepted' ELSE 'order_rejected' END)
    ON CONFLICT(order_id,event_type) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER enqueue_student_order_decision AFTER UPDATE OF order_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enqueue_student_order_decision();
REVOKE ALL ON FUNCTION public.enqueue_student_order_decision() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.claim_restaurant_notifications() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_lease uuid:=gen_random_uuid(); v_event record; v_jobs jsonb;
BEGIN
  -- Không để nhiều request wake xếp hàng chờ row lock của slot.
  PERFORM 1 FROM public.notification_worker_slot WHERE id=1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN jsonb_build_object('busy',true,'jobs','[]'::jsonb); END IF;
  UPDATE public.notification_worker_slot SET lease_id=v_lease,locked_until=now()+interval '120 seconds',
    next_run_at=now()+interval '5 seconds'
  WHERE id=1 AND (locked_until IS NULL OR locked_until<=now()) AND next_run_at<=now();
  IF NOT FOUND THEN RETURN jsonb_build_object('busy',true,'jobs','[]'::jsonb); END IF;

  -- Thu hồi công việc của worker chết. Tối đa 4 attempts = lần đầu + 3 retry.
  UPDATE public.notification_deliveries SET status=CASE WHEN attempts>=4 THEN 'failed' ELSE 'pending' END,
    lease_id=NULL,locked_until=NULL,updated_at=now(),last_error='LEASE_EXPIRED'
  WHERE id IN (SELECT id FROM public.notification_deliveries WHERE status='processing' AND locked_until<=now()
    ORDER BY locked_until LIMIT 200);

  FOR v_event IN SELECT e.id,e.order_id,e.expires_at,o.restaurant_id,o.order_status,o.student_id,e.event_type
    FROM public.notification_outbox e JOIN public.orders o ON o.id=e.order_id
    WHERE NOT e.expanded ORDER BY e.created_at,e.id LIMIT 5 FOR UPDATE OF e SKIP LOCKED
  LOOP
    -- Đơn mới gửi quán; kết quả duyệt gửi đúng người đặt, không phụ thuộc quán mở/đóng.
    INSERT INTO public.notifications(user_id,type,related_order_id,title,content,outbox_event_id)
    SELECT u.id,v_event.event_type,v_event.order_id,
      CASE v_event.event_type WHEN 'order_accepted' THEN 'Đơn hàng đã được xác nhận'
        WHEN 'order_rejected' THEN 'Đơn hàng đã bị từ chối' ELSE 'Có đơn hàng mới' END,
      CASE v_event.event_type WHEN 'order_accepted' THEN 'Quán đã xác nhận đơn hàng của bạn. Mở đơn hàng để xem chi tiết.'
        WHEN 'order_rejected' THEN 'Quán đã từ chối đơn hàng của bạn. Mở đơn hàng để xem chi tiết.'
        ELSE 'Quán vừa nhận được đơn mới. Mở danh sách đơn hàng để kiểm tra.' END,v_event.id
    FROM public.users u JOIN public.restaurants r ON r.id=v_event.restaurant_id
    WHERE u.status='active' AND (
      (v_event.event_type='restaurant_order_created' AND r.status='active'
        AND (u.id=r.owner_id OR (u.role::text='staff' AND u.work_for_restaurant_id=r.id)))
      OR (v_event.event_type IN ('order_accepted','order_rejected') AND u.id=v_event.student_id))
    ON CONFLICT (outbox_event_id,user_id) WHERE outbox_event_id IS NOT NULL DO NOTHING;
    -- Chụp tập thiết bị ở lần fanout; thiết bị bật sau không nhận push đơn cũ.
    IF v_event.expires_at>now() AND (v_event.event_type<>'restaurant_order_created' OR v_event.order_status::text='pending') THEN
      INSERT INTO public.notification_deliveries(event_id,notification_id,user_id,registration_id)
      SELECT v_event.id,n.id,n.user_id,t.id FROM public.notifications n
      JOIN public.user_push_tokens t ON t.user_id=n.user_id WHERE n.outbox_event_id=v_event.id
      ON CONFLICT(event_id,registration_id) DO NOTHING;
    END IF;
    UPDATE public.notification_outbox SET expanded=true WHERE id=v_event.id;
  END LOOP;

  -- Không gửi thông tin quán cho staff đã rời quán hoặc token đã logout/đổi chủ.
  UPDATE public.notification_deliveries d SET status='cancelled',updated_at=now()
  WHERE d.id IN (SELECT candidate.id FROM public.notification_deliveries candidate
    WHERE candidate.status='pending' AND NOT EXISTS (
    SELECT 1 FROM public.user_push_tokens t JOIN public.users u ON u.id=t.user_id
    JOIN public.notification_outbox e ON e.id=candidate.event_id JOIN public.orders o ON o.id=e.order_id
    JOIN public.restaurants r ON r.id=o.restaurant_id
    WHERE t.id=candidate.registration_id AND t.user_id=candidate.user_id AND u.status='active'
      AND ((e.event_type='restaurant_order_created' AND o.order_status::text='pending' AND r.status='active' AND (u.id=r.owner_id OR (u.role::text='staff' AND u.work_for_restaurant_id=r.id))) OR (e.event_type IN ('order_accepted','order_rejected') AND u.id=o.student_id))) LIMIT 200);
  UPDATE public.notification_deliveries d SET status='expired',updated_at=now()
  WHERE d.id IN (SELECT candidate.id FROM public.notification_deliveries candidate
    JOIN public.notification_outbox e ON e.id=candidate.event_id
    WHERE candidate.status='pending' AND e.expires_at<=now() LIMIT 200);

  WITH candidates AS (
    SELECT d.id FROM public.notification_deliveries d
    JOIN public.notification_outbox e ON e.id=d.event_id JOIN public.orders o ON o.id=e.order_id
    JOIN public.restaurants r ON r.id=o.restaurant_id JOIN public.users u ON u.id=d.user_id
    JOIN public.user_push_tokens t ON t.id=d.registration_id AND t.user_id=d.user_id
    WHERE d.status='pending' AND d.next_attempt_at<=now() AND e.expires_at>now()
      AND u.status='active' AND ((e.event_type='restaurant_order_created' AND o.order_status::text='pending' AND r.status='active' AND (u.id=r.owner_id OR (u.role::text='staff' AND u.work_for_restaurant_id=r.id))) OR (e.event_type IN ('order_accepted','order_rejected') AND u.id=o.student_id))
    ORDER BY d.next_attempt_at,d.id LIMIT 20 FOR UPDATE OF d SKIP LOCKED
  ), claimed AS (
    UPDATE public.notification_deliveries d SET status='processing',attempts=d.attempts+1,
      lease_id=v_lease,locked_until=now()+interval '120 seconds',updated_at=now(),token_updated_at=t.updated_at
    FROM candidates c,public.user_push_tokens t WHERE d.id=c.id AND t.id=d.registration_id
    RETURNING d.*
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'userId',d.user_id,'token',t.token,
    'destination',CASE WHEN e.event_type='restaurant_order_created' THEN 'seller_orders' ELSE 'student_order' END,'notificationId',d.notification_id,'orderId',e.order_id,'title',n.title,'body',n.content,
    'ttl',greatest(1,least(60,extract(epoch FROM (e.expires_at-now()))::integer)))), '[]'::jsonb)
  INTO v_jobs FROM claimed d JOIN public.user_push_tokens t ON t.id=d.registration_id
    JOIN public.notification_outbox e ON e.id=d.event_id JOIN public.notifications n ON n.id=d.notification_id;
  RETURN jsonb_build_object('busy',false,'leaseId',v_lease,'jobs',v_jobs);
END; $$;

NOTIFY pgrst,'reload schema';
COMMIT;
