# Media Transfer — InfinityFree + Supabase

Web PHP rất nhẹ để chuyển file media PC ↔ iPhone. PHP chỉ phục vụ giao diện; file upload/download đi trực tiếp giữa trình duyệt và Supabase Storage nên không đi qua giới hạn upload của InfinityFree.

## Tính năng

- Không đăng nhập.
- Upload nhiều ảnh/video/audio.
- File <= 6 MB: Supabase standard upload.
- File > 6 MB: TUS resumable upload, có thanh tiến trình.
- Không resize, không re-encode, không nén media ở phía web.
- Gallery responsive cho PC/iPhone.
- Tạo nhóm file, chọn nhóm khi upload và xem riêng từng nhóm. File cũ nằm trong **Chưa phân nhóm**.
- Tìm theo tên file; lọc theo ảnh/video/audio, kích thước MB và ngày tải lên.
- Xóa nhóm kèm toàn bộ file trong nhóm sau khi xác nhận số lượng.
- Xem ảnh/video/audio.
- Tải file gốc với lại tên file ban đầu.
- Trên iPhone, `Lưu vào Ảnh` mở bảng chia sẻ file để chọn `Lưu hình ảnh` / `Lưu video`.
- `Tải vào Files` tải file gốc về ứng dụng Tệp của iPhone.
- Xóa file khỏi Supabase.

## 1. Tạo bucket Supabase

Vào **Supabase Dashboard -> Storage -> New bucket**.

- Bucket name: `media`
- Public bucket: **ON**
- File size limit: `50 MB` nếu bạn dùng Free plan và global limit cho phép
- Allowed MIME types: có thể để trống. Web phía client chỉ cho image/video/audio.

Sau đó mở **SQL Editor**, dán toàn bộ nội dung `setup.sql` và Run.

> QUAN TRỌNG: Vì bạn yêu cầu không đăng nhập, policy cho role `anon` quyền SELECT / INSERT / DELETE trong bucket `media`. Bất kỳ ai biết website/project và publishable key đều có thể thao tác bucket. Publishable key không phải secret; quyền thực tế được quyết định bởi RLS policy.

## 2. Deploy InfinityFree

Upload các file/thư mục sau vào `htdocs`:

```
index.php
config.php
.htaccess
robots.txt
assets/
  app.js
  style.css
```

`setup.sql` và `README.md` không cần upload. `.htaccess` có rule chặn truy cập hai file này nếu bạn lỡ upload.

Mở URL HTTPS của website. Nếu bucket/policy đúng, trang sẽ hiện `0 file` thay vì báo lỗi.

Các nhóm dùng thư mục trong chính bucket Storage, không cần tạo bảng mới hay chạy lại SQL. Mỗi nhóm có một ảnh đánh dấu 1×1 pixel để nhóm rỗng vẫn tồn tại. Nếu bucket giới hạn MIME, cần cho phép `image/png` để tạo nhóm.

## 3. Test

1. PC: upload một JPG nhỏ.
2. Refresh gallery, kiểm tra ảnh xuất hiện.
3. iPhone: mở cùng URL bằng Safari.
4. Nhấn `Lưu vào Ảnh` trên ảnh/video. Nếu trang báo file đã sẵn sàng, nhấn nút này thêm lần nữa. Trong bảng chia sẻ chọn **Lưu hình ảnh / Lưu video**. Nếu Safari không chia sẻ được định dạng file, trang sẽ mở khung xem: nhấn giữ ảnh và chọn lưu. Với video, tải vào Tệp, mở video trong ứng dụng Tệp rồi chọn **Chia sẻ → Lưu video** nếu có.
5. Thử `Tải vào Files`; Safari sẽ đưa file vào Downloads/ứng dụng Tệp, không vào thư viện Ảnh.
6. Upload ngược lại từ iPhone.
7. Tạo một nhóm, chọn nhóm đó ở phần **Gửi file**, upload ảnh rồi thử tìm tên và lọc theo kích thước/ngày. Khi xóa nhóm, mọi file trong nhóm cũng bị xóa vĩnh viễn.

Trang web không thể tự ghi file vào thư viện Ảnh của iOS. Safari phải hỗ trợ chia sẻ định dạng file đó và bạn cần chọn thao tác lưu trong bảng chia sẻ. Một số định dạng video/ảnh không được iOS hỗ trợ nên sẽ không có lựa chọn lưu vào Ảnh.

### Muốn giữ nguyên file iPhone tốt nhất

Nếu file nằm trong Photos và bạn cần giữ đúng file gốc/định dạng gốc, cách chắc chắn hơn là:

`Photos -> Share -> Save to Files -> mở website -> Chọn file từ Files`.

Website không resize/re-encode file, nhưng Photo Library picker của iOS có thể thực hiện chuyển đổi định dạng trước khi file đến website trong một số trường hợp.

## Cấu hình

`config.php` đã chứa Project URL và Publishable key bạn cung cấp.

- Bucket: `media`
- Max client-side: `50 MiB`
- Ngưỡng TUS: `6 MiB`

Nếu đổi bucket, sửa `bucket` trong `config.php` và sửa `'media'` trong `setup.sql` rồi chạy lại policy tương ứng.

## Giới hạn Free plan đáng chú ý

Tại thời điểm bộ source này được tạo, Supabase Free có tối đa 50 MB/file, 1 GB Storage và quota egress theo gói. Hãy kiểm tra Dashboard nếu quota/gói của bạn thay đổi.

## Không dùng secret key ở trình duyệt

Chỉ dùng `sb_publishable_...` trong source public. Tuyệt đối không đưa `sb_secret_...` hay legacy `service_role` vào `config.php`, JavaScript, GitHub public hoặc HTML.
