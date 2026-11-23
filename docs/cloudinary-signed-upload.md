# Cloudinary signed upload — thiết lập và kiểm tra

## Luồng đã triển khai

Browser xin chữ ký → backend kiểm tra session/quyền/hạn mức → browser gửi file thẳng tới Cloudinary → backend đọc asset từ Cloudinary Admin API → lưu registry xác minh → UI nhận URL chuẩn. API `/api/uploads/cloudinary` nhận metadata JSON, không nhận file.

- `services/cloudinary.service.ts`: client validate để hỗ trợ UX, xin chữ ký, upload và hoàn tất xác minh.
- `services/cloudinary-server.service.ts`: quyền, SHA-256 signature và kiểm tra asset.
- `cloudinary_uploads`: chủ sở hữu, mục đích, nhà hàng, public_id do server cấp, URL/metadata đã xác minh.
- `cloudinary_upload_limits`: một dòng/user, quota 20 lượt ký/giờ và 100 lượt/ngày. Lượt bỏ dở vẫn tính quota. RPC khóa dòng để nhiều instance Vercel không cấp vượt đồng thời.
- Trigger trên users.avatar_url, restaurants.avatar_url, menu_items.image_url: URL thay đổi phải thuộc registry đã xác minh, đúng người/mục đích/quán. Browser gọi thẳng RPC cũng bị kiểm tra. Ảnh cũ không thay đổi vẫn giữ nguyên; server service_role vẫn có thể tạo hồ sơ OAuth với avatar provider.
- Xác minh lại cùng intent đã thành công không gọi Cloudinary thêm. Intent chưa xác minh chỉ gọi Cloudinary tối đa một lần/30 giây.

## 1. Lấy thông tin Cloudinary

Trong đúng product environment của Cloudinary, vào Settings → API Keys:
- Cloud name.
- API key.
- API secret (chỉ lưu server; không gửi qua chat, không commit).

Server hiện dùng API key cho signed Upload API và đọc asset từ Admin API; key phải có quyền tương ứng.

## 2. Tạo preset riêng

Trong Settings → Upload / Upload Presets, Add upload preset:

- Name: `student_food_signed`.
- Signing mode: **Signed**.
- Allowed formats: `jpg,png,webp`.
- Delivery type: `upload` (ảnh công khai).
- Overwrite: false; code cũng ký `overwrite=false`.
- Không cấu hình tự thay public_id, prefix/folder cho public_id, dùng tên file gốc hay thêm suffix. Backend đã cấp public_id đầy đủ `student-food/<purpose>/<userId>/<UUID>`.
- Không thêm incoming/eager transformations trong giai đoạn test để metadata và URL khớp chính xác. Có thể bổ sung sau khi đánh giá chi phí và yêu cầu.
- Nếu account/preset có giới hạn dung lượng ảnh, đặt 5 MB. Code luôn chặn >5 MB khi xác minh, nhưng kiểm tra sau upload không ngăn byte quá lớn đã đi vào Cloudinary. Giới hạn tiếp nhận phải được cấu hình ở Cloudinary; không coi validation frontend là bảo mật.

Không cần whitelist ngrok cụ thể cho chữ ký. Client gọi API nội bộ bằng URL tương đối; localhost/ngrok/production đều dùng cùng flow. Kiểm tra proxy chuyển tiếp origin/host đúng nếu API app trả403.

## 3. Env server

Thêm vào `.env.local` hoặc file env local đang dùng; trên Vercel thêm vào Environment Variables cho đúng môi trường:

```dotenv
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_SIGNED_UPLOAD_PRESET=student_food_signed
```

Không dùng NEXT_PUBLIC cho secret. Cloud name/API key không phải secret; backend sẽ trả hai giá trị này cho browser là hành vi bình thường. Không trả API secret.

Code không còn đọc `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` và `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`; có thể bỏ hai biến cũ khỏi env khi không còn nơi khác dùng. Không đổi SUPABASE_SERVICE_ROLE_KEY. Không cần cài thêm SDK.

