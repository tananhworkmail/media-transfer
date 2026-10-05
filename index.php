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
    <meta name="theme-color" content="#f5f7fc">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <title>Media Transfer</title>
    <link rel="stylesheet" href="assets/style.css?v=6">
</head>
<body>
    <main class="page-shell">
        <header class="hero">
            <div class="brand-lockup">
                <div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
                <div>
                    <p class="eyebrow">PC ↔ iPhone · Thư viện cá nhân</p>
                    <h1>Media Transfer</h1>
                    <p class="hero-copy">Ảnh, video và audio của bạn, giữ nguyên chất lượng gốc.</p>
                </div>
            </div>
            <button id="refreshBtn" class="btn btn-secondary btn-compact refresh-btn" type="button" aria-label="Tải lại danh sách"><span aria-hidden="true">↻</span> <span>Làm mới</span></button>
        </header>

        <section class="notice" aria-label="Lưu ý bảo mật">
            <span class="notice-icon" aria-hidden="true">!</span>
            <span><strong>Liên kết này cho phép truy cập trực tiếp.</strong> Ai có địa chỉ website đều có thể xem, tải lên và xóa file. Chỉ chia sẻ với người bạn tin tưởng.</span>
        </section>

        <section class="library-panel" aria-labelledby="libraryTitle">
            <div class="library-layout">
                <aside class="groups-panel" aria-labelledby="groupsTitle">
                    <div class="groups-heading">
                        <h2 id="groupsTitle">Nhóm file</h2>
                        <span id="groupCount" class="muted-count">0 nhóm</span>
                    </div>
                    <div id="groupList" class="group-list" role="group" aria-label="Chọn nhóm file"></div>
                    <details id="createGroupDisclosure" class="create-group-disclosure">
                        <summary><span aria-hidden="true">＋</span> Tạo nhóm mới</summary>
                        <form id="createGroupForm" class="create-group-form">
                            <label for="newGroupName">Tên nhóm</label>
                            <div class="create-group-row">
                                <input id="newGroupName" type="text" maxlength="40" placeholder="Ví dụ: Du lịch" required>
                                <button id="createGroupBtn" class="btn btn-primary" type="submit">Tạo</button>
                            </div>
                        </form>
                    </details>
                    <button id="deleteGroupBtn" class="btn btn-danger group-delete" type="button" hidden>Xóa nhóm này</button>
                </aside>

                <div class="library-content">
                    <div class="section-heading library-heading">
                        <div>
                            <h2 id="libraryTitle">File của bạn</h2>
                            <p id="librarySummary" aria-live="polite">Đang tải danh sách…</p>
                        </div>
                        <button id="openUploadBtn" class="btn btn-primary upload-trigger" type="button" aria-label="Mở hộp thoại tải file lên"><span class="plus-icon" aria-hidden="true">＋</span><span class="upload-trigger-label">Tải file lên</span></button>
                    </div>

                    <div class="search-filters">
                        <label class="search-field" for="searchInput">
                            <span class="sr-only">Tìm theo tên file</span>
                            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="10.8" cy="10.8" r="6.6" stroke="currentColor" stroke-width="1.9"/><path d="m16 16 4.2 4.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
                            <input id="searchInput" type="search" placeholder="Tìm theo tên file…" autocomplete="off">
                        </label>
                        <div class="filter-row" role="group" aria-label="Lọc loại media">
                            <button class="filter-btn active" data-filter="all" type="button">Tất cả</button>
                            <button class="filter-btn" data-filter="image" type="button">Ảnh</button>
                            <button class="filter-btn" data-filter="video" type="button">Video</button>
                            <button class="filter-btn" data-filter="audio" type="button">Audio</button>
                        </div>
                        <details class="advanced-filters" id="advancedFilters">
                            <summary>Bộ lọc nâng cao</summary>
                            <div class="filter-fields">
                                <label>Từ MB<input id="minSize" type="number" min="0" step="0.1" inputmode="decimal" placeholder="0"></label>
                                <label>Đến MB<input id="maxSize" type="number" min="0" step="0.1" inputmode="decimal" placeholder="Không giới hạn"></label>
                                <label>Từ ngày<input id="dateFrom" type="date"></label>
                                <label>Đến ngày<input id="dateTo" type="date"></label>
                            </div>
                        </details>
                        <button id="clearFiltersBtn" class="clear-filters-btn" type="button" hidden>Xóa bộ lọc</button>
                    </div>

                    <details class="iphone-tip" id="saveToPhotosTip" hidden>
                        <summary>Lưu file vào thư viện Ảnh trên iPhone như thế nào?</summary>
                        <p>Nút <strong>Lưu vào Ảnh</strong> mở bảng chia sẻ; chọn <strong>Lưu hình ảnh</strong> hoặc <strong>Lưu video</strong>. Nếu hiện <strong>Mở ảnh để lưu</strong>, nhấn giữ ảnh trong khung xem. Nút <strong>Tải vào Files</strong> lưu trong ứng dụng Tệp.</p>
                    </details>

                    <div id="loadingState" class="state-box">Đang kết nối Supabase…</div>
                    <div id="emptyState" class="state-box empty-state" hidden>
                        <div class="empty-icon" aria-hidden="true">▧</div>
                        <h3 id="emptyTitle">Chưa có file nào</h3>
                        <p id="emptyMessage">Nhấn dấu + để tải file đầu tiên.</p>
                        <div class="empty-actions">
                            <button id="emptyUploadBtn" class="btn btn-primary" type="button">＋ Tải file lên</button>
                            <button id="emptyClearBtn" class="btn btn-secondary" type="button" hidden>Xóa bộ lọc</button>
                        </div>
                    </div>
                    <div id="errorState" class="state-box state-error" hidden></div>
                    <div id="listTools" class="list-tools">
                        <button id="selectPageBtn" class="btn btn-secondary btn-compact" type="button" disabled>Chọn trang này</button>
                        <div class="list-tools-right">
                            <span id="pageRange" class="muted-count"></span>
                            <label class="sort-control">Sắp xếp <select id="sortSelect" aria-label="Sắp xếp file"><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option><option value="name">Tên A–Z</option><option value="largest">Lớn nhất</option></select></label>
                        </div>
                    </div>
                    <div id="selectionToolbar" class="selection-toolbar" hidden>
                        <strong id="selectionCount">0 file đã chọn</strong>
                        <div class="selection-actions">
                            <button id="downloadSelectedBtn" class="btn btn-secondary" type="button">Tải ZIP</button>
                            <button id="moveSelectedBtn" class="btn btn-secondary" type="button">Di chuyển</button>
                            <button id="deleteSelectedBtn" class="btn btn-danger" type="button">Xóa</button>
                            <button id="clearSelectionBtn" class="btn btn-secondary" type="button">Bỏ chọn</button>
                        </div>
                        <span id="batchStatus" class="batch-status" role="status"></span>
                    </div>
                    <div id="gallery" class="gallery" hidden></div>
                    <nav id="pagination" class="pagination" aria-label="Phân trang file" hidden>
                        <button id="previousPageBtn" class="btn btn-secondary btn-compact" type="button">← Trước</button>
                        <span id="pageInfo"></span>
                        <button id="nextPageBtn" class="btn btn-secondary btn-compact" type="button">Sau →</button>
                    </nav>
                </div>
            </div>
        </section>
    </main>

    <div id="uploadModal" class="modal" hidden>
        <div class="modal-backdrop" data-close-upload></div>
        <section class="modal-card upload-modal-card" role="dialog" aria-modal="true" aria-labelledby="uploadTitle">
            <div class="modal-header">
                <div class="modal-title-wrap">
                    <h2 id="uploadTitle">Tải file lên</h2>
                    <p>Tối đa <span id="maxSizeLabel">50 MB</span>/file. File lớn dùng resumable upload.</p>
                </div>
                <button class="icon-btn" type="button" data-close-upload aria-label="Đóng">×</button>
            </div>
            <div class="upload-modal-content">
                <div class="upload-destination">
                    <label for="uploadGroup">Lưu vào nhóm</label>
                    <select id="uploadGroup"><option value="">Chưa phân nhóm</option></select>
                </div>
                <label id="dropZone" class="drop-zone" for="fileInput">
                    <input id="fileInput" type="file" multiple accept="image/*,video/*,audio/*,.heic,.heif,.mov,.m4v,.m4a,.aac">
                    <span class="drop-icon" aria-hidden="true">＋</span>
                    <strong>Chọn ảnh / video / audio</strong>
                    <span>Trên PC có thể kéo file thả vào đây</span>
                </label>
                <div class="iphone-tip">
                    <strong>Giữ file gốc từ iPhone:</strong> hãy lưu ảnh/video vào Tệp rồi chọn từ Tệp khi upload. iOS có thể đổi định dạng nếu chọn từ thư viện Ảnh.
                </div>
                <div id="uploadQueue" class="upload-queue" hidden></div>
            </div>
        </section>
    </div>

    <div id="moveModal" class="modal" hidden>
        <div class="modal-backdrop" data-close-move></div>
        <section class="modal-card move-modal-card" role="dialog" aria-modal="true" aria-labelledby="moveTitle">
            <div class="modal-header">
                <div class="modal-title-wrap">
                    <h2 id="moveTitle">Di chuyển file</h2>
                    <p id="moveSummary"></p>
                </div>
                <button class="icon-btn" type="button" data-close-move aria-label="Đóng">×</button>
            </div>
            <div class="move-content">
                <label for="moveTarget">Chuyển đến nhóm</label>
                <select id="moveTarget"></select>
                <p>File sẽ giữ nguyên nội dung và tên gốc.</p>
                <button id="confirmMoveBtn" class="btn btn-primary" type="button">Di chuyển</button>
            </div>
        </section>
    </div>

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
    <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
    <script src="assets/app.js?v=6" defer></script>
</body>
</html>
