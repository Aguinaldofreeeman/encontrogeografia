-- Atlas & Memórias - Supabase schema
-- Apply in Supabase SQL Editor for project jiefykbolntesntpjdrj

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.uid = auth.uid())
  or exists (
    select 1 from public.admin_invites i
    where i.email = lower(coalesce(auth.jwt()->>'email',''))
  )
  or lower(coalesce(auth.jwt()->>'email','')) in (
    'aguinaldofreeman@gmail.com',
    'aguinaldo71@gmail.com',
    'aguinaldoj@prof.educacao.sp.gov.br'
  );
$$;

create table if not exists public.photos (
  id text primary key,
  category text not null check (category in ('historico','formatura','turma')),
  title text not null,
  caption text not null default '',
  image_url text not null,
  year_label text not null default '',
  location text not null default '',
  photographer text not null default '',
  plate_code text,
  featured boolean not null default false,
  visibility text not null default 'public' check (visibility in ('public','draft')),
  author_uid uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists photos_created_at_idx on public.photos(created_at desc);
create index if not exists photos_visibility_idx on public.photos(visibility);
drop trigger if exists photos_set_updated_at on public.photos;
create trigger photos_set_updated_at before update on public.photos
for each row execute function public.set_updated_at();

alter table public.photos enable row level security;
drop policy if exists "photos public read" on public.photos;
create policy "photos public read" on public.photos for select using (visibility = 'public' or public.is_admin());
drop policy if exists "photos admin insert" on public.photos;
create policy "photos admin insert" on public.photos for insert to authenticated with check (public.is_admin());
drop policy if exists "photos admin update" on public.photos;
create policy "photos admin update" on public.photos for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "photos admin delete" on public.photos;
create policy "photos admin delete" on public.photos for delete to authenticated using (public.is_admin());

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  photo_id text not null default 'album',
  target_type text not null check (target_type in ('photo','album')),
  author_name text not null,
  author_relation text not null,
  text text not null,
  status text not null default 'pending' check (status in ('pending','approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists comments_created_at_idx on public.comments(created_at desc);
create index if not exists comments_status_idx on public.comments(status);
drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at before update on public.comments
for each row execute function public.set_updated_at();

alter table public.comments enable row level security;
drop policy if exists "comments public read approved" on public.comments;
create policy "comments public read approved" on public.comments for select using (status = 'approved' or public.is_admin());
drop policy if exists "comments public insert pending" on public.comments;
create policy "comments public insert pending" on public.comments for insert to anon, authenticated
with check (status = 'pending' and char_length(trim(author_name)) >= 2 and char_length(trim(text)) >= 4);
drop policy if exists "comments admin update" on public.comments;
create policy "comments admin update" on public.comments for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "comments admin delete" on public.comments;
create policy "comments admin delete" on public.comments for delete to authenticated using (public.is_admin());

create table if not exists public.settings (
  id text primary key check (id = 'album'),
  data jsonb not null default '{}'::jsonb,
  updated_by_uid uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at before update on public.settings
for each row execute function public.set_updated_at();

alter table public.settings enable row level security;
drop policy if exists "settings public read" on public.settings;
create policy "settings public read" on public.settings for select using (true);
drop policy if exists "settings admin write" on public.settings;
create policy "settings admin write" on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.stats (
  id text primary key check (id = 'album'),
  total_views bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.stats (id, total_views) values ('album', 0) on conflict (id) do nothing;

alter table public.stats enable row level security;
drop policy if exists "stats public read" on public.stats;
create policy "stats public read" on public.stats for select using (true);
drop policy if exists "stats admin write" on public.stats;
create policy "stats admin write" on public.stats for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.increment_home_views()
returns bigint language plpgsql security definer set search_path = public as $$
declare
  next_views bigint;
begin
  insert into public.stats(id, total_views, updated_at)
  values ('album', 1, now())
  on conflict (id) do update
    set total_views = public.stats.total_views + 1, updated_at = now()
  returning total_views into next_views;
  return next_views;
end;
$$;
grant execute on function public.increment_home_views() to anon, authenticated;

create table if not exists public.admins (
  uid uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
drop policy if exists "admins admin read" on public.admins;
create policy "admins admin read" on public.admins for select to authenticated using (public.is_admin() or uid = auth.uid());
drop policy if exists "admins admin write" on public.admins;
create policy "admins admin write" on public.admins for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins self claim" on public.admins;
create policy "admins self claim" on public.admins for insert to authenticated
with check (
  uid = auth.uid() and (
    lower(coalesce(auth.jwt()->>'email','')) in (
      'aguinaldofreeman@gmail.com','aguinaldo71@gmail.com','aguinaldoj@prof.educacao.sp.gov.br'
    )
    or exists (select 1 from public.admin_invites i where i.email = lower(coalesce(auth.jwt()->>'email','')))
  )
);

create table if not exists public.admin_invites (
  id text primary key,
  email text not null unique,
  display_name text not null default '',
  role text not null default 'admin',
  created_by_uid uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.admin_invites enable row level security;
drop policy if exists "invites admin read" on public.admin_invites;
create policy "invites admin read" on public.admin_invites for select to authenticated using (public.is_admin() or email = lower(coalesce(auth.jwt()->>'email','')));
drop policy if exists "invites admin write" on public.admin_invites;
create policy "invites admin write" on public.admin_invites for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 6291456, array['image/jpeg','image/png','image/webp','image/jpg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "photos storage public read" on storage.objects;
create policy "photos storage public read" on storage.objects for select using (bucket_id = 'photos');
drop policy if exists "photos storage admin insert" on storage.objects;
create policy "photos storage admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_admin());
drop policy if exists "photos storage admin update" on storage.objects;
create policy "photos storage admin update" on storage.objects for update to authenticated using (bucket_id = 'photos' and public.is_admin());
drop policy if exists "photos storage admin delete" on storage.objects;
create policy "photos storage admin delete" on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.is_admin());
