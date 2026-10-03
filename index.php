<?php
$config = require __DIR__ . '/config.php';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Frame-Options: DENY');
header('Permissions-Policy: geolocation=(), camera=(), microphone=()');
header("Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://cnxvwvykhwvtmpxthvrr.supabase.co; media-src 'self' blob: https://cnxvwvykhwvtmpxthvrr.supabase.co; connect-src 'self' https://cnxvwvykhwvtmpxthvrr.supabase.co https://cnxvwvykhwvtmpxthvrr.storage.supabase.co; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");

$publicConfig = [
    'supabaseUrl' => $config['supabaseUrl'],
    'publishableKey' => $config['publishableKey'],
    'projectRef' => $config['projectRef'],
    'bucket' => $config['bucket'],
    'maxFileSizeBytes' => $config['maxFileSizeBytes'],
    'tusThresholdBytes' => $config['tusThresholdBytes'],
];
?>
<!doctype html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#111827">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <title>Media Transfer</title>
    <link rel="stylesheet" href="assets/style.css?v=4">
</head>
<body>
    <main class="page-shell">
        <header class="hero">
            <div>
                <p class="eyebrow">PC ↔ iPhone</p>
                <h1>Media Transfer</h1>
                <p class="hero-copy">Chuyển ảnh, video và audio qua Supabase Storage mà không resize hay nén lại file.</p>
            </div>
            <button id="refreshBtn" class="btn btn-secondary btn-compact" type="button" aria-label="Tải lại danh sách">↻ Tải lại</button>
        </header>

        <section class="notice" aria-label="Lưu ý bảo mật">
            <strong>Không có đăng nhập.</strong>
            Ai biết địa chỉ website có thể xem, upload và xóa file. Đừng chia sẻ URL công khai.
        </section>

        <section class="upload-panel" aria-labelledby="uploadTitle">
            <div class="section-heading">
                <div>
                    <h2 id="uploadTitle">Gửi file</h2>
                    <p>Tối đa <span id="maxSizeLabel">50 MB</span>/file. File lớn hơn 6 MB dùng resumable upload.</p>
                </div>
            </div>

            <div class="upload-destination">
                <label for="uploadGroup">Lưu vào nhóm</label>
                <select id="uploadGroup"><option value="">Chưa phân nhóm</option></select>
            </div>

            <label id="dropZone" class="drop-zone" for="fileInput">
                <input
                    id="fileInput"
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*,.heic,.heif,.mov,.m4v,.m4a,.aac"
                >
                <span class="drop-icon" aria-hidden="true">＋</span>
                <strong>Chọn ảnh / video / audio</strong>
                <span>Trên PC có thể kéo file thả vào đây</span>
            </label>

            <div class="iphone-tip">
                <strong>Muốn giữ file gốc từ iPhone:</strong> với ảnh/video quan trọng, hãy Share → Save to Files rồi chọn file từ Files khi upload. Photo Library có thể chuyển đổi định dạng trong một số trường hợp.
            </div>

            <div id="uploadQueue" class="upload-queue" hidden></div>
        </section>

        <section class="library-panel" aria-labelledby="libraryTitle">
            <div class="library-layout">
                <aside class="groups-panel" aria-labelledby="groupsTitle">
                    <div class="groups-heading">
                        <h2 id="groupsTitle">Nhóm file</h2>
                        <span id="groupCount" class="muted-count">0 nhóm</span>
                    </div>
                    <div id="groupList" class="group-list" role="group" aria-label="Chọn nhóm file"></div>
                    <form id="createGroupForm" class="create-group-form">
                        <label for="newGroupName">Tạo nhóm mới</label>
                        <div class="create-group-row">
                            <input id="newGroupName" type="text" maxlength="40" placeholder="Ví dụ: Du lịch" required>
                            <button id="createGroupBtn" class="btn btn-primary" type="submit">Tạo</button>
                        </div>
                    </form>
                    <button id="deleteGroupBtn" class="btn btn-danger group-delete" type="button" hidden>Xóa nhóm này</button>
                </aside>

                <div class="library-content">
                    <div class="section-heading library-heading">
                        <div>
                            <h2 id="libraryTitle">File của bạn</h2>
                            <p id="librarySummary">Đang tải danh sách…</p>
                        </div>
                    </div>

                    <div class="search-filters">
                        <label class="search-field" for="searchInput">
                            <span class="sr-only">Tìm theo tên file</span>
                            <input id="searchInput" type="search" placeholder="Tìm theo tên file…" autocomplete="off">
                        </label>
                        <div class="filter-row" role="group" aria-label="Lọc loại media">
                            <button class="filter-btn active" data-filter="all" type="button">Tất cả</button>
                            <button class="filter-btn" data-filter="image" type="button">Ảnh</button>
                            <button class="filter-btn" data-filter="video" type="button">Video</button>
                            <button class="filter-btn" data-filter="audio" type="button">Audio</button>
                        </div>
                        <details class="advanced-filters" id="advancedFilters">
                            <summary>Kích thước và ngày tải lên</summary>
                            <div class="filter-fields">
                                <label>Từ MB<input id="minSize" type="number" min="0" step="0.1" inputmode="decimal" placeholder="0"></label>
                                <label>Đến MB<input id="maxSize" type="number" min="0" step="0.1" inputmode="decimal" placeholder="Không giới hạn"></label>
                                <label>Từ ngày<input id="dateFrom" type="date"></label>
                                <label>Đến ngày<input id="dateTo" type="date"></label>
                            </div>
                            <button id="clearFiltersBtn" class="btn btn-secondary btn-compact" type="button">Xóa bộ lọc</button>
                        </details>
                    </div>

                    <div class="iphone-tip" id="saveToPhotosTip" hidden>
                        <strong>Lưu vào thư viện Ảnh trên iPhone:</strong> nếu có nút <strong>Lưu vào Ảnh</strong>, chạm nút đó và chọn <strong>Lưu hình ảnh</strong> hoặc <strong>Lưu video</strong> trong bảng chia sẻ. Nếu có nút <strong>Mở ảnh để lưu</strong>, nhấn giữ ảnh trong khung xem rồi chọn lưu. Nút <strong>Tải vào Files</strong> lưu trong ứng dụng Tệp, không vào Ảnh.
                    </div>

                    <div id="loadingState" class="state-box">Đang kết nối Supabase…</div>
                    <div id="emptyState" class="state-box" hidden>Chưa có file nào. Hãy upload file đầu tiên ở phía trên.</div>
                    <div id="errorState" class="state-box state-error" hidden></div>
                    <div id="gallery" class="gallery" hidden></div>
                </div>
            </div>
        </section>
    </main>

    <div id="previewModal" class="modal" hidden>
        <div class="modal-backdrop" data-close-modal></div>
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="previewTitle">
            <div class="modal-header">
                <div class="modal-title-wrap">
                    <h2 id="previewTitle">Xem file</h2>
                    <p id="previewMeta"></p>
                </div>
                <button class="icon-btn" type="button" data-close-modal aria-label="Đóng">×</button>
            </div>
            <div id="previewBody" class="preview-body"></div>
            <p id="previewSaveTip" class="preview-save-tip" hidden></p>
            <div id="modalActions" class="modal-actions">
                <button id="shareFromModalBtn" class="btn btn-primary" type="button">Chia sẻ / Lưu vào Ảnh</button>
                <button id="downloadFromModalBtn" class="btn btn-secondary" type="button">Tải file gốc</button>
            </div>
        </section>
    </div>

    <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>

    <script>
        window.MEDIA_APP_CONFIG = <?= json_encode($publicConfig, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="https://cdn.jsdelivr.net/npm/tus-js-client@4/dist/tus.min.js"></script>
    <script src="assets/app.js?v=4" defer></script>
</body>
</html>
