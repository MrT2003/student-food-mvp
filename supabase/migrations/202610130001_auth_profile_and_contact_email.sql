-- Chạy sau 202610060001_zalo_account_links.sql, trước khi deploy code mới.
BEGIN;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS contact_email_verified_at timestamptz;

-- Profile tối thiểu: chạy cùng transaction với Auth insert, không lấy role từ metadata.
CREATE OR REPLACE FUNCTION public.create_auth_public_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_zalo_id text := NEW.raw_app_meta_data->>'zalo_id';
BEGIN
  -- Namespace email Zalo chỉ được backend tạo; browser không được đăng ký trước để chiếm ID.
  IF NEW.email ~ '^[0-9]{1,64}@zalo\.app$' AND v_zalo_id IS NULL THEN
    RAISE EXCEPTION 'RESERVED_ZALO_EMAIL';
  END IF;
  IF v_zalo_id IS NOT NULL THEN
    IF v_zalo_id !~ '^[0-9]{1,64}$' OR NEW.email IS DISTINCT FROM v_zalo_id || '@zalo.app' THEN
      RAISE EXCEPTION 'INVALID_ZALO_ID';
    END IF;
    -- Cùng khóa với link_zalo_identity: không tạo tài khoản riêng khi một link vừa thắng race.
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('zalo:' || v_zalo_id, 0));
    IF EXISTS (SELECT 1 FROM public.user_zalo_identities WHERE zalo_id=v_zalo_id) THEN
      RAISE EXCEPTION 'ZALO_ALREADY_LINKED';
    END IF;
  END IF;
  INSERT INTO public.users(id, role, status, name, avatar_url)
  VALUES (NEW.id, 'student', 'active',
    coalesce(nullif(btrim(NEW.raw_user_meta_data->>'name'),''),
             nullif(btrim(NEW.raw_user_meta_data->>'full_name'),''), 'Người dùng'),
    coalesce(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'))
  ON CONFLICT (id) DO NOTHING;
  -- Không insert user_zalo_identities. Email liên hệ chỉ đồng bộ từ Google identity đã xác minh.
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_auth_public_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS sf_create_auth_public_profile ON auth.users;
CREATE TRIGGER sf_create_auth_public_profile AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_auth_public_profile();

-- Chỉ trusted server được gọi; email lấy trực tiếp từ identity, không lấy user_metadata.
CREATE OR REPLACE FUNCTION public.sync_google_contact_email(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_email text;
BEGIN
  SELECT nullif(btrim(identity_data->>'email'),'') INTO v_email
  FROM auth.identities
  WHERE user_id=p_user_id AND provider='google'
    AND identity_data->>'email_verified'='true'
  ORDER BY created_at, id LIMIT 1;
  IF v_email IS NULL THEN RAISE EXCEPTION 'VERIFIED_GOOGLE_EMAIL_REQUIRED'; END IF;
  UPDATE public.users SET contact_email=v_email, contact_email_verified_at=now(), updated_at=now()
  WHERE id=p_user_id AND status='active'
    AND (contact_email IS DISTINCT FROM v_email OR contact_email_verified_at IS NULL);
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=p_user_id AND status='active') THEN
    RAISE EXCEPTION 'ACCOUNT_INACTIVE_OR_MISSING';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_google_contact_email(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_google_contact_email(uuid) TO service_role;

-- RLS cho phép sửa profile không đồng nghĩa browser được tự gán email đã xác minh.
CREATE OR REPLACE FUNCTION public.protect_contact_email()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon','authenticated') THEN
    IF TG_OP='INSERT' THEN
      IF NEW.contact_email IS NOT NULL OR NEW.contact_email_verified_at IS NOT NULL THEN
        RAISE EXCEPTION 'CONTACT_EMAIL_SERVER_MANAGED';
      END IF;
    ELSIF NEW.contact_email IS DISTINCT FROM OLD.contact_email
       OR NEW.contact_email_verified_at IS DISTINCT FROM OLD.contact_email_verified_at THEN
      RAISE EXCEPTION 'CONTACT_EMAIL_SERVER_MANAGED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sf_protect_contact_email ON public.users;
CREATE TRIGGER sf_protect_contact_email BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_contact_email();
NOTIFY pgrst, 'reload schema';
COMMIT;
