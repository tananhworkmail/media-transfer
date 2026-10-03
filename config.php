<?php
/**
 * Cấu hình Media Transfer.
 * Publishable key của Supabase được thiết kế để dùng ở phía trình duyệt.
 * Không đặt sb_secret_* / service_role key trong file này.
 */
return [
    'supabaseUrl' => 'https://cnxvwvykhwvtmpxthvrr.supabase.co',
    'publishableKey' => 'sb_publishable_6RvOHLC_4sykNzxdfeCDtg_Ea4PPIni',
    'projectRef' => 'cnxvwvykhwvtmpxthvrr',
    'bucket' => 'media',

    // Supabase Free hiện cho tối đa 50 MB/file.
    // Nếu project/bucket của bạn có giới hạn thấp hơn, hãy sửa số này cho khớp.
    'maxFileSizeBytes' => 50 * 1024 * 1024,

    // Supabase khuyến nghị TUS resumable upload cho file > 6 MB.
    'tusThresholdBytes' => 6 * 1024 * 1024,
];
