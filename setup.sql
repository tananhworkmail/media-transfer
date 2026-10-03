-- ============================================================
-- MEDIA TRANSFER - SUPABASE STORAGE POLICIES
-- ============================================================
-- Trước khi chạy file này:
-- 1) Supabase Dashboard -> Storage -> New bucket
-- 2) Tên bucket: media
-- 3) Bật Public bucket
-- 4) File size limit: 50 MB (hoặc giới hạn bạn muốn, <= global limit)
-- 5) Allowed MIME types: để trống, hoặc cho image/*, video/*, audio/*
--
-- CẢNH BÁO: Không có đăng nhập nên các policy dưới đây cố ý cho role anon
-- LIST / UPLOAD / DELETE trong bucket media.
-- Ai có URL website/project + publishable key đều có thể sử dụng các quyền này.
-- ============================================================

-- Xóa policy cũ cùng tên để có thể chạy lại file này an toàn.
drop policy if exists "media_anon_select" on storage.objects;
drop policy if exists "media_anon_insert" on storage.objects;
drop policy if exists "media_anon_delete" on storage.objects;

-- Cho phép website liệt kê file trong bucket media.
create policy "media_anon_select"
on storage.objects
for select
to anon
using (bucket_id = 'media');

-- Cho phép upload file mới. Web tạo tên object duy nhất nên không cần UPDATE/upsert.
create policy "media_anon_insert"
on storage.objects
for insert
to anon
with check (bucket_id = 'media');

-- Cho phép xóa file. Supabase remove() cũng cần SELECT, đã có ở trên.
create policy "media_anon_delete"
on storage.objects
for delete
to anon
using (bucket_id = 'media');
