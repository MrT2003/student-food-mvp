BEGIN;
-- Chỉ server ghi registry; browser không thể tự nhận một URL là ảnh đã xác minh.
CREATE TABLE public.cloudinary_uploads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 purpose text NOT NULL CHECK (purpose IN ('avatar','restaurant','restaurant_registration','menu')),
 restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
 public_id text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 verified_url text UNIQUE,
 verified_at timestamptz,
 verify_after timestamptz NOT NULL DEFAULT now(),
 metadata jsonb
);
CREATE INDEX cloudinary_uploads_owner ON public.cloudinary_uploads(user_id,created_at);
ALTER TABLE public.cloudinary_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cloudinary_uploads FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.cloudinary_uploads TO service_role;
CREATE TABLE public.cloudinary_upload_limits (
 user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
 hour_start timestamptz NOT NULL, hour_count integer NOT NULL,
 day_start timestamptz NOT NULL, day_count integer NOT NULL
);
ALTER TABLE public.cloudinary_upload_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cloudinary_upload_limits FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.cloudinary_upload_limits TO service_role;

-- Khóa theo user: nhiều instance Vercel cũng không vượt hạn mức cùng lúc.
CREATE FUNCTION public.reserve_cloudinary_upload(p_user_id uuid,p_purpose text,p_restaurant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid:=gen_random_uuid(); v_public_id text; v_limit public.cloudinary_upload_limits; v_now timestamptz:=now();
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_user_id AND status='active') THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
 INSERT INTO public.cloudinary_upload_limits VALUES(p_user_id,v_now,0,v_now,0) ON CONFLICT DO NOTHING;
 SELECT * INTO v_limit FROM public.cloudinary_upload_limits WHERE user_id=p_user_id FOR UPDATE;
 IF v_limit.hour_start + interval '1 hour' <= v_now THEN v_limit.hour_start:=v_now; v_limit.hour_count:=0; END IF;
 IF v_limit.day_start + interval '1 day' <= v_now THEN v_limit.day_start:=v_now; v_limit.day_count:=0; END IF;
 IF v_limit.hour_count>=20 OR v_limit.day_count>=100 THEN RAISE EXCEPTION 'UPLOAD_RATE_LIMIT'; END IF;
 UPDATE public.cloudinary_upload_limits SET hour_start=v_limit.hour_start,hour_count=v_limit.hour_count+1,
 day_start=v_limit.day_start,day_count=v_limit.day_count+1 WHERE user_id=p_user_id;
 v_public_id:='student-food/'||p_purpose||'/'||p_user_id::text||'/'||v_id::text;
 -- Chỉ dọn lượt bỏ dở đã hết thời hạn. Registry đã xác minh phải giữ để kiểm tra URL khi lưu.
 DELETE FROM public.cloudinary_uploads WHERE user_id=p_user_id AND verified_at IS NULL AND created_at<v_now-interval '2 days';
 INSERT INTO public.cloudinary_uploads(id,user_id,purpose,restaurant_id,public_id) VALUES(v_id,p_user_id,p_purpose,p_restaurant_id,v_public_id);
 RETURN jsonb_build_object('id',v_id,'public_id',v_public_id);
END $$;
REVOKE ALL ON FUNCTION public.reserve_cloudinary_upload(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_cloudinary_upload(uuid,text,uuid) TO service_role;

-- Chặn bỏ qua API bằng gọi RPC/update trực tiếp. Giữ ảnh cũ khi không đổi URL.
-- auth.uid() vẫn có trong SECURITY DEFINER RPC; không kiểm tra current_user ở đây.
CREATE FUNCTION public.guard_verified_cloudinary_image() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid(); v_url text; v_old text; v_ok boolean;
BEGIN
 IF v_actor IS NULL THEN
   IF coalesce(auth.role(),'')='service_role' OR session_user IN ('postgres','supabase_admin') THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'IMAGE_AUTH_REQUIRED';
 END IF;
 IF TG_TABLE_NAME='menu_items' THEN
   v_url:=NEW.image_url; IF TG_OP='UPDATE' THEN v_old:=OLD.image_url; END IF;
 ELSE
   v_url:=NEW.avatar_url; IF TG_OP='UPDATE' THEN v_old:=OLD.avatar_url; END IF;
 END IF;
 IF v_url IS NULL OR v_url IS NOT DISTINCT FROM v_old THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='users' THEN
   SELECT EXISTS(SELECT 1 FROM public.cloudinary_uploads WHERE verified_url=v_url AND user_id=v_actor AND purpose='avatar' AND verified_at IS NOT NULL AND NEW.id=v_actor) INTO v_ok;
 ELSIF TG_TABLE_NAME='restaurants' THEN
   SELECT EXISTS(SELECT 1 FROM public.cloudinary_uploads WHERE verified_url=v_url AND user_id=v_actor AND verified_at IS NOT NULL AND NEW.owner_id=v_actor
     AND ((purpose='restaurant' AND restaurant_id=NEW.id) OR purpose='restaurant_registration')) INTO v_ok;
 ELSE
   SELECT EXISTS(SELECT 1 FROM public.cloudinary_uploads WHERE verified_url=v_url AND user_id=v_actor AND purpose='menu' AND restaurant_id=NEW.restaurant_id AND verified_at IS NOT NULL
     AND EXISTS(SELECT 1 FROM public.restaurants WHERE id=NEW.restaurant_id AND owner_id=v_actor)) INTO v_ok;
 END IF;
 IF NOT v_ok THEN RAISE EXCEPTION 'IMAGE_NOT_VERIFIED'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_verified_cloudinary_image() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER verify_user_avatar BEFORE INSERT OR UPDATE OF avatar_url ON public.users FOR EACH ROW EXECUTE FUNCTION public.guard_verified_cloudinary_image();
CREATE TRIGGER verify_restaurant_avatar BEFORE INSERT OR UPDATE OF avatar_url ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.guard_verified_cloudinary_image();
CREATE TRIGGER verify_menu_image BEFORE INSERT OR UPDATE OF image_url ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.guard_verified_cloudinary_image();
NOTIFY pgrst,'reload schema';
COMMIT;

