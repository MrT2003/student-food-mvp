# Lưu giỏ hàng và đơn hàng demo

Chỉ áp dụng cho `useStudentMockStore`, không phải nguồn dữ liệu backend hay thông tin xác thực.

- Khóa localStorage: `student-food:mock:student:50000000-0000-4000-8000-000000000001:v1`.
- Tài khoản hiện tại là fixture cố định. Khóa có customer ID và bộ đọc kiểm tra chủ sở hữu, nhưng chưa có chuyển tài khoản thật. Khi tích hợp đăng nhập/API, bỏ cơ chế demo này hoặc thiết kế lại lifecycle theo session thật.
- Chỉ lưu cart, cart_items, orderRecords, địa chỉ đang nhập, thanh toán/ghi chú theo quán và thông tin phiên checkout gần nhất. Không lưu action, token hoặc các bản sao UI.
- Sau mount, khôi phục và dựng lại UI trước khi render các trang student. Không truy cập localStorage trong server render.
- Checkout ghi đơn hàng và giỏ đã xóa trong cùng một bản lưu. Đơn cũ giữ nguyên snapshot giá/tên/tùy chọn.
- JSON hỏng, khác phiên bản/tài khoản hoặc cart không còn ánh xạ được sang catalog: cảnh báo, giữ nguyên bản lưu cũ, chỉ dùng bộ nhớ trong phiên hiện tại. Không tự xóa dữ liệu người dùng.
- Lỗi ghi (quota/quyền truy cập): cảnh báo, giữ state trong bộ nhớ và thử lưu lại khi dữ liệu thay đổi tiếp.
- Dữ liệu chỉ ở cùng origin và trình duyệt; xóa site data sẽ xóa dữ liệu này. Chưa hỗ trợ đồng bộ/chỉnh sửa đồng thời nhiều tab; hãy test một tab để tránh tab cũ ghi đè.
- Chỉ dùng thông tin giả khi demo: địa chỉ và ghi chú được lưu trên thiết bị. Khi nối backend, không dùng đơn/giá trong localStorage làm dữ liệu tin cậy.

## Kiểm tra tự động

```sh
node scripts/test-student-storage.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

## Kiểm tra trên trình duyệt

1. Thêm món của 2 quán, chọn tùy chọn, đổi số lượng. F5: món, tùy chọn, số lượng và badge số quán giữ nguyên.
2. Nhập địa chỉ và chọn thanh toán/ghi chú khác nhau cho từng quán. F5 trang xác nhận: giữ nguyên lựa chọn.
3. Đặt hàng. F5 trang thành công: vẫn thấy đúng các đơn, giỏ trống. Mở trực tiếp URL chi tiết/theo dõi rồi F5: không báo mất đơn.
4. Đặt thêm lần nữa. F5 danh sách đơn: các đơn của cả hai lần vẫn còn. Đơn pending thuộc mục hiện tại, chưa xuất hiện ở lịch sử hoàn thành.
5. Đóng/mở lại trình duyệt cùng origin (không ở chế độ riêng tư): dữ liệu vẫn còn.

Nếu cần làm lại demo: sao lưu giá trị khóa trên trong DevTools → Application → Local Storage trước, rồi xóa **chỉ khóa đó**, tải lại trang. Thao tác này xóa giỏ và đơn demo đã lưu, không tác động database.

## Đặt lại đơn hàng

- Nút đặt lại trên `/orders`, `/orders/history` và trang chủ dùng chung action `reorderOrder`.
- Chỉ áp dụng cho đơn đã kết thúc: completed/cancelled/rejected, thuộc khách hàng hiện tại.
- Trang chủ hiển thị tối đa 3 quán theo đơn lịch sử mới nhất; mỗi quán đặt lại đơn đã kết thúc gần nhất. Số đơn hiển thị là số đơn lịch sử, bao gồm hủy/từ chối, không phải số đơn giao thành công.
- Giữ số lượng và ID tùy chọn cũ nhưng kiểm tra món/quán/tùy chọn, tính giá từ menu hiện tại. Không dùng giá snapshot cũ cho giỏ mới.
- Gộp món cùng ID + bộ tùy chọn; bộ tùy chọn khác tạo dòng riêng. Giữ nguyên các món đã có trong giỏ và địa chỉ/ghi chú/thanh toán đang nhập. Không chép ghi chú/thanh toán của đơn cũ.
- Một món hoặc tùy chọn không hợp lệ, quán đóng hoặc số lượng vượt 99: không thêm bất kỳ dòng nào. Hiện lỗi để người dùng chọn lại món.
- Sau thành công, nút đã bấm bị khóa trong lần mở trang đó để tránh double-click. Chọn “Xem giỏ hàng” để kiểm tra và checkout; thao tác đặt lại chưa tạo đơn mới.
- Các bài test tự động tạo trạng thái hoàn thành trong bộ nhớ test riêng. Ứng dụng không có nút tự hoàn thành đơn cho khách hàng; nếu chỉ có đơn pending/accepted thì phần đặt lại nhanh sẽ trống cho đến khi có lịch sử hợp lệ.

## Sau khi dọn lớp dữ liệu cũ

- Store chỉ giữ `cart`, `cart_items`, `orderRecords`, `lastCheckout` cùng state form/hydration; không giữ `items`, `restaurants`, `ordersById`, `orderIds`, `checkout` hoặc `lastCheckoutResult` trùng lặp.
- `lib/cart/view-model.ts` và `useCartSummary` dựng dữ liệu hiển thị từ cart rows. Đây là phép chuyển đổi trình bày cần thiết, không phải database hay nguồn giá thứ hai. `useMemo` chỉ tính lại khi cart rows đổi.
- `updateCartItemQuantity`/`removeCartItem` thay `setItems`: component không gửi toàn bộ bản sao UI để sửa giỏ.
- `useCheckout`/`checkout-view.ts` lọc đơn theo khách hàng và phiên checkout; dùng mapper đơn hàng chung. Giá của đơn cũ luôn lấy snapshot.
- Xóa fixture giỏ giá cũ, adapter `projectOrder`, alias `useOrderPreviewStore`, hàm restaurant compatibility không còn consumer. Catalog mock hiện tại vẫn cần thiết cho demo, chưa thay bằng API.
- Định dạng localStorage v1 giữ nguyên. Không cần xóa giỏ/đơn đã lưu để áp dụng thay đổi này.