## 4. Supabase và deploy

Chạy toàn bộ `supabase/migrations/202611230002_signed_cloudinary_uploads.sql` một lần trong SQL Editor. Migration có transaction, thêm hai bảng, RPC và ba trigger; không xóa ảnh/URL cũ.

Lưu ý migration siết việc ghi URL mới: các client phiên bản cũ còn dùng unsigned upload sẽ không lưu URL mới được. Triển khai migration và code mới trong cùng đợt; refresh client để nhận code mới.

Restart dev server hoặc redeploy Vercel để nạp env.

Sau khi đường signed chạy đúng, **chuyển preset unsigned cũ sang Signed hoặc disable/delete preset cũ**. Rà soát các preset unsigned khác trước khi tắt nếu có ứng dụng khác dùng. Chỉ bỏ tên preset khỏi code không chặn người biết preset cũ. Đổi/xóa preset không phải thao tác xóa asset hiện có.

## 5. Test

1. Đăng nhập student, đổi avatar JPG/PNG/WebP nhỏ hơn5MB. Network: app POST action=sign → Cloudinary image/upload → app POST action=complete.
2. Response sign có apiKey/signature/timestamp/public_id, không có secret. File chỉ nằm trong request tới Cloudinary.
3. Sau complete, `cloudinary_uploads.verified_at` và `verified_url` có dữ liệu. Bấm lưu hồ sơ, reload để xác nhận.
4. Owner quán thật upload ảnh món. Student/staff hoặc owner quán khác xin purpose=menu phải bị403.
5. Gửi URL giả trực tiếp qua update_my_profile hoặc cập nhật image_url: DB trả IMAGE_NOT_VERIFIED. Giữ nguyên ảnh cũ và sửa field khác vẫn được.
6. Đổi public_id/overwrite/preset trong request Cloudinary nhưng dùng chữ ký cũ: phải bị từ chối.
7. Gửi unsigned upload bằng preset cũ sau khi tắt unsigned: phải bị từ chối.
8. Vượt20 lượt xin ký trong cửa sổ1giờ: API trả429, kể cả upload trước đó chưa hoàn tất.
9. Dùng intent của account A để complete khi đăng nhập B:404. File quá5MB nếu vượt validation frontend vẫn không được gắn vào DB sau xác minh.
10. Ảnh quán trên form đăng ký/chỉnh sửa hiện vẫn là preview theo code cũ; thay đổi này không tự thêm nghiệp vụ lưu avatar quán. Menu demo/local không đồng nghĩa đã ghi DB.

## Giới hạn cần hiểu

- Signed upload không phải token dùng một lần. Cloudinary signature có thời hạn khoảng1giờ; public_id cố định và overwrite=false hạn chế replay tạo thêm/ghi đè image. Không cam kết chặn mọi request gửi tới Cloudinary hoặc spam từ nhiều tài khoản hợp lệ.
- Admin API có quota riêng. Mỗi ảnh xác minh lần đầu dùng một lần đọc asset; cần theo dõi usage và nâng thiết kế nếu lượng upload tăng mạnh.
- Không quét nội dung độc hại/moderation; chỉ kiểm tra quyền, loại tài nguyên, format và bytes đáng tin từ provider.
- Ảnh upload nhưng user không lưu form có thể thành ảnh mồ côi. Hiện chưa tự xóa asset/registry đã xác minh để tránh xóa ảnh đang được tham chiếu. Lượt chưa xác minh quá2ngày được dọn theo user khi xin lượt mới, nhưng không xóa file Cloudinary. Cần chính sách dọn asset riêng nếu dung lượng tăng.
- Trigger cho phép giữ URL cũ không thay đổi; muốn đổi sang ảnh mới phải upload qua flow mới. Không tự migrate ảnh Google/Zalo hoặc ảnh cũ.

Tài liệu chính thức:
- https://cloudinary.com/documentation/client_side_uploading
- https://cloudinary.com/documentation/upload_presets
- https://cloudinary.com/documentation/admin_api
