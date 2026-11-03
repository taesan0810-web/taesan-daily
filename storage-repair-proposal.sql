-- REVIEW ONLY. Inspection found the existing video uploader targets a missing bucket.
-- No current bucket, object or policy is removed or replaced.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('daily-videos','daily-videos',true,52428800,array['video/mp4','video/quicktime']);
create policy daily_videos_admin_insert on storage.objects for insert to authenticated
with check(bucket_id='daily-videos' and (select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid);
commit;
