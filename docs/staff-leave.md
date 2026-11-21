# Tự rời cửa hàng

Nút xác nhận gửi POST /api/staff/leave với duy nhất `restaurantId`. Server dùng
session đã xác minh và kiểm tra Origin. RPC public.leave_staff_restaurant(uuid)
lấy actor từ auth.uid() và UPDATE có điều kiện đúng actor, active, staff và quán
đã xác nhận. Request lặp hoặc thuộc quán cũ trả 409. RPC chỉ có EXECUTE cho
authenticated. Luồng cập nhật cả hai field và updated_at trong một statement,
không thay trigger, RLS hay quyền ghi bảng.

Client đọc lại đúng hồ sơ đang đăng nhập qua GET /api/staff/leave, kể cả sau khi
đã về student. GET và response dùng no-store. Sau khi xác minh, client đồng bộ
auth store và seller access. Client không gửi lại POST tự động. Cùng session sau khi
role thành student không qua được kiểm tra quyền danh sách đơn của quán.

Trước khi áp dụng, chạy SELECT sau trong đúng project Supabase. Nếu đã có function
cùng chữ ký, dừng để đối chiếu. Review constraint và trigger; nếu có trigger
khác can thiệp role hoặc liên kết quán thì đối chiếu trước khi áp dụng.

```sql
SELECT p.oid::regprocedure AS rpc,
       pg_get_function_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS returns,
       p.prosecdef AS security_definer,
       pg_get_userbyid(p.proowner) AS owner,
       p.proconfig,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'leave_staff_restaurant'
  AND p.prokind = 'f';

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
  AND conname IN ('chk_staff_restaurant_assignment', 'fk_users_work_for_restaurant');

SELECT tgname, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'public.users'::regclass AND NOT tgisinternal;
```

Nếu chưa có RPC phù hợp, chạy nguyên file
`supabase/migrations/202611210001_staff_leave.sql` trong SQL Editor. Chỉ áp dụng
file đó. Hậu kiểm bằng cách chạy lại câu SELECT đầu tiên. Mong đợi chữ ký
`p_restaurant_id uuid`, trả `jsonb`, security_definer=true, owner=postgres,
authenticated=true, anon/service_role=false và search_path rỗng.
Nếu có overload hoặc chữ ký/quyền khác, đối chiếu định nghĩa và triển khai thực
tế trước khi chạy lại bất kỳ DDL nào. Nếu metadata đúng nhưng API vẫn báo
`STAFF_LEAVE_RPC_UNAVAILABLE`, kiểm tra đúng project và schema cache.

Để gỡ riêng RPC sau khi ngừng dùng
API mới, DBA có thể review `DROP FUNCTION public.leave_staff_restaurant(uuid);`.
Việc gỡ RPC không tự khôi phục quan hệ nhân viên đã kết thúc.

Dùng tài khoản thử quét QR vào quán A. Mở “Rời khỏi cửa hàng” và chọn “Ở lại”,
kiểm tra vẫn là staff. Mở lại, xác nhận rời, kiểm tra thấy nút QR ngay và sau
refresh. Dùng cùng session thử lại API đơn hàng quán A. Đối chiếu đúng hồ sơ test:

```sql
SELECT role, work_for_restaurant_id
FROM public.users
WHERE id = '<UUID_TAI_KHOAN_TEST>'::uuid;
```

Kết quả mong đợi là student và NULL. Xin QR hợp lệ để gia nhập lại. Để kiểm tra
tab cũ, giữ hộp thoại A mở ở một tab. Ở tab còn lại rời A rồi quét QR B. Xác nhận
ở tab cũ, kiểm tra hồ sơ vẫn thuộc B.


Khi kiểm tra lỗi, ưu tiên request đã có trong F12 → Network → Fetch/XHR, lọc
`/api/staff/leave`. Ghi HTTP status, `restaurantId` và `error.code` /
`error.message` đã lọc của POST. Nếu có GET cùng đường dẫn, chỉ cần status,
role và liên kết quán. Không gửi headers, cookie, token hoặc toàn bộ hồ sơ.
`STAFF_LEAVE_CONFLICT`, `DATABASE_ACCESS_DENIED`, `STAFF_LEAVE_REJECTED` và
`STAFF_LEAVE_RPC_UNAVAILABLE` là các nhánh từ chối đã nhận diện được.
`STAFF_LEAVE_RESULT_UNKNOWN` cần đối chiếu GET. Nếu POST đã xác nhận thành công
và GET lỗi, UI báo lỗi tải trạng thái mới để người dùng refresh.
