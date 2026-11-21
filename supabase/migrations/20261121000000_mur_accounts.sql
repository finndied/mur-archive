begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mur-archive-photos', 'mur-archive-photos', false, 8000000, array['image/jpeg'])
on conflict (id) do update set
  public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Mur Archive always restrict photos to their owner"
on storage.objects as restrictive for all to public
using (
  bucket_id <> 'mur-archive-photos' or storage.foldername(name) = array[(select auth.uid())::text]
)
with check (
  bucket_id <> 'mur-archive-photos' or storage.foldername(name) = array[(select auth.uid())::text]
);

create policy "Mur Archive read own photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'mur-archive-photos'
  and storage.foldername(name) = array[(select auth.uid())::text]
);

create policy "Mur Archive add own photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'mur-archive-photos'
  and storage.foldername(name) = array[(select auth.uid())::text]
  and storage.filename(name) ~ '^custom-[0-9a-f-]{36}\.[0-9]{13}\.[0-9]{1,4}\.[0-9]{1,4}\.[A-Za-z0-9_-]{1,400}\.jpg$'
);

create policy "Mur Archive retry own photo uploads"
on storage.objects for update to authenticated
using (
  bucket_id = 'mur-archive-photos'
  and storage.foldername(name) = array[(select auth.uid())::text]
)
with check (
  bucket_id = 'mur-archive-photos'
  and storage.foldername(name) = array[(select auth.uid())::text]
  and storage.filename(name) ~ '^custom-[0-9a-f-]{36}\.[0-9]{13}\.[0-9]{1,4}\.[0-9]{1,4}\.[A-Za-z0-9_-]{1,400}\.jpg$'
);

create table public.mur_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_id text not null check (photo_id ~ '^(window|yawn|white|basket|sofa|ride|custom-[0-9a-f-]{36})$'),
  primary key (user_id, photo_id)
);

alter table public.mur_favorites enable row level security;
revoke all on public.mur_favorites from public, anon, authenticated;
grant select, insert, delete on public.mur_favorites to authenticated;

create policy "Mur Archive read own favorites"
on public.mur_favorites for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Mur Archive add own favorites"
on public.mur_favorites for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Mur Archive remove own favorites"
on public.mur_favorites for delete to authenticated
using ((select auth.uid()) = user_id);

create table public.mur_postcard (
  user_id uuid not null references auth.users(id) on delete cascade,
  field text not null,
  value text not null,
  primary key (user_id, field),
  check (
    (field = 'photoId' and value ~ '^(window|yawn|white|basket|sofa|ride|custom-[0-9a-f-]{36})$')
    or (field = 'caption' and char_length(value) <= 42)
    or (field = 'theme' and value in ('lilac', 'matcha', 'peach'))
    or (field = 'seal' and value in ('paw', 'heart', 'spark', 'none'))
  )
);

alter table public.mur_postcard enable row level security;
revoke all on public.mur_postcard from public, anon, authenticated;
grant select, insert, update on public.mur_postcard to authenticated;

create policy "Mur Archive read own postcard"
on public.mur_postcard for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Mur Archive start own postcard"
on public.mur_postcard for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Mur Archive edit own postcard"
on public.mur_postcard for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;
