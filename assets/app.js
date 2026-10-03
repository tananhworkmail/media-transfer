(() => {
    'use strict';

    const config = window.MEDIA_APP_CONFIG;
    if (!config || !window.supabase || !window.tus) {
        document.body.innerHTML = '<p style="padding:20px;font-family:sans-serif">Không tải được thư viện cần thiết. Hãy kiểm tra kết nối Internet/CDN.</p>';
        return;
    }

    const client = window.supabase.createClient(config.supabaseUrl, config.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const bucket = client.storage.from(config.bucket);

    const els = {
        fileInput: document.getElementById('fileInput'),
        dropZone: document.getElementById('dropZone'),
        uploadQueue: document.getElementById('uploadQueue'),
        uploadGroup: document.getElementById('uploadGroup'),
        gallery: document.getElementById('gallery'),
        groupList: document.getElementById('groupList'),
        groupCount: document.getElementById('groupCount'),
        createGroupForm: document.getElementById('createGroupForm'),
        newGroupName: document.getElementById('newGroupName'),
        createGroupBtn: document.getElementById('createGroupBtn'),
        deleteGroupBtn: document.getElementById('deleteGroupBtn'),
        libraryTitle: document.getElementById('libraryTitle'),
        searchInput: document.getElementById('searchInput'),
        minSize: document.getElementById('minSize'),
        maxSize: document.getElementById('maxSize'),
        dateFrom: document.getElementById('dateFrom'),
        dateTo: document.getElementById('dateTo'),
        advancedFilters: document.getElementById('advancedFilters'),
        clearFiltersBtn: document.getElementById('clearFiltersBtn'),
        loadingState: document.getElementById('loadingState'),
        emptyState: document.getElementById('emptyState'),
        errorState: document.getElementById('errorState'),
        librarySummary: document.getElementById('librarySummary'),
        maxSizeLabel: document.getElementById('maxSizeLabel'),
        refreshBtn: document.getElementById('refreshBtn'),
        filterButtons: [...document.querySelectorAll('.filter-btn')],
        modal: document.getElementById('previewModal'),
        previewTitle: document.getElementById('previewTitle'),
        previewMeta: document.getElementById('previewMeta'),
        previewBody: document.getElementById('previewBody'),
        previewSaveTip: document.getElementById('previewSaveTip'),
        modalActions: document.getElementById('modalActions'),
        shareFromModalBtn: document.getElementById('shareFromModalBtn'),
        downloadFromModalBtn: document.getElementById('downloadFromModalBtn'),
        toast: document.getElementById('toast'),
    };

    let allFiles = [];
    let groups = [];
    let selectedGroup = 'all';
    let currentFilter = 'all';
    let currentPreview = null;
    let toastTimer = null;
    let uploadBusy = false;
    let shareBusy = false;
    let preparedShare = null;
    const unshareableNames = new Set();
    const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    document.getElementById('saveToPhotosTip').hidden = !isAppleMobile;

    function isPhotoMedia(item) {
        return item.kind === 'image' || item.kind === 'video';
    }

    function shareLabel(item) {
        if (isPhotoMedia(item) &&
            (!navigator.share || !navigator.canShare || unshareableNames.has(item.path))) {
            return isAppleMobile
                ? (item.kind === 'image' ? 'Mở ảnh để lưu' : 'Cách lưu video')
                : 'Xem file';
        }
        return isAppleMobile && isPhotoMedia(item) ? 'Lưu vào Ảnh' : 'Lưu / Chia sẻ';
    }

    els.maxSizeLabel.textContent = formatBytes(config.maxFileSizeBytes);

    function formatBytes(bytes) {
        const n = Number(bytes || 0);
        if (!Number.isFinite(n) || n <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
        const value = n / Math.pow(1024, i);
        return `${value >= 10 || i === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
    }

    function formatDate(value) {
        if (!value) return 'Không rõ ngày';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Không rõ ngày';
        return new Intl.DateTimeFormat('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }).format(date);
    }

    function utf8ToBase64Url(value) {
        const bytes = new TextEncoder().encode(value);
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }

    function base64UrlToUtf8(value) {
        try {
            const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
            const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
            const binary = atob(padded);
            const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
            return new TextDecoder().decode(bytes);
        } catch (_) {
            return null;
        }
    }

    function getExtension(name) {
        const match = String(name || '').match(/\.([A-Za-z0-9]{1,10})$/);
        return match ? match[1].toLowerCase() : '';
    }

    function buildStoredName(originalName) {
        const encoded = utf8ToBase64Url(originalName || 'file');
        const ext = getExtension(originalName).replace(/[^a-z0-9]/g, '');
        const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        return `${Date.now()}-${id}__${encoded}${ext ? `.${ext}` : ''}`;
    }

    function originalNameFromStored(storedName) {
        const divider = storedName.indexOf('__');
        if (divider === -1) return storedName;
        const encodedWithExt = storedName.slice(divider + 2);
        const lastDot = encodedWithExt.lastIndexOf('.');
        const encoded = lastDot > 0 ? encodedWithExt.slice(0, lastDot) : encodedWithExt;
        return base64UrlToUtf8(encoded) || storedName;
    }

    const GROUPS_PATH = 'groups';
    const GROUP_MARKER = '__group_marker.png';
    const GROUP_MARKER_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8ZkAAAAASUVORK5CYII=';

    function parseGroupFolder(folder) {
        if (folder.id !== null) return null;
        const match = folder.name.match(/^g-[a-z0-9-]+__([A-Za-z0-9_-]+)$/);
        if (!match) return null;
        const name = base64UrlToUtf8(match[1]);
        if (!name) return null;
        return { id: folder.name, name, path: `${GROUPS_PATH}/${folder.name}` };
    }

    function normalizeSearch(value) {
        return String(value || '').toLocaleLowerCase('vi-VN').normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    }

    function inferMime(name, supplied = '') {
        if (supplied && supplied !== 'application/octet-stream') return supplied;
        const ext = getExtension(name);
        const map = {
            jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
            heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', avif: 'image/avif',
            mov: 'video/quicktime', mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mpg: 'video/mpeg', mpeg: 'video/mpeg',
            mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac'
        };
        return map[ext] || 'application/octet-stream';
    }

    function mediaKind(name, mime = '') {
        const type = inferMime(name, mime);
        if (type.startsWith('image/')) return 'image';
        if (type.startsWith('video/')) return 'video';
        if (type.startsWith('audio/')) return 'audio';
        return 'other';
    }

    function isAllowedMedia(file) {
        return ['image', 'video', 'audio'].includes(mediaKind(file.name, file.type));
    }

    function publicUrl(path) {
        return bucket.getPublicUrl(path).data.publicUrl;
    }

    function downloadUrl(item) {
        const url = new URL(item.publicUrl);
        url.searchParams.set('download', item.originalName);
        return url.toString();
    }

    function showToast(message, duration = 3200) {
        clearTimeout(toastTimer);
        els.toast.textContent = message;
        els.toast.hidden = false;
        toastTimer = setTimeout(() => { els.toast.hidden = true; }, duration);
    }

    function setError(message) {
        els.loadingState.hidden = true;
        els.emptyState.hidden = true;
        els.gallery.hidden = true;
        els.errorState.textContent = message;
        els.errorState.hidden = false;
    }

    async function listAll(path) {
        const items = [];
        const limit = 1000;
        for (let offset = 0; ; offset += limit) {
            const { data, error } = await bucket.list(path, {
                limit,
                offset,
                sortBy: { column: 'name', order: 'desc' },
            });
            if (error) throw error;
            items.push(...(data || []));
            if (!data || data.length < limit) return items;
        }
    }

    function fileFromEntry(item, group) {
        const path = group ? `${group.path}/${item.name}` : item.name;
        const originalName = originalNameFromStored(item.name);
        const mime = inferMime(originalName, item.metadata?.mimetype || item.metadata?.contentType || '');
        return {
            ...item,
            path,
            groupId: group?.id || '',
            originalName,
            mime,
            kind: mediaKind(originalName, mime),
            size: Number(item.metadata?.size || 0),
            publicUrl: publicUrl(path),
        };
    }

    async function loadFiles() {
        els.refreshBtn.disabled = true;
        els.errorState.hidden = true;
        els.emptyState.hidden = true;
        els.gallery.hidden = true;
        els.loadingState.hidden = false;
        els.loadingState.textContent = 'Đang tải danh sách file…';

        try {
            const [rootEntries, groupEntries] = await Promise.all([listAll(''), listAll(GROUPS_PATH)]);
            groups = groupEntries.map(parseGroupFolder).filter(Boolean)
                .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
            const groupFiles = await Promise.all(groups.map(async group =>
                (await listAll(group.path))
                    .filter(item => item.id !== null && item.name !== GROUP_MARKER)
                    .map(item => fileFromEntry(item, group))
            ));
            allFiles = [
                ...rootEntries.filter(item => item.id !== null).map(item => fileFromEntry(item, null)),
                ...groupFiles.flat(),
            ].sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
            if (selectedGroup !== 'all' && selectedGroup !== 'root' && !groups.some(group => group.id === selectedGroup)) {
                selectedGroup = 'all';
            }
            renderUploadGroups();

            els.loadingState.hidden = true;
            renderGallery();
            return true;
        } catch (error) {
            console.error(error);
            setError(`Không đọc được bucket “${config.bucket}”. Hãy kiểm tra bucket đã tạo, đã Public và SQL policy SELECT đã được chạy. Chi tiết: ${error.message || error}`);
            return false;
        } finally {
            els.refreshBtn.disabled = false;
        }
    }

    function renderUploadGroups() {
        const previous = els.uploadGroup.value;
        els.uploadGroup.replaceChildren(new Option('Chưa phân nhóm', ''));
        groups.forEach(group => els.uploadGroup.add(new Option(group.name, group.id)));
        els.uploadGroup.value = groups.some(group => group.id === previous) ? previous : '';
    }

    function renderGroups() {
        const countFor = id => allFiles.filter(file => id === 'all' || (id === 'root' ? !file.groupId : file.groupId === id)).length;
        const choices = [
            { id: 'all', name: 'Tất cả file' },
            { id: 'root', name: 'Chưa phân nhóm' },
            ...groups,
        ];
        const fragment = document.createDocumentFragment();
        choices.forEach(group => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'group-item';
            button.classList.toggle('active', selectedGroup === group.id);
            button.setAttribute('aria-pressed', String(selectedGroup === group.id));
            const name = document.createElement('span');
            name.textContent = group.name;
            const count = document.createElement('span');
            count.className = 'group-item-count';
            count.textContent = countFor(group.id);
            button.append(name, count);
            button.addEventListener('click', () => {
                selectedGroup = group.id;
                els.uploadGroup.value = group.id === 'all' || group.id === 'root' ? '' : group.id;
                renderGallery();
            });
            fragment.appendChild(button);
        });
        els.groupList.replaceChildren(fragment);
        els.groupCount.textContent = `${groups.length} nhóm`;
        els.deleteGroupBtn.hidden = selectedGroup === 'all' || selectedGroup === 'root';
    }

    function localDayStart(value, nextDay = false) {
        if (!value) return null;
        const date = new Date(`${value}T00:00:00`);
        if (nextDay) date.setDate(date.getDate() + 1);
        return date.getTime();
    }

    function renderGallery() {
        const group = groups.find(item => item.id === selectedGroup);
        const scoped = allFiles.filter(file => selectedGroup === 'all' ||
            (selectedGroup === 'root' ? !file.groupId : file.groupId === selectedGroup));
        const query = normalizeSearch(els.searchInput.value.trim());
        const minSize = els.minSize.value === '' ? null : Number(els.minSize.value) * 1024 * 1024;
        const maxSize = els.maxSize.value === '' ? null : Number(els.maxSize.value) * 1024 * 1024;
        const dateFrom = localDayStart(els.dateFrom.value);
        const dateTo = localDayStart(els.dateTo.value, true);
        const advancedActive = [els.minSize, els.maxSize, els.dateFrom, els.dateTo].some(input => input.value !== '');
        els.advancedFilters.classList.toggle('has-active-filters', advancedActive);
        els.advancedFilters.querySelector('summary').textContent = advancedActive
            ? 'Kích thước và ngày tải lên • Đang lọc'
            : 'Kích thước và ngày tải lên';
        const visible = scoped.filter(file => {
            if (currentFilter !== 'all' && file.kind !== currentFilter) return false;
            if (query && !normalizeSearch(file.originalName).includes(query)) return false;
            if (minSize !== null && file.size < minSize) return false;
            if (maxSize !== null && file.size > maxSize) return false;
            const uploaded = Date.parse(file.created_at);
            if (dateFrom !== null && !(uploaded >= dateFrom)) return false;
            if (dateTo !== null && !(uploaded < dateTo)) return false;
            return true;
        });
        const totalBytes = visible.reduce((sum, item) => sum + (item.size || 0), 0);
        els.libraryTitle.textContent = group?.name || (selectedGroup === 'root' ? 'Chưa phân nhóm' : 'File của bạn');
        els.librarySummary.textContent = `${visible.length}/${scoped.length} file • ${formatBytes(totalBytes)}`;
        renderGroups();
        els.gallery.replaceChildren();
        els.errorState.hidden = true;

        if (!scoped.length) {
            els.gallery.hidden = true;
            els.emptyState.textContent = selectedGroup === 'all'
                ? 'Chưa có file nào. Hãy upload file đầu tiên ở phía trên.'
                : selectedGroup === 'root'
                    ? 'Chưa có file chưa phân nhóm. Chọn “Chưa phân nhóm” ở phần Gửi file để tải lên.'
                    : 'Nhóm này chưa có file. Chọn nhóm ở phần Gửi file để tải lên.';
            els.emptyState.hidden = false;
            return;
        }

        els.emptyState.hidden = true;
        els.gallery.hidden = false;

        if (!visible.length) {
            const box = document.createElement('div');
            box.className = 'state-box';
            box.style.gridColumn = '1 / -1';
            box.textContent = 'Không có file phù hợp. Hãy thử đổi từ khóa hoặc bộ lọc.';
            els.gallery.appendChild(box);
            return;
        }

        const fragment = document.createDocumentFragment();
        visible.forEach(item => fragment.appendChild(createMediaCard(item)));
        els.gallery.appendChild(fragment);
    }

    async function createGroup(event) {
        event.preventDefault();
        const name = els.newGroupName.value.trim().replace(/\s+/g, ' ');
        if (!name || name.length > 40) {
            showToast('Tên nhóm phải có từ 1 đến 40 ký tự.');
            return;
        }
        if (groups.some(group => normalizeSearch(group.name) === normalizeSearch(name))) {
            showToast('Nhóm này đã tồn tại.');
            return;
        }
        const uniqueId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const id = `g-${uniqueId}__${utf8ToBase64Url(name)}`;
        const markerPath = `${GROUPS_PATH}/${id}/${GROUP_MARKER}`;
        const markerBytes = Uint8Array.from(atob(GROUP_MARKER_PNG), char => char.charCodeAt(0));
        els.createGroupBtn.disabled = true;
        try {
            const { error } = await bucket.upload(markerPath, new Blob([markerBytes], { type: 'image/png' }), {
                contentType: 'image/png', upsert: false,
            });
            if (error) throw error;
            els.newGroupName.value = '';
            selectedGroup = id;
            const loaded = await loadFiles();
            els.uploadGroup.value = id;
            showToast(loaded ? `Đã tạo nhóm “${name}”.` : 'Nhóm đã tạo nhưng chưa tải được danh sách. Hãy thử Làm mới.');
        } catch (error) {
            console.error(error);
            showToast(`Không tạo được nhóm: ${error.message || error}`, 6000);
        } finally {
            els.createGroupBtn.disabled = false;
        }
    }

    async function listGroupFilePaths(path, rootPath = path) {
        const entries = await listAll(path);
        const files = entries
            .filter(item => item.id !== null && !(path === rootPath && item.name === GROUP_MARKER))
            .map(item => `${path}/${item.name}`);
        const nested = await Promise.all(entries.filter(item => item.id === null)
            .map(item => listGroupFilePaths(`${path}/${item.name}`, rootPath)));
        return [...files, ...nested.flat()];
    }

    async function deleteGroup() {
        if (uploadBusy) {
            showToast('Hãy chờ tải file lên xong trước khi xóa nhóm.');
            return;
        }
        const group = groups.find(item => item.id === selectedGroup);
        if (!group) return;
        els.deleteGroupBtn.disabled = true;
        try {
            const paths = await listGroupFilePaths(group.path);
            const confirmed = confirm(`Xóa nhóm “${group.name}” và ${paths.length} file bên trong?\n\nThao tác này xóa vĩnh viễn các file khỏi Supabase Storage.`);
            if (!confirmed) return;
            els.deleteGroupBtn.textContent = 'Đang xóa…';
            for (let i = 0; i < paths.length; i += 100) {
                const { error } = await bucket.remove(paths.slice(i, i + 100));
                if (error) throw error;
            }
            const { error } = await bucket.remove([`${group.path}/${GROUP_MARKER}`]);
            if (error) throw error;
            if (preparedShare?.path.startsWith(`${group.path}/`)) preparedShare = null;
            for (const path of unshareableNames) {
                if (path.startsWith(`${group.path}/`)) unshareableNames.delete(path);
            }
            selectedGroup = 'all';
            els.uploadGroup.value = '';
            const loaded = await loadFiles();
            showToast(loaded ? `Đã xóa nhóm “${group.name}”.` : 'Nhóm đã xóa nhưng chưa tải được danh sách. Hãy thử Làm mới.');
        } catch (error) {
            console.error(error);
            showToast(`Xóa nhóm chưa hoàn tất: ${error.message || error}`, 6000);
            await loadFiles();
        } finally {
            els.deleteGroupBtn.disabled = false;
            els.deleteGroupBtn.textContent = 'Xóa nhóm này';
        }
    }

    function createMediaCard(item) {
        const card = document.createElement('article');
        card.className = 'media-card';

        const preview = document.createElement('button');
        preview.type = 'button';
        preview.className = 'media-preview';
        preview.addEventListener('click', () => openPreview(item));

        if (item.kind === 'image') {
            const img = document.createElement('img');
            img.loading = 'lazy';
            img.alt = item.originalName;
            img.src = item.publicUrl;
            img.addEventListener('error', () => {
                img.remove();
                const icon = document.createElement('span');
                icon.className = 'media-icon';
                icon.textContent = '🖼️';
                preview.prepend(icon);
            }, { once: true });
            preview.appendChild(img);
        } else {
            const icon = document.createElement('span');
            icon.className = 'media-icon';
            icon.textContent = item.kind === 'video' ? '🎬' : item.kind === 'audio' ? '🎵' : '📄';
            preview.appendChild(icon);
        }

        const badge = document.createElement('span');
        badge.className = 'media-kind';
        badge.textContent = item.kind === 'image' ? 'ẢNH' : item.kind === 'video' ? 'VIDEO' : item.kind === 'audio' ? 'AUDIO' : 'FILE';
        preview.appendChild(badge);

        const info = document.createElement('div');
        info.className = 'media-info';

        const name = document.createElement('p');
        name.className = 'media-name';
        name.title = item.originalName;
        name.textContent = item.originalName;

        const meta = document.createElement('p');
        meta.className = 'media-meta';
        meta.textContent = `${formatBytes(item.size)} • ${formatDate(item.created_at)}`;

        const actions = document.createElement('div');
        actions.className = 'card-actions';

        const shareBtn = document.createElement('button');
        shareBtn.type = 'button';
        shareBtn.className = 'btn btn-primary';
        shareBtn.textContent = shareLabel(item);
        shareBtn.addEventListener('click', () => shareItem(item, shareBtn));

        const download = document.createElement('a');
        download.className = 'btn btn-secondary';
        download.href = downloadUrl(item);
        download.textContent = isAppleMobile ? 'Tải vào Files' : 'Tải gốc';
        download.setAttribute('download', item.originalName);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn-danger delete-btn';
        deleteBtn.textContent = 'Xóa';
        deleteBtn.addEventListener('click', () => deleteItem(item, deleteBtn));

        actions.append(shareBtn, download, deleteBtn);
        info.append(name, meta, actions);
        card.append(preview, info);
        return card;
    }

    async function shareItem(item, button) {
        if (shareBusy) return;
        const label = shareLabel(item);
        if (!navigator.share || !navigator.canShare || unshareableNames.has(item.path)) {
            showManualSave(item, button);
            return;
        }
        shareBusy = true;
        try {
            if (preparedShare?.path !== item.path) {
                if (button) { button.disabled = true; button.textContent = 'Đang chuẩn bị…'; }
                const response = await fetch(item.publicUrl);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const blob = await response.blob();
                const mime = item.mime && item.mime !== 'application/octet-stream' ? item.mime : blob.type;
                preparedShare = {
                    path: item.path,
                    file: new File([blob], item.originalName, { type: mime || 'application/octet-stream' }),
                };
                if (button) { button.disabled = false; button.textContent = label; }

                // Safari có thể hết quyền mở Share Sheet sau khi tải file bất đồng bộ.
                // Khi đó cần một lần chạm mới để gọi navigator.share trực tiếp.
                if (!navigator.userActivation?.isActive) {
                    showToast(isAppleMobile && isPhotoMedia(item)
                        ? 'File đã sẵn sàng. Chạm Lưu vào Ảnh lần nữa, rồi chọn Lưu hình ảnh / Lưu video trong bảng chia sẻ.'
                        : `File đã sẵn sàng. Chạm ${label} lần nữa để mở bảng chia sẻ.`, 6500);
                    return;
                }
            }
            const files = [preparedShare.file];
            if (!navigator.canShare({ files })) {
                showManualSave(item, button);
                return;
            }
            await navigator.share({ files });
        } catch (error) {
            if (error?.name === 'AbortError') return;
            console.error(error);
            showManualSave(item, button);
        } finally {
            shareBusy = false;
            if (button) { button.disabled = false; button.textContent = shareLabel(item); }
        }
    }

    function showManualSave(item, button) {
        unshareableNames.add(item.path);
        if (button) button.textContent = shareLabel(item);
        if (isPhotoMedia(item)) {
            openPreview(item);
        } else {
            showToast(`Trình duyệt này không chia sẻ được file. Hãy dùng nút ${isAppleMobile ? 'Tải vào Files' : 'Tải gốc'} để lưu.`, 5500);
        }
    }

    async function deleteItem(item, button) {
        if (!confirm(`Xóa “${item.originalName}”?\n\nThao tác này xóa file khỏi Supabase Storage.`)) return;
        button.disabled = true;
        button.textContent = 'Đang xóa…';
        try {
            const { error } = await bucket.remove([item.path]);
            if (error) throw error;
            allFiles = allFiles.filter(file => file.path !== item.path);
            if (preparedShare?.path === item.path) preparedShare = null;
            unshareableNames.delete(item.path);
            if (currentPreview?.path === item.path) closePreview();
            renderGallery();
            showToast('Đã xóa file.');
        } catch (error) {
            console.error(error);
            showToast(`Xóa thất bại: ${error.message || error}`, 5000);
            button.disabled = false;
            button.textContent = 'Xóa';
        }
    }

    function openPreview(item) {
        currentPreview = item;
        const manualSave = isPhotoMedia(item) &&
            (!navigator.share || !navigator.canShare || unshareableNames.has(item.path));
        els.shareFromModalBtn.hidden = manualSave;
        els.modalActions.classList.toggle('single-action', manualSave);
        els.shareFromModalBtn.textContent = shareLabel(item);
        els.downloadFromModalBtn.textContent = isAppleMobile ? 'Tải vào Files' : 'Tải file gốc';
        els.previewSaveTip.hidden = !manualSave;
        if (manualSave) {
            els.previewSaveTip.textContent = item.kind === 'image'
                ? (isAppleMobile
                    ? 'Nhấn giữ ảnh bên dưới rồi chọn Lưu vào Ảnh. Nếu không có tùy chọn này, hãy mở trang bằng Safari.'
                    : 'Bấm chuột phải vào ảnh bên dưới để lưu file.')
                : (isAppleMobile
                    ? 'Trình duyệt không chia sẻ được video này. Chọn Tải vào Files, mở video trong ứng dụng Tệp, rồi dùng Chia sẻ → Lưu video nếu iPhone hỗ trợ định dạng.'
                    : 'Trình duyệt không chia sẻ được video này. Chọn Tải file gốc để lưu.');
        }
        els.previewTitle.textContent = item.originalName;
        els.previewMeta.textContent = `${formatBytes(item.size)} • ${formatDate(item.created_at)}`;
        els.previewBody.replaceChildren();

        let node;
        if (item.kind === 'image') {
            node = document.createElement('img');
            node.src = item.publicUrl;
            node.alt = item.originalName;
        } else if (item.kind === 'video') {
            node = document.createElement('video');
            node.src = item.publicUrl;
            node.controls = true;
            node.playsInline = true;
            node.preload = 'metadata';
        } else if (item.kind === 'audio') {
            node = document.createElement('audio');
            node.src = item.publicUrl;
            node.controls = true;
            node.preload = 'metadata';
        } else {
            node = document.createElement('div');
            node.className = 'preview-fallback';
            node.textContent = 'Trình duyệt không xem trước được loại file này. Bạn vẫn có thể tải file gốc.';
        }
        els.previewBody.appendChild(node);
        els.modal.hidden = false;
        document.body.classList.add('modal-open');
    }

    function closePreview() {
        els.modal.hidden = true;
        document.body.classList.remove('modal-open');
        els.previewBody.replaceChildren();
        currentPreview = null;
    }

    function createQueueRow(file) {
        els.uploadQueue.hidden = false;
        const row = document.createElement('div');
        row.className = 'upload-item';
        row.innerHTML = `
            <div class="upload-item-top">
                <div class="upload-name"></div>
                <div class="upload-status">Chờ…</div>
            </div>
            <div class="progress-track"><div class="progress-bar"></div></div>
        `;
        row.querySelector('.upload-name').textContent = `${file.name} • ${formatBytes(file.size)}`;
        els.uploadQueue.appendChild(row);
        return {
            row,
            bar: row.querySelector('.progress-bar'),
            status: row.querySelector('.upload-status'),
            setProgress(percent) {
                const p = Math.max(0, Math.min(100, Number(percent) || 0));
                this.bar.style.width = `${p}%`;
                this.status.textContent = `${p.toFixed(p < 10 ? 1 : 0)}%`;
            },
            success() {
                row.classList.add('is-success');
                this.bar.style.width = '100%';
                this.status.textContent = 'Xong';
            },
            error(message) {
                row.classList.add('is-error');
                this.status.textContent = message;
            }
        };
    }

    async function uploadSelected(files) {
        if (uploadBusy) {
            showToast('Đang có lượt upload khác. Hãy chờ lượt hiện tại hoàn tất.');
            return;
        }

        const list = [...files];
        if (!list.length) return;
        const targetGroup = groups.find(group => group.id === els.uploadGroup.value);
        uploadBusy = true;
        els.uploadGroup.disabled = true;
        els.uploadQueue.replaceChildren();
        els.uploadQueue.hidden = false;

        let completed = 0;
        for (const file of list) {
            const ui = createQueueRow(file);

            if (!isAllowedMedia(file)) {
                ui.error('Không phải media');
                continue;
            }
            if (file.size > config.maxFileSizeBytes) {
                ui.error(`Vượt ${formatBytes(config.maxFileSizeBytes)}`);
                continue;
            }
            if (file.size === 0) {
                ui.error('File rỗng');
                continue;
            }

            const storedName = buildStoredName(file.name);
            const storedPath = targetGroup ? `${targetGroup.path}/${storedName}` : storedName;
            const mime = inferMime(file.name, file.type);
            try {
                if (file.size > config.tusThresholdBytes) {
                    await uploadTus(file, storedPath, mime, ui);
                } else {
                    await uploadStandard(file, storedPath, mime, ui);
                }
                ui.success();
                completed++;
            } catch (error) {
                console.error(error);
                ui.error('Lỗi');
                const detail = error?.message || String(error);
                showToast(`Upload “${file.name}” thất bại: ${detail}`, 6000);
            }
        }

        uploadBusy = false;
        els.uploadGroup.disabled = false;
        els.fileInput.value = '';
        if (completed) {
            showToast(`Đã upload ${completed}/${list.length} file.`);
            selectedGroup = targetGroup?.id || 'root';
            await loadFiles();
        }
    }

    async function uploadStandard(file, storedName, mime, ui) {
        ui.status.textContent = 'Đang upload…';
        ui.bar.style.width = '15%';
        const { error } = await bucket.upload(storedName, file, {
            contentType: mime,
            cacheControl: '3600',
            upsert: false,
            metadata: { originalName: file.name },
        });
        if (error) throw error;
        ui.setProgress(100);
    }

    function uploadTus(file, storedName, mime, ui) {
        return new Promise((resolve, reject) => {
            ui.status.textContent = 'Đang upload resumable…';
            const endpoint = `https://${config.projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
            const folder = storedName.includes('/') ? storedName.slice(0, storedName.lastIndexOf('/')) : '';

            const upload = new window.tus.Upload(file, {
                endpoint,
                fingerprint: input => Promise.resolve(
                    ['media-transfer', config.bucket, folder, input.name, input.size, input.type, input.lastModified].join('::')
                ),
                retryDelays: [0, 3000, 5000, 10000, 20000],
                headers: {
                    apikey: config.publishableKey,
                    authorization: `Bearer ${config.publishableKey}`,
                    'x-upsert': 'false',
                },
                uploadDataDuringCreation: true,
                removeFingerprintOnSuccess: true,
                chunkSize: 6 * 1024 * 1024,
                metadata: {
                    bucketName: config.bucket,
                    objectName: storedName,
                    contentType: mime,
                    cacheControl: '3600',
                    metadata: JSON.stringify({ originalName: file.name }),
                },
                onError(error) { reject(error); },
                onProgress(bytesUploaded, bytesTotal) {
                    ui.setProgress((bytesUploaded / bytesTotal) * 100);
                },
                onSuccess() { resolve(); },
            });

            upload.findPreviousUploads()
                .then(previous => {
                    if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
                    upload.start();
                })
                .catch(reject);
        });
    }

    els.createGroupForm.addEventListener('submit', createGroup);
    els.deleteGroupBtn.addEventListener('click', deleteGroup);
    [els.searchInput, els.minSize, els.maxSize, els.dateFrom, els.dateTo]
        .forEach(input => input.addEventListener('input', renderGallery));
    els.clearFiltersBtn.addEventListener('click', () => {
        [els.searchInput, els.minSize, els.maxSize, els.dateFrom, els.dateTo]
            .forEach(input => { input.value = ''; });
        currentFilter = 'all';
        els.filterButtons.forEach(button => button.classList.toggle('active', button.dataset.filter === 'all'));
        renderGallery();
    });

    els.fileInput.addEventListener('change', event => uploadSelected(event.target.files));
    els.refreshBtn.addEventListener('click', loadFiles);

    ['dragenter', 'dragover'].forEach(type => els.dropZone.addEventListener(type, event => {
        event.preventDefault();
        els.dropZone.classList.add('dragging');
    }));
    ['dragleave', 'drop'].forEach(type => els.dropZone.addEventListener(type, event => {
        event.preventDefault();
        els.dropZone.classList.remove('dragging');
    }));
    els.dropZone.addEventListener('drop', event => uploadSelected(event.dataTransfer.files));

    els.filterButtons.forEach(button => button.addEventListener('click', () => {
        currentFilter = button.dataset.filter;
        els.filterButtons.forEach(btn => btn.classList.toggle('active', btn === button));
        renderGallery();
    }));

    document.querySelectorAll('[data-close-modal]').forEach(node => node.addEventListener('click', closePreview));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !els.modal.hidden) closePreview();
    });

    els.shareFromModalBtn.addEventListener('click', () => {
        if (currentPreview) shareItem(currentPreview, els.shareFromModalBtn);
    });
    els.downloadFromModalBtn.addEventListener('click', () => {
        if (!currentPreview) return;
        window.location.href = downloadUrl(currentPreview);
    });

    loadFiles();
})();
