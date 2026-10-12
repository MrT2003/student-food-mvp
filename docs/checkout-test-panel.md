# Test checkout hai cửa hàng

## Chuẩn bị

1. Dùng project Supabase test có schema trong `types/database.types.ts`.
2. RPC `add_to_cart` và `create_checkout_orders` phải được cài trên database. `add_to_cart` trả một object cart item có `id`; checkout nhận `p_checkout_items`, `p_checkout_session_id` và trả `sessionCheckoutId`, `orders` (camelCase).
3. Có một user seller đang active trong `public.users`. Thay `OWNER_UUID` trong `supabase/seeds/checkout-test.sql` bằng UUID này rồi chạy toàn bộ file qua SQL Editor. Không tạo trực tiếp user trong `auth.users`.
4. Đăng nhập app bằng tài khoản student có profile active. Panel hiện đã được gắn vào `app/(student)/page.tsx`.

Seed dùng UUID cố định, có thể chạy lại và chỉ cập nhật các fixture tương ứng. Không seed cart/order sẵn; panel gọi service/RPC thật để tạo dữ liệu đó. CartUtilities giữ cách sort/hash; formatter chỉ trả group_id và options[{id}].

## Thao tác

1. Bấm **Thêm / tải lại đủ 4 dòng giỏ hàng**. Hai món gốc thuộc hai cửa hàng; mỗi món có hai bộ options khác nhau. Mỗi dòng checkout số lượng 1.
2. Mở JSON của từng dòng để xem input đảo thứ tự, output của `formatSortSelectedOptions`, `generateHash` và cart item trả về. JSONB giữ thứ tự mảng, không bảo toàn thứ tự key object. Kiểm tra dữ liệu thực bằng Table Editor nếu RPC add_to_cart không trả selected_options đã lưu.
3. Bấm **Đặt 4 món trong cùng một session**. Panel gửi cả bốn dòng, expected_unit_price từng dòng và p_expected_total. RPC tạo UUID và ghi chung vào cả hai orders; panel hiển thị session từ response.
4. Bấm **Đọc DB kiểm tra**. Nếu RLS không cho SELECT, dùng `supabase/seeds/verify-checkout-test.sql`, thay `SESSION_UUID` bằng UUID hiển thị.

| Dòng | Giá gốc | Options | Tổng |
|---|---:|---|---:|
| Quán 1 A | 30.000 | L +5.000, phô mai +10.000, trân châu +5.000 | 50.000 |
| Quán 1 B | 30.000 | M +0, trân châu +5.000 | 35.000 |
| Quán 2 A | 40.000 | L +5.000, phô mai +10.000, trân châu +5.000 | 60.000 |
| Quán 2 B | 40.000 | M +0, trân châu +5.000 | 45.000 |

Kỳ vọng: 2 orders cùng `session_checkout_id`, mỗi order 2 order_items; tổng từng quán 85.000 và 105.000, tổng chung 190.000. Cart mới có 4 dòng quantity=1 thì cả 4 được xóa sau checkout; nếu dùng lại dòng có quantity lớn hơn thì chỉ trừ 1.

## Lưu ý khi test

- Panel chặn click đồng thời bằng ref và state. Thêm lỗi giữa chừng có thể bấm lại: đọc các fixture đã có trong giỏ theo menu/restaurant/hash trước khi thêm.
- Sau khi đã gửi checkout, không tự retry: bản RPC hiện tại chưa có hợp đồng idempotency đầy đủ. Nếu timeout/mất phản hồi, kiểm tra đơn theo user/thời gian trên DB trước khi reload và bắt đầu lượt mới. Nếu đã nhận UUID, lưu UUID trước khi reload.
- Giỏ và đơn khác của người dùng không được chọn vào checkout test.
- Schema SQL cũ `supabase/Query_PostgreSQL.txt` khác generated types ở order_items. RPC dùng cho test cần đúng `image_url`, `option_snapshot_price` như `types/database.types.ts`.
- Không có SQL seed nào được tự chạy khi start Next.js.

## Cập nhật contract options / giá

- Chạy toàn bộ supabase/rpc/compact_cart_options.sql để compact dữ liệu cũ và cài trigger bảo đảm insert/update chỉ lưu ID. Nếu có JSON cũ dạng phẳng hoặc sai định dạng, script rollback; cần chuyển dữ liệu đó trước. Script không tự chạy khi start server.
- Chạy toàn bộ supabase/rpc/create_checkout_orders.sql để cập nhật RPC. Chưa áp dụng các script này vào database từ workspace.
- Panel tải giá món/options từ database khi chuẩn bị giỏ. Giá seed trong bảng trên chỉ là giá ban đầu. Không tự refresh giá ngay trước checkout.
- Test tổng sai: bật checkbox cộng 1.000đ rồi đặt; kỳ vọng PRICE_MISMATCH, không tạo đơn và không thay đổi giỏ. Tắt checkbox để đặt lại.
- Test giá thay đổi: tải giỏ, sửa menu_items.price hoặc menu_item_options.additional_price trong SQL Editor, rồi đặt mà không tải lại giá; kỳ vọng PRICE_MISMATCH. Bấm tải lại giá, xem giá mới rồi xác nhận đặt lại.
- Test option ngừng bán/xóa, group sai món, thiếu group bắt buộc, chọn nhiều option trong group đơn: RPC phải từ chối toàn bộ checkout.
- RPC khóa các dòng cart/catalog đang dùng, kiểm tra từng đơn giá và tổng, rồi tạo snapshot từ cùng dữ liệu đã kiểm tra. Snapshot order vẫn giữ tên/giá; cart không giữ chúng.
- So sánh theo đơn giá cuối cùng của mỗi dòng, không so sánh riêng từng thành phần giá. Nếu giá gốc tăng và option giảm đúng bằng nhau trên cùng dòng, đơn giá không đổi nên checkout vẫn được chấp nhận.
- Khi PRICE_MISMATCH trả về, panel cho thử lại vì transaction rollback. Nếu mất phản hồi, session do server tạo có thể chưa được biết: kiểm tra đơn theo user/thời gian trước khi retry. Chưa có idempotency đầy đủ.
- Luồng cart mock trong lib/cart vẫn dùng contract riêng dạng option_id; thay đổi này áp dụng CartServices và panel gọi database thật.
