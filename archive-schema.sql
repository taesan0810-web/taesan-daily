-- Applied via Supabase migration add_personal_archive_and_upload_support.
-- Reference snapshot; do not execute again on the deployed project.
create table public.archive_records (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('thoughts','fragments','stage','shorts')),
  title text not null check (length(trim(title)) between 1 and 300),
  public_date date,
  category text not null,
  content_zh text not null default '' check (length(content_zh)<=50000),
  original_ko text not null default '' check (length(original_ko)<=50000),
  event_name text not null default '',
  collaborators text not null default '',
  source text not null default '',
  source_url text not null default '' check (source_url='' or source_url ~ '^https://'),
  cover_url text not null default '' check (cover_url='' or cover_url ~ '^https://'),
  tags text[] not null default '{}' check (cardinality(tags)<=40),
  image_urls text[] not null default '{}',
  images text[] not null default '{}',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  check (kind not in ('thoughts','fragments') or length(trim(content_zh))>0),
  check (kind not in ('stage','shorts') or source_url ~ '^https://')
);
create index archive_records_kind_date_idx on public.archive_records(kind,public_date desc,id);
alter table public.archive_records enable row level security;
grant select on public.archive_records to anon;
grant select,insert,update,delete on public.archive_records to authenticated;
create policy archive_records_read on public.archive_records for select to anon,authenticated using(published);
create policy archive_records_admin on public.archive_records for all to authenticated
  using((select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid)
  with check((select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid);
create table public.journey_locations (
  date date primary key,
  city text not null check(length(trim(city)) between 1 and 100),
  x numeric not null check(x between 8 and 92),
  source_url text not null default '' check(source_url='' or source_url ~ '^https://')
);
alter table public.journey_locations enable row level security;
grant select on public.journey_locations to anon;
grant select,insert,update,delete on public.journey_locations to authenticated;
create policy journey_locations_read on public.journey_locations for select to anon,authenticated using(true);
create policy journey_locations_admin on public.journey_locations for all to authenticated
  using((select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid)
  with check((select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('archive-images','archive-images',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy archive_images_read on storage.objects for select to anon,authenticated
  using(bucket_id='archive-images' and exists(select 1 from public.archive_records r where r.published and storage.objects.name=any(r.images)));
create policy archive_images_admin on storage.objects for all to authenticated
  using(bucket_id='archive-images' and (select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid)
  with check(bucket_id='archive-images' and (select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('daily-videos','daily-videos',true,52428800,array['video/mp4','video/quicktime']);
create policy daily_videos_admin_insert on storage.objects for insert to authenticated
with check(bucket_id='daily-videos' and (select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid);


create policy daily_photos_admin_read on storage.objects for select to authenticated
using(bucket_id='daily-photos' and (select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid);
create policy daily_photos_admin_delete_unreferenced on storage.objects for delete to authenticated
using(bucket_id='daily-photos' and name like 'entries/%'
and (select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid
and not exists(select 1 from public.entries e where
e.photo='https://shwilnzlpychjoasvqtg.supabase.co/storage/v1/object/public/daily-photos/'||storage.objects.name
or e.photos ? ('https://shwilnzlpychjoasvqtg.supabase.co/storage/v1/object/public/daily-photos/'||storage.objects.name))
and not exists(select 1 from public.music_tracks t where t.cover_url='https://shwilnzlpychjoasvqtg.supabase.co/storage/v1/object/public/daily-photos/'||storage.objects.name));
create policy daily_videos_admin_read on storage.objects for select to authenticated
using(bucket_id='daily-videos' and (select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid);

insert into public.journey_locations(date,city,x,source_url) values
('2026-10-01','首尔',14,''),
('2026-10-24','北京',36.5,''),
('2026-10-26','洛杉矶',65,''),
('2026-10-29','达拉斯',85.5,'');
