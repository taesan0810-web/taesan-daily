-- Additive migration. Does not alter existing business tables.
CREATE TABLE public.tmi_categories(name text PRIMARY KEY CHECK(length(btrim(name)) BETWEEN 1 AND 60));
INSERT INTO public.tmi_categories VALUES ('基本资料'),('性格与习惯'),('喜好与讨厌'),('音乐与艺术'),('饮食与生活'),('成长经历'),('有趣的小事'),('语录与想法'),('其他');
CREATE TABLE public.tmi_records(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL DEFAULT '', content_zh text NOT NULL CHECK(length(btrim(content_zh)) BETWEEN 1 AND 50000),
 original_ko text NOT NULL DEFAULT '', translation_zh text NOT NULL DEFAULT '', category text NOT NULL DEFAULT '其他' REFERENCES public.tmi_categories(name),
 tags text[] NOT NULL DEFAULT '{}', life_stage text CHECK(life_stage IN ('上学前','小学','中学','未明确')), public_date date,
 source text NOT NULL DEFAULT '', source_url text NOT NULL DEFAULT '' CHECK(source_url='' OR source_url ~ '^https://'), source_note text NOT NULL DEFAULT '',
 images text[] NOT NULL DEFAULT '{}', published boolean NOT NULL DEFAULT false, search_text text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(upper(btrim(source)) <> 'DM' OR (original_ko='' AND translation_zh='' AND cardinality(images)=0))
);
CREATE FUNCTION public.tmi_prepare() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 NEW.updated_at=now();
 IF TG_OP='UPDATE' THEN NEW.created_at=OLD.created_at; END IF;
 NEW.search_text=NEW.title || ' ' || NEW.content_zh || ' ' || NEW.original_ko || ' ' || NEW.translation_zh || ' ' || array_to_string(NEW.tags,' ');
 RETURN NEW;
END $$;
CREATE TRIGGER tmi_prepare_row BEFORE INSERT OR UPDATE ON public.tmi_records FOR EACH ROW EXECUTE FUNCTION public.tmi_prepare();
CREATE INDEX tmi_records_date ON public.tmi_records(public_date DESC NULLS LAST,id);
CREATE INDEX tmi_records_category ON public.tmi_records(category);
ALTER TABLE public.tmi_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tmi_records ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.tmi_categories,public.tmi_records TO anon,authenticated;
GRANT INSERT ON public.tmi_categories TO authenticated;
GRANT INSERT,UPDATE,DELETE ON public.tmi_records TO authenticated;
CREATE POLICY tmi_categories_read ON public.tmi_categories FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY tmi_categories_add ON public.tmi_categories FOR INSERT TO authenticated WITH CHECK((select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid);
CREATE POLICY tmi_public_read ON public.tmi_records FOR SELECT TO anon,authenticated USING(published);
CREATE POLICY tmi_admin_all ON public.tmi_records FOR ALL TO authenticated USING((select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid) WITH CHECK((select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid);
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('tmi-images','tmi-images',false,5242880,ARRAY['image/jpeg','image/png','image/webp']);
CREATE POLICY tmi_images_admin ON storage.objects FOR ALL TO authenticated USING(bucket_id='tmi-images' AND (select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid) WITH CHECK(bucket_id='tmi-images' AND (select auth.uid())='0c40000a-9f2c-46dc-8ba7-a0b016e6988e'::uuid);
CREATE POLICY tmi_images_published ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='tmi-images' AND EXISTS(SELECT 1 FROM public.tmi_records r WHERE r.published AND storage.objects.name=ANY(r.images)));

