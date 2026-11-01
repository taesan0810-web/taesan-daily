CREATE TABLE public.music_albums(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL CHECK(length(btrim(title))>0),release_date date,cover_url text NOT NULL DEFAULT '',description text NOT NULL DEFAULT '',source_url text NOT NULL DEFAULT '',sort_order integer NOT NULL DEFAULT 0,published boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.music_works(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL CHECK(length(btrim(title))>0),title_ko text NOT NULL DEFAULT '',title_zh text NOT NULL DEFAULT '',artist text NOT NULL DEFAULT '',album_id uuid REFERENCES public.music_albums(id) ON DELETE SET NULL,
 section text NOT NULL DEFAULT 'taesan' CHECK(section IN ('taesan','boynextdoor')),taesan_role text NOT NULL DEFAULT '',release_date date,sort_order integer NOT NULL DEFAULT 0,
 lyricists text NOT NULL DEFAULT '',composers text NOT NULL DEFAULT '',arrangers text NOT NULL DEFAULT '',description text NOT NULL DEFAULT '',source_url text NOT NULL DEFAULT '' CHECK(source_url='' OR source_url ~ '^https://'),
 cover_path text NOT NULL DEFAULT '',audio_path text NOT NULL DEFAULT '',video_path text NOT NULL DEFAULT '',media_meta jsonb NOT NULL DEFAULT '{}',media_authorized boolean NOT NULL DEFAULT false,
 lyrics_ko text NOT NULL DEFAULT '',lyrics_zh text NOT NULL DEFAULT '',lrc text NOT NULL DEFAULT '',lyrics_authorized boolean NOT NULL DEFAULT false,published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(cover_path='' OR cover_path LIKE id::text || '/%'),CHECK(audio_path='' OR audio_path LIKE id::text || '/%'),CHECK(video_path='' OR video_path LIKE id::text || '/%'),
 CHECK(NOT published OR (audio_path='' AND video_path='') OR media_authorized),CHECK(NOT published OR (lyrics_ko='' AND lyrics_zh='' AND lrc='') OR lyrics_authorized)
);
CREATE INDEX music_works_album ON public.music_works(album_id);
CREATE INDEX music_works_section ON public.music_works(section,sort_order);
CREATE FUNCTION public.music_archive_stamp() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN NEW.updated_at=now(); IF TG_OP='UPDATE' THEN NEW.created_at=OLD.created_at; END IF; RETURN NEW; END $$;
CREATE TRIGGER music_works_stamp BEFORE UPDATE ON public.music_works FOR EACH ROW EXECUTE FUNCTION public.music_archive_stamp();
CREATE TRIGGER music_albums_stamp BEFORE UPDATE ON public.music_albums FOR EACH ROW EXECUTE FUNCTION public.music_archive_stamp();
ALTER TABLE public.music_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_works ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.music_albums,public.music_works TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.music_albums,public.music_works TO authenticated;
CREATE POLICY music_albums_public ON public.music_albums FOR SELECT TO anon,authenticated USING(published);
CREATE POLICY music_albums_admin ON public.music_albums FOR ALL TO authenticated USING((select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid) WITH CHECK((select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid);
CREATE POLICY music_works_public ON public.music_works FOR SELECT TO anon,authenticated USING(published);
CREATE POLICY music_works_admin ON public.music_works FOR ALL TO authenticated USING((select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid) WITH CHECK((select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid);
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('music-media','music-media',false,52428800,ARRAY['audio/mpeg','video/mp4','image/jpeg','image/png','image/webp']);
CREATE POLICY music_media_admin_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='music-media' AND (select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid);
CREATE POLICY music_media_admin_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='music-media' AND (select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid);
CREATE POLICY music_media_admin_delete_unreferenced ON storage.objects FOR DELETE TO authenticated USING(bucket_id='music-media' AND (select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid AND NOT EXISTS(SELECT 1 FROM public.music_works w WHERE storage.objects.name IN (w.cover_path,w.audio_path,w.video_path)));
CREATE POLICY music_media_public_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='music-media' AND EXISTS(SELECT 1 FROM public.music_works w WHERE w.published AND ((storage.objects.name=w.cover_path) OR (w.media_authorized AND storage.objects.name IN (w.audio_path,w.video_path)))));

