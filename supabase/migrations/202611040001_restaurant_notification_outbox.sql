-- Chạy một lần trên Supabase SQL Editor trước khi deploy worker.
-- Chỉ trigger enqueue; tuyệt đối không gọi HTTP/FCM trong transaction checkout.
BEGIN;
CREATE TABLE public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  expanded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes'
);
CREATE INDEX notification_outbox_pending ON public.notification_outbox(created_at,id) WHERE NOT expanded;
CREATE INDEX IF NOT EXISTS users_active_notification_restaurant ON public.users(work_for_restaurant_id)
  WHERE status='active' AND work_for_restaurant_id IS NOT NULL;
ALTER TABLE public.notifications ADD COLUMN outbox_event_id uuid REFERENCES public.notification_outbox(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX notifications_outbox_recipient ON public.notifications(outbox_event_id,user_id) WHERE outbox_event_id IS NOT NULL;

CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.notification_outbox(id) ON DELETE CASCADE,
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Không FK token: logout xóa token nhưng vẫn giữ kết quả delivery để audit/cleanup.
  registration_id uuid NOT NULL,
  token_updated_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','accepted','failed','expired','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_id uuid,
  locked_until timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id,registration_id)
);
CREATE INDEX notification_deliveries_due ON public.notification_deliveries(next_attempt_at,id) WHERE status='pending';
CREATE INDEX notification_deliveries_lease ON public.notification_deliveries(locked_until) WHERE status='processing';
CREATE INDEX notification_deliveries_event ON public.notification_deliveries(event_id);
-- Một slot toàn hệ thống, không dùng Map trong từng Vercel instance.
CREATE TABLE public.notification_worker_slot (
  id integer PRIMARY KEY CHECK(id=1), lease_id uuid, locked_until timestamptz,
  next_run_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.notification_worker_slot(id) VALUES(1);
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_worker_slot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_outbox,public.notification_deliveries,public.notification_worker_slot FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.notification_outbox,public.notification_deliveries,public.notification_worker_slot TO service_role;

CREATE FUNCTION public.enqueue_restaurant_order_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.order_status::text='pending' THEN
    INSERT INTO public.notification_outbox(order_id) VALUES(NEW.id) ON CONFLICT(order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER enqueue_restaurant_order_notification AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enqueue_restaurant_order_notification();
REVOKE ALL ON FUNCTION public.enqueue_restaurant_order_notification() FROM PUBLIC,anon,authenticated;

-- Claim + fanout trong một RPC ngắn. Commit xong worker mới gọi FCM.
CREATE FUNCTION public.claim_restaurant_notifications() RETURNS jsonb
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

  FOR v_event IN SELECT e.id,e.order_id,e.expires_at,o.restaurant_id,o.order_status
    FROM public.notification_outbox e JOIN public.orders o ON o.id=e.order_id
    WHERE NOT e.expanded ORDER BY e.created_at,e.id LIMIT 5 FOR UPDATE OF e SKIP LOCKED
  LOOP
    -- Inbox không phụ thuộc người dùng đã bật push hay chưa.
    INSERT INTO public.notifications(user_id,type,related_order_id,title,content,outbox_event_id)
    SELECT u.id,'restaurant_order_created',v_event.order_id,'Có đơn hàng mới',
      'Quán vừa nhận được đơn mới. Mở danh sách đơn hàng để kiểm tra.',v_event.id
    FROM public.users u JOIN public.restaurants r ON r.id=v_event.restaurant_id
    WHERE u.status='active' AND r.status='active'
      AND (u.id=r.owner_id OR (u.role::text='staff' AND u.work_for_restaurant_id=r.id))
    ON CONFLICT (outbox_event_id,user_id) WHERE outbox_event_id IS NOT NULL DO NOTHING;
    -- Chụp tập thiết bị ở lần fanout; thiết bị bật sau không nhận push đơn cũ.
    IF v_event.expires_at>now() AND v_event.order_status::text='pending' THEN
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
    WHERE t.id=candidate.registration_id AND t.user_id=candidate.user_id AND u.status='active' AND r.status='active'
      AND o.order_status::text='pending'
      AND (u.id=r.owner_id OR (u.role::text='staff' AND u.work_for_restaurant_id=r.id))) LIMIT 200);
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
      AND o.order_status::text='pending' AND r.status='active' AND u.status='active'
      AND (u.id=r.owner_id OR (u.role::text='staff' AND u.work_for_restaurant_id=r.id))
    ORDER BY d.next_attempt_at,d.id LIMIT 20 FOR UPDATE OF d SKIP LOCKED
  ), claimed AS (
    UPDATE public.notification_deliveries d SET status='processing',attempts=d.attempts+1,
      lease_id=v_lease,locked_until=now()+interval '120 seconds',updated_at=now(),token_updated_at=t.updated_at
    FROM candidates c,public.user_push_tokens t WHERE d.id=c.id AND t.id=d.registration_id
    RETURNING d.*
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'userId',d.user_id,'token',t.token,
    'notificationId',d.notification_id,'orderId',e.order_id,'title',n.title,'body',n.content,
    'ttl',greatest(1,least(60,extract(epoch FROM (e.expires_at-now()))::integer)))), '[]'::jsonb)
  INTO v_jobs FROM claimed d JOIN public.user_push_tokens t ON t.id=d.registration_id
    JOIN public.notification_outbox e ON e.id=d.event_id JOIN public.notifications n ON n.id=d.notification_id;
  RETURN jsonb_build_object('busy',false,'leaseId',v_lease,'jobs',v_jobs);
