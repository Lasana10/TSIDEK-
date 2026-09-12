insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'tsidek-vault',
  'tsidek-vault',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg','image/png','image/webp',
    'audio/mpeg','audio/mp4','audio/wav','audio/webm','audio/ogg',
    'video/mp4','video/webm',
    'text/plain'
  ]
)
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
