-- ĐỀ XUẤT ĐỂ REVIEW, CHƯA ÁP DỤNG. Không nằm trong migration QR.
-- Chỉ áp dụng sau khi DBA kiểm tra metadata theo seller-bank-review.md:
-- public.restaurant_banks có UNIQUE(restaurant_id, account_no), và partial
-- UNIQUE(restaurant_id) WHERE is_default=true, valid/ready, không có trigger khác
-- làm thay đổi semantics. Không tạo/đổi bảng/index/constraint trong đề xuất này.
-- Application hiện CHƯA gọi hàm này: không coi file SQL là RPC đang triển khai.

BEGIN;

CREATE FUNCTION public.seller_write_restaurant_bank(
  p_restaurant_id uuid,
  p_bank_id uuid DEFAULT NULL,
  p_patch jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_user public.users%rowtype;
  v_restaurant public.restaurants%rowtype;
  v_bank public.restaurant_banks%rowtype;
  v_key text;
  v_count integer;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  IF p_restaurant_id IS NULL OR p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object'
     OR p_patch = '{}'::jsonb THEN RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_patch) LOOP
    IF v_key NOT IN ('bank_name','account_no','account_name','is_default') THEN
      RAISE EXCEPTION 'VALIDATION_ERROR';
    END IF;
  END LOOP;
  FOREACH v_key IN ARRAY ARRAY['bank_name','account_no','account_name'] LOOP
    IF (p_bank_id IS NULL AND NOT p_patch ? v_key)
       OR (p_patch ? v_key AND (jsonb_typeof(p_patch->v_key) <> 'string'
           OR btrim(p_patch->>v_key) = '')) THEN
      RAISE EXCEPTION 'VALIDATION_ERROR';
    END IF;
  END LOOP;
  IF p_patch ? 'is_default' AND jsonb_typeof(p_patch->'is_default') <> 'boolean' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR';
  END IF;

  -- Cùng thứ tự user -> restaurant -> bank. Không khóa bank rồi quay lại user.
  -- Phù hợp luồng đăng ký và thứ tự users -> restaurant của QR đang chuẩn bị.
  SELECT * INTO v_user FROM public.users WHERE id = v_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  IF v_user.status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'ACCOUNT_INACTIVE'; END IF;
  IF v_user.role IS DISTINCT FROM 'seller' THEN RAISE EXCEPTION 'SELLER_REQUIRED'; END IF;
  SELECT * INTO v_restaurant FROM public.restaurants
  WHERE id = p_restaurant_id AND owner_id = v_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESTAURANT_NOT_FOUND'; END IF;
  -- Không yêu cầu quán active/open. Khóa hàng quán tuần tự hóa cả lúc chưa có bank.
  IF p_bank_id IS NOT NULL THEN
    SELECT * INTO v_bank FROM public.restaurant_banks
    WHERE id = p_bank_id AND restaurant_id = p_restaurant_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'BANK_NOT_FOUND'; END IF;
  END IF;

  IF p_patch->>'is_default' = 'true' THEN
    UPDATE public.restaurant_banks SET is_default = false, updated_at = now()
    WHERE restaurant_id = p_restaurant_id AND is_default
      AND (p_bank_id IS NULL OR id <> p_bank_id);
  END IF;
  IF p_bank_id IS NULL THEN
    INSERT INTO public.restaurant_banks (restaurant_id,bank_name,account_no,account_name,is_default)
    VALUES (p_restaurant_id,btrim(p_patch->>'bank_name'),btrim(p_patch->>'account_no'),
            btrim(p_patch->>'account_name'),coalesce((p_patch->>'is_default')::boolean,false))
    RETURNING * INTO v_bank;
  ELSE
    UPDATE public.restaurant_banks b SET
      bank_name = CASE WHEN p_patch ? 'bank_name' THEN btrim(p_patch->>'bank_name') ELSE b.bank_name END,
      account_no = CASE WHEN p_patch ? 'account_no' THEN btrim(p_patch->>'account_no') ELSE b.account_no END,
      account_name = CASE WHEN p_patch ? 'account_name' THEN btrim(p_patch->>'account_name') ELSE b.account_name END,
      is_default = CASE WHEN p_patch ? 'is_default' THEN (p_patch->>'is_default')::boolean ELSE b.is_default END,
      updated_at = now()
    WHERE b.id = p_bank_id AND b.restaurant_id = p_restaurant_id
    RETURNING * INTO v_bank;
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN RAISE EXCEPTION 'BANK_WRITE_FAILED'; END IF;
  -- Không bắt rồi nuốt lỗi: unique/trigger/ghi đích lỗi phải hủy cả demote trong RPC.
  RETURN jsonb_build_object('bank',jsonb_build_object(
    'id',v_bank.id,'restaurant_id',v_bank.restaurant_id,'bank_name',v_bank.bank_name,
    'account_no',v_bank.account_no,'account_name',v_bank.account_name,'is_default',v_bank.is_default));
END;
$function$;

ALTER FUNCTION public.seller_write_restaurant_bank(uuid,uuid,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.seller_write_restaurant_bank(uuid,uuid,jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.seller_write_restaurant_bank(uuid,uuid,jsonb) TO authenticated;
COMMIT;

-- Rollback ĐỊNH NGHĨA/quyền của đúng hàm MỚI, khi đã bỏ caller application:
-- BEGIN;
-- DROP FUNCTION public.seller_write_restaurant_bank(uuid,uuid,jsonb);
-- COMMIT;
-- Không tự hoàn tác dữ liệu bank đã ghi. CREATE FUNCTION cố ý không OR REPLACE:
-- nếu tên/chữ ký đã tồn tại phải đọc định nghĩa hiện có, không ghi đè mù.
