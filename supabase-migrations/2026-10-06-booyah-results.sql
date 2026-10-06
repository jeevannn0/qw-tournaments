begin;

create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null,
  time_slot_id text not null,
  time_slot_label text not null,
  time_slot_at timestamptz not null,
  winner_public_player_id uuid references public.public_players(id) on delete set null,
  display_name text not null,
  ff_uid text not null,
  kills smallint,
  prize_amount integer not null,
  image_path text not null unique,
  image_alt text not null,
  published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null,
  updated_by uuid not null,
  constraint match_results_tournament check (tournament_id = 'solo-survival-01'),
  constraint match_results_time_slot check (
    (time_slot_id = 'solo-2026-10-06-1930'
      and time_slot_label = '7:30 PM lobby'
      and time_slot_at = '2026-10-06 19:30:00+05:30'::timestamptz)
    or
    (time_slot_id = 'solo-2026-10-06-2100'
      and time_slot_label = '9:00 PM lobby'
      and time_slot_at = '2026-10-06 21:00:00+05:30'::timestamptz)
  ),
  constraint match_results_name check (char_length(display_name) between 2 and 32),
  constraint match_results_uid check (ff_uid ~ '^[0-9]{6,12}$'),
  constraint match_results_kills check (kills is null or kills between 0 and 99),
  constraint match_results_prize check (prize_amount between 0 and 1000000),
  constraint match_results_image_path check (
    image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ),
  constraint match_results_image_alt check (char_length(image_alt) between 5 and 180),
  constraint match_results_unique_lobby unique (tournament_id, time_slot_id)
);

alter table public.match_results enable row level security;

drop trigger if exists match_results_set_updated_at on public.match_results;
create trigger match_results_set_updated_at
before update on public.match_results
for each row execute function public.set_updated_at();

drop policy if exists "public reads published match results" on public.match_results;
create policy "public reads published match results"
on public.match_results
for select
to anon, authenticated
using (published = true);

drop policy if exists "organizer reads all match results" on public.match_results;
create policy "organizer reads all match results"
on public.match_results
for select
to authenticated
using (public.is_active_admin());

grant select on public.match_results to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'winner-images',
  'winner-images',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "organizer uploads winner images" on storage.objects;
create policy "organizer uploads winner images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'winner-images'
  and public.is_active_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'png', 'webp')
);

drop policy if exists "organizer reads winner images" on storage.objects;
create policy "organizer reads winner images"
on storage.objects
for select
to authenticated
using (bucket_id = 'winner-images' and public.is_active_admin());

drop policy if exists "public reads published winner images" on storage.objects;
create policy "public reads published winner images"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'winner-images'
  and exists (
    select 1
    from public.match_results
    where match_results.published = true
      and match_results.image_path = name
  )
);

drop policy if exists "organizer deletes winner images" on storage.objects;
create policy "organizer deletes winner images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'winner-images' and public.is_active_admin());

create or replace function public.publish_match_result(
  p_tournament_id text,
  p_time_slot_id text,
  p_winner_public_player_id uuid,
  p_kills smallint,
  p_prize_amount integer,
  p_image_path text,
  p_image_alt text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, storage
as $$
declare
  winner public.public_players%rowtype;
  result_id uuid;
  result_time_slot_label text;
  result_time_slot_at timestamptz;
  result_image_alt text;
begin
  if not public.is_active_admin() then
    raise exception 'Organizer access required';
  end if;

  if p_tournament_id <> 'solo-survival-01' then
    raise exception 'Unsupported tournament';
  end if;

  if p_time_slot_id = 'solo-2026-10-06-1930' then
    result_time_slot_label := '7:30 PM lobby';
    result_time_slot_at := '2026-10-06 19:30:00+05:30'::timestamptz;
  elsif p_time_slot_id = 'solo-2026-10-06-2100' then
    result_time_slot_label := '9:00 PM lobby';
    result_time_slot_at := '2026-10-06 21:00:00+05:30'::timestamptz;
  else
    raise exception 'Unsupported lobby';
  end if;

  if p_kills is not null and p_kills not between 0 and 99 then
    raise exception 'Verified kills must be from 0 to 99';
  end if;

  if p_prize_amount is null or p_prize_amount not between 0 and 1000000 then
    raise exception 'Prize amount is invalid';
  end if;

  if p_image_path is null
    or p_image_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    or split_part(p_image_path, '/', 1) <> auth.uid()::text then
    raise exception 'Winner image path is invalid';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'winner-images' and name = p_image_path
  ) then
    raise exception 'Winner image was not uploaded';
  end if;

  select *
  into winner
  from public.public_players
  where id = p_winner_public_player_id
    and tournament_id = p_tournament_id
    and time_slot_id = p_time_slot_id;

  if not found then
    raise exception 'Choose a confirmed player from the selected lobby';
  end if;

  result_image_alt := coalesce(
    nullif(btrim(p_image_alt), ''),
    winner.display_name || ' celebrates winning ' || result_time_slot_label
  );
  if char_length(result_image_alt) not between 5 and 180 then
    raise exception 'Winner image description must be from 5 to 180 characters';
  end if;

  insert into public.match_results (
    tournament_id,
    time_slot_id,
    time_slot_label,
    time_slot_at,
    winner_public_player_id,
    display_name,
    ff_uid,
    kills,
    prize_amount,
    image_path,
    image_alt,
    published,
    published_at,
    created_by,
    updated_by
  ) values (
    p_tournament_id,
    p_time_slot_id,
    result_time_slot_label,
    result_time_slot_at,
    winner.id,
    winner.display_name,
    winner.ff_uid,
    p_kills,
    p_prize_amount,
    p_image_path,
    result_image_alt,
    true,
    now(),
    auth.uid(),
    auth.uid()
  )
  on conflict (tournament_id, time_slot_id) do update set
    winner_public_player_id = excluded.winner_public_player_id,
    display_name = excluded.display_name,
    ff_uid = excluded.ff_uid,
    kills = excluded.kills,
    prize_amount = excluded.prize_amount,
    image_path = excluded.image_path,
    image_alt = excluded.image_alt,
    published = true,
    published_at = now(),
    updated_by = auth.uid()
  returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.publish_match_result(text, text, uuid, smallint, integer, text, text) from public;
grant execute on function public.publish_match_result(text, text, uuid, smallint, integer, text, text) to authenticated;

create or replace function public.remove_match_result(p_result_id uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  removed_image_path text;
begin
  if not public.is_active_admin() then
    raise exception 'Organizer access required';
  end if;

  delete from public.match_results
  where id = p_result_id
  returning image_path into removed_image_path;

  if removed_image_path is null then
    raise exception 'Published result not found';
  end if;

  return removed_image_path;
end;
$$;

revoke all on function public.remove_match_result(uuid) from public;
grant execute on function public.remove_match_result(uuid) to authenticated;

commit;
