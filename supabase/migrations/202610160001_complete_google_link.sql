-- Chạy trước khi dùng code mới. Không tạo trigger trên auth.users.
BEGIN;
CREATE OR REPLACE FUNCTION public.complete_google_link(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_auth_email text;
  v_google_email text;
  v_zalo_id text;
  v_current_zalo text;
  v_owner uuid;
BEGIN
  -- UUID chỉ nhận từ server sau getUser/exchangeCodeForSession, không cấp RPC cho browser.
  SELECT email INTO v_auth_email FROM auth.users WHERE id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;

  -- Google phải thực sự liên kết và có email đã xác minh trước khi ghi bất kỳ dữ liệu nào.
  SELECT nullif(btrim(identity_data->>'email'),'') INTO v_google_email
  FROM auth.identities WHERE user_id=p_user_id AND provider='google'
    AND identity_data->>'email_verified'='true'
  ORDER BY created_at, id LIMIT 1 FOR SHARE;
  IF v_google_email IS NULL THEN RAISE EXCEPTION 'VERIFIED_GOOGLE_EMAIL_REQUIRED'; END IF;

  SELECT zalo_id INTO v_zalo_id FROM public.user_zalo_identities WHERE user_id=p_user_id;
  IF v_zalo_id IS NULL AND v_auth_email ~ '^[0-9]{1,64}@zalo\.app$' THEN
    v_zalo_id := split_part(v_auth_email,'@',1);
  END IF;
  -- Cùng thứ tự khóa với RPC link Zalo: Zalo ID trước, public profile sau.
  IF v_zalo_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('zalo:' || v_zalo_id,0));
  END IF;
  PERFORM 1 FROM public.users WHERE id=p_user_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_INACTIVE_OR_MISSING'; END IF;

  IF v_zalo_id IS NOT NULL THEN
    -- Không chuyển Zalo ID của user khác sang user hiện tại; không tự merge tài khoản.
    SELECT user_id INTO v_owner FROM public.user_zalo_identities WHERE zalo_id=v_zalo_id;
    IF v_owner IS NOT NULL AND v_owner<>p_user_id THEN RAISE EXCEPTION 'ZALO_ALREADY_LINKED'; END IF;
    IF EXISTS (SELECT 1 FROM auth.users WHERE email=v_zalo_id || '@zalo.app' AND id<>p_user_id) THEN
      RAISE EXCEPTION 'ZALO_ALREADY_LINKED';
    END IF;
    SELECT zalo_id INTO v_current_zalo FROM public.user_zalo_identities WHERE user_id=p_user_id;
    IF v_current_zalo IS NOT NULL AND v_current_zalo<>v_zalo_id THEN
      RAISE EXCEPTION 'ACCOUNT_ALREADY_HAS_ZALO';
    END IF;
    INSERT INTO public.user_zalo_identities(zalo_id,user_id)
    VALUES(v_zalo_id,p_user_id) ON CONFLICT (zalo_id) DO NOTHING;
  END IF;

  -- Google-only cũng dùng RPC này nhưng không tạo mapping Zalo.
  -- Cùng transaction: cập nhật email lỗi thì mapping vừa insert cũng rollback.
  UPDATE public.users SET contact_email=v_google_email,
    contact_email_verified_at=now(), updated_at=now()
  WHERE id=p_user_id
    AND (contact_email IS DISTINCT FROM v_google_email OR contact_email_verified_at IS NULL);
  -- Retry an toàn: mapping đã có không thêm dòng, email không đổi không ghi lại timestamp.
END;
$$;
REVOKE ALL ON FUNCTION public.complete_google_link(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_google_link(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