END; $$;

-- Ack batch có fencing: worker đã mất lease không thể sửa kết quả của worker mới.
CREATE FUNCTION public.finish_restaurant_notifications(p_lease_id uuid,p_results jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb; v_delivery public.notification_deliveries%ROWTYPE; v_code text;
BEGIN
  PERFORM 1 FROM public.notification_worker_slot WHERE id=1 AND lease_id=p_lease_id AND locked_until>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOTIFICATION_LEASE_LOST'; END IF;
  IF jsonb_typeof(p_results) IS DISTINCT FROM 'array' OR jsonb_array_length(p_results)>20 THEN RAISE EXCEPTION 'INVALID_RESULTS'; END IF;
  FOR v_result IN SELECT value FROM jsonb_array_elements(p_results) LOOP
    SELECT * INTO v_delivery FROM public.notification_deliveries WHERE id=(v_result->>'id')::uuid
      AND status='processing' AND lease_id=p_lease_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    v_code:=left(coalesce(v_result->>'code','UNKNOWN'),120);
    UPDATE public.notification_deliveries SET
      status=CASE WHEN v_result->>'outcome'='accepted' THEN 'accepted'
        WHEN v_result->>'outcome'='retry' AND attempts<4 THEN 'pending' ELSE 'failed' END,
      -- Backoff 60/120/240s + jitter. Cron mỗi phút nên đây là thời điểm sớm nhất, không phải deadline.
      next_attempt_at=now()+make_interval(secs => 60*power(2,least(attempts-1,3)) + 0.1 + random()*0.4),
      last_error=CASE WHEN v_result->>'outcome'='accepted' THEN NULL ELSE v_code END,
      lease_id=NULL,locked_until=NULL,updated_at=now() WHERE id=v_delivery.id;
    IF v_code IN ('messaging/registration-token-not-registered','messaging/invalid-registration-token') THEN
      DELETE FROM public.user_push_tokens WHERE id=v_delivery.registration_id AND user_id=v_delivery.user_id
        AND updated_at=v_delivery.token_updated_at;
    END IF;
  END LOOP;
  -- Các kết quả thiếu vẫn processing để recovery bằng lease; không âm thầm đánh dấu success.
  UPDATE public.notification_worker_slot SET locked_until=NULL,lease_id=NULL WHERE id=1 AND lease_id=p_lease_id;
  -- Dọn tối đa 100 event hoàn tất sau 2 ngày; inbox giữ nguyên, FK được SET NULL.
  DELETE FROM public.notification_outbox WHERE id IN (
    SELECT e.id FROM public.notification_outbox e WHERE e.expanded AND e.created_at<now()-interval '2 days'
      AND NOT EXISTS(SELECT 1 FROM public.notification_deliveries d WHERE d.event_id=e.id AND d.status IN ('pending','processing'))
    ORDER BY e.created_at LIMIT 100);
END; $$;
REVOKE ALL ON FUNCTION public.claim_restaurant_notifications() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_restaurant_notifications(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_restaurant_notifications() TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_restaurant_notifications(uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
