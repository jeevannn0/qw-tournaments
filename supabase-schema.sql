begin;

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint admin_users_email_length check (char_length(email) between 3 and 254)
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  schema_version smallint not null default 1,
  owner_user_id uuid not null,
  reference text not null unique,
  tournament_id text not null,
  tournament_name text not null,
  time_slot_id text not null,
  time_slot_label text not null,
  time_slot_at timestamptz not null,
  display_name text not null,
  ff_uid text not null,
  age smallint not null,
  contact_whatsapp text not null,
  payment_method text not null,
  payment_reference text not null,
  payment_amount integer not null,
  screenshot_path text not null unique,
  screenshot_content_type text not null,
  screenshot_size integer not null,
  rules_accepted boolean not null,
  guardian_approved boolean not null,
  payment_confirmed boolean not null,
  public_roster_approved boolean not null,
  payment_status text not null default 'pending',
  registration_status text not null default 'pending',
  slot smallint,
  organizer_note text not null default '',
  reviewed_by uuid,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registrations_schema check (schema_version = 1),
  constraint registrations_reference check (reference ~ '^QW-SOLO01-[0-9]{4}-[A-F0-9]{6}$'),
  constraint registrations_tournament check (tournament_id = 'solo-survival-01' and tournament_name = 'Solo Survival 01'),
  constraint registrations_time_slot check (
    (time_slot_id = 'solo-2026-10-06-1930'
      and time_slot_label = '7:30 PM lobby'
      and time_slot_at = '2026-10-06 19:30:00+05:30'::timestamptz)
    or
    (time_slot_id = 'solo-2026-10-06-2100'
      and time_slot_label = '9:00 PM lobby'
      and time_slot_at = '2026-10-06 21:00:00+05:30'::timestamptz)
  ),
  constraint registrations_name check (char_length(display_name) between 2 and 32),
  constraint registrations_uid check (ff_uid ~ '^[0-9]{6,12}$'),
  constraint registrations_age check (age between 13 and 80),
  constraint registrations_whatsapp check (contact_whatsapp ~ '^\+91[6-9][0-9]{9}$'),
  constraint registrations_payment_method check (payment_method = 'upi'),
  constraint registrations_payment_reference check (payment_reference ~ '^[A-Z0-9-]{6,40}$'),
  constraint registrations_payment_amount check (payment_amount = 10),
  constraint registrations_screenshot_type check (screenshot_content_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint registrations_screenshot_size check (screenshot_size between 1 and 2097152),
  constraint registrations_screenshot_path check (
    screenshot_path = owner_user_id::text || '/' || id::text || '/' || reference ||
      case screenshot_content_type
        when 'image/jpeg' then '.jpg'
        when 'image/png' then '.png'
        else '.webp'
      end
  ),
  constraint registrations_consents check (
    rules_accepted and guardian_approved and payment_confirmed and public_roster_approved
  ),
  constraint registrations_payment_status check (payment_status in ('pending', 'verified', 'not-found', 'duplicate')),
  constraint registrations_status check (registration_status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  constraint registrations_slot check (slot is null or slot between 1 and 50),
  constraint registrations_confirmation check (
    registration_status <> 'confirmed' or (payment_status = 'verified' and slot is not null)
  ),
  constraint registrations_note_length check (char_length(organizer_note) <= 500)
);

create index if not exists registrations_submitted_at_idx
  on public.registrations (submitted_at desc);
create index if not exists registrations_owner_idx
  on public.registrations (owner_user_id);
create index if not exists registrations_payment_reference_idx
  on public.registrations (payment_reference);

create table if not exists public.public_players (
  id uuid primary key references public.registrations(id) on delete cascade,
  reference text not null unique,
  tournament_id text not null,
  time_slot_id text not null,
  time_slot_label text not null,
  time_slot_at timestamptz not null,
  display_name text not null,
  ff_uid text not null,
  slot smallint not null,
  status text not null default 'Confirmed',
  confirmed_at timestamptz not null default now(),
  constraint public_players_reference check (reference ~ '^QW-SOLO01-[0-9]{4}-[A-F0-9]{6}$'),
  constraint public_players_tournament check (tournament_id = 'solo-survival-01'),
  constraint public_players_time_slot check (
    (time_slot_id = 'solo-2026-10-06-1930'
      and time_slot_label = '7:30 PM lobby'
      and time_slot_at = '2026-10-06 19:30:00+05:30'::timestamptz)
    or
    (time_slot_id = 'solo-2026-10-06-2100'
      and time_slot_label = '9:00 PM lobby'
      and time_slot_at = '2026-10-06 21:00:00+05:30'::timestamptz)
  ),
  constraint public_players_name check (char_length(display_name) between 2 and 32),
  constraint public_players_uid check (ff_uid ~ '^[0-9]{6,12}$'),
  constraint public_players_slot check (slot between 1 and 50),
  constraint public_players_status check (status = 'Confirmed'),
  constraint public_players_unique_slot unique (tournament_id, time_slot_id, slot)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists registrations_set_updated_at on public.registrations;
create trigger registrations_set_updated_at
before update on public.registrations
for each row execute function public.set_updated_at();

create or replace function public.flag_duplicate_payment_reference()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.payment_reference, 0));

  if exists (
    select 1 from public.registrations
    where payment_reference = new.payment_reference
  ) then
    new.payment_status = 'duplicate';
    update public.registrations
    set payment_status = 'duplicate'
    where payment_reference = new.payment_reference
      and registration_status <> 'confirmed';
  end if;

  return new;
end;
$$;

drop trigger if exists registrations_flag_duplicate_payment on public.registrations;
create trigger registrations_flag_duplicate_payment
before insert on public.registrations
for each row execute function public.flag_duplicate_payment_reference();

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid() and active = true
  );
$$;

revoke all on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.registrations enable row level security;
alter table public.public_players enable row level security;

drop policy if exists "organizer reads own approval" on public.admin_users;
create policy "organizer reads own approval"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "player creates complete registration" on public.registrations;

drop policy if exists "player reads own registration" on public.registrations;
create policy "player reads own registration"
on public.registrations
for select
to authenticated
using (owner_user_id = auth.uid() or public.is_active_admin());

drop policy if exists "public reads confirmed players" on public.public_players;
create policy "public reads confirmed players"
on public.public_players
for select
to anon, authenticated
using (true);

grant usage on schema public to anon, authenticated;
grant select on public.public_players to anon, authenticated;
grant select on public.registrations to authenticated;
grant select on public.admin_users to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "player uploads own payment proof" on storage.objects;
create policy "player uploads own payment proof"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'png', 'webp')
);

drop policy if exists "player removes unattached payment proof" on storage.objects;
create policy "player removes unattached payment proof"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not exists (
    select 1 from public.registrations where screenshot_path = name
  )
);

drop policy if exists "organizer reads payment proofs" on storage.objects;
create policy "organizer reads payment proofs"
on storage.objects
for select
to authenticated
using (bucket_id = 'payment-proofs' and public.is_active_admin());

drop policy if exists "organizer deletes payment proofs" on storage.objects;
create policy "organizer deletes payment proofs"
on storage.objects
for delete
to authenticated
using (bucket_id = 'payment-proofs' and public.is_active_admin());

create or replace function public.review_registration(
  p_registration_id uuid,
  p_payment_status text,
  p_registration_status text,
  p_slot smallint,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  affected_rows integer;
begin
  if not public.is_active_admin() then
    raise exception 'Organizer access required';
  end if;

  if p_payment_status not in ('pending', 'verified', 'not-found', 'duplicate') then
    raise exception 'Unsupported payment status';
  end if;

  if p_registration_status not in ('pending', 'confirmed', 'rejected', 'cancelled') then
    raise exception 'Unsupported registration status';
  end if;

  if p_note is null or char_length(p_note) > 500 then
    raise exception 'Organizer note is invalid';
  end if;

  if p_registration_status = 'confirmed'
    and (p_payment_status <> 'verified' or p_slot is null or p_slot not between 1 and 50) then
    raise exception 'Verified payment and a player number from 1 to 50 are required for confirmation';
  end if;

  update public.registrations
  set payment_status = p_payment_status,
      registration_status = p_registration_status,
      slot = p_slot,
      organizer_note = p_note,
      reviewed_by = auth.uid()
  where id = p_registration_id;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Registration not found';
  end if;

  if p_registration_status = 'confirmed' then
    insert into public.public_players (
      id,
      reference,
      tournament_id,
      time_slot_id,
      time_slot_label,
      time_slot_at,
      display_name,
      ff_uid,
      slot,
      status,
      confirmed_at
    )
    select
      id,
      reference,
      tournament_id,
      time_slot_id,
      time_slot_label,
      time_slot_at,
      display_name,
      ff_uid,
      slot,
      'Confirmed',
      now()
    from public.registrations
    where id = p_registration_id and public_roster_approved = true
    on conflict (id) do update set
      reference = excluded.reference,
      tournament_id = excluded.tournament_id,
      time_slot_id = excluded.time_slot_id,
      time_slot_label = excluded.time_slot_label,
      time_slot_at = excluded.time_slot_at,
      display_name = excluded.display_name,
      ff_uid = excluded.ff_uid,
      slot = excluded.slot,
      status = excluded.status,
      confirmed_at = excluded.confirmed_at;
  else
    delete from public.public_players where id = p_registration_id;
  end if;
end;
$$;

revoke all on function public.review_registration(uuid, text, text, smallint, text) from public;
grant execute on function public.review_registration(uuid, text, text, smallint, text) to authenticated;

create or replace function public.delete_registration(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_status text;
begin
  if not public.is_active_admin() then
    raise exception 'Organizer access required';
  end if;

  select registration_status
  into current_status
  from public.registrations
  where id = p_registration_id
  for update;

  if current_status is null then
    raise exception 'Registration not found';
  end if;

  if current_status not in ('cancelled', 'rejected') then
    raise exception 'Cancel or reject the registration before deleting it';
  end if;

  delete from public.public_players where id = p_registration_id;
  delete from public.registrations where id = p_registration_id;
end;
$$;

revoke all on function public.delete_registration(uuid) from public;
grant execute on function public.delete_registration(uuid) to authenticated;

-- Public Booyah results are published only by active organizers.
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
    (time_slot_id = 'solo-2026-10-06-1930' and time_slot_label = '7:30 PM lobby' and time_slot_at = '2026-10-06 19:30:00+05:30'::timestamptz)
    or
    (time_slot_id = 'solo-2026-10-06-2100' and time_slot_label = '9:00 PM lobby' and time_slot_at = '2026-10-06 21:00:00+05:30'::timestamptz)
  ),
  constraint match_results_name check (char_length(display_name) between 2 and 32),
  constraint match_results_uid check (ff_uid ~ '^[0-9]{6,12}$'),
  constraint match_results_kills check (kills is null or kills between 0 and 99),
  constraint match_results_prize check (prize_amount between 0 and 1000000),
  constraint match_results_image_path check (image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  constraint match_results_image_alt check (char_length(image_alt) between 5 and 180),
  constraint match_results_unique_lobby unique (tournament_id, time_slot_id)
);

alter table public.match_results enable row level security;

drop trigger if exists match_results_set_updated_at on public.match_results;
create trigger match_results_set_updated_at
before update on public.match_results
for each row execute function public.set_updated_at();

drop policy if exists "public reads published match results" on public.match_results;
create policy "public reads published match results" on public.match_results for select to anon, authenticated using (published = true);
drop policy if exists "organizer reads all match results" on public.match_results;
create policy "organizer reads all match results" on public.match_results for select to authenticated using (public.is_active_admin());
grant select on public.match_results to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('winner-images', 'winner-images', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "organizer uploads winner images" on storage.objects;
create policy "organizer uploads winner images" on storage.objects for insert to authenticated with check (
  bucket_id = 'winner-images' and public.is_active_admin() and (storage.foldername(name))[1] = auth.uid()::text and lower(storage.extension(name)) in ('jpg', 'png', 'webp')
);
drop policy if exists "organizer reads winner images" on storage.objects;
create policy "organizer reads winner images" on storage.objects for select to authenticated using (bucket_id = 'winner-images' and public.is_active_admin());
drop policy if exists "public reads published winner images" on storage.objects;
create policy "public reads published winner images" on storage.objects for select to anon, authenticated using (
  bucket_id = 'winner-images' and exists (select 1 from public.match_results where match_results.published = true and match_results.image_path = name)
);
drop policy if exists "organizer deletes winner images" on storage.objects;
create policy "organizer deletes winner images" on storage.objects for delete to authenticated using (bucket_id = 'winner-images' and public.is_active_admin());

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
  if not public.is_active_admin() then raise exception 'Organizer access required'; end if;
  if p_tournament_id <> 'solo-survival-01' then raise exception 'Unsupported tournament'; end if;

  if p_time_slot_id = 'solo-2026-10-06-1930' then
    result_time_slot_label := '7:30 PM lobby';
    result_time_slot_at := '2026-10-06 19:30:00+05:30'::timestamptz;
  elsif p_time_slot_id = 'solo-2026-10-06-2100' then
    result_time_slot_label := '9:00 PM lobby';
    result_time_slot_at := '2026-10-06 21:00:00+05:30'::timestamptz;
  else
    raise exception 'Unsupported lobby';
  end if;

  if p_kills is not null and p_kills not between 0 and 99 then raise exception 'Verified kills must be from 0 to 99'; end if;
  if p_prize_amount is null or p_prize_amount not between 0 and 1000000 then raise exception 'Prize amount is invalid'; end if;
  if p_image_path is null or p_image_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' or split_part(p_image_path, '/', 1) <> auth.uid()::text then
    raise exception 'Winner image path is invalid';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'winner-images' and name = p_image_path) then
    raise exception 'Winner image was not uploaded';
  end if;

  select * into winner from public.public_players
  where id = p_winner_public_player_id and tournament_id = p_tournament_id and time_slot_id = p_time_slot_id;
  if not found then raise exception 'Choose a confirmed player from the selected lobby'; end if;

  result_image_alt := coalesce(nullif(btrim(p_image_alt), ''), winner.display_name || ' celebrates winning ' || result_time_slot_label);
  if char_length(result_image_alt) not between 5 and 180 then raise exception 'Winner image description must be from 5 to 180 characters'; end if;

  insert into public.match_results (
    tournament_id, time_slot_id, time_slot_label, time_slot_at, winner_public_player_id, display_name, ff_uid, kills, prize_amount, image_path, image_alt, published, published_at, created_by, updated_by
  ) values (
    p_tournament_id, p_time_slot_id, result_time_slot_label, result_time_slot_at, winner.id, winner.display_name, winner.ff_uid, p_kills, p_prize_amount, p_image_path, result_image_alt, true, now(), auth.uid(), auth.uid()
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
declare removed_image_path text;
begin
  if not public.is_active_admin() then raise exception 'Organizer access required'; end if;
  delete from public.match_results where id = p_result_id returning image_path into removed_image_path;
  if removed_image_path is null then raise exception 'Published result not found'; end if;
  return removed_image_path;
end;
$$;

revoke all on function public.remove_match_result(uuid) from public;
grant execute on function public.remove_match_result(uuid) to authenticated;

-- Safe public match-card presentation overrides with organizer-only revision history.
create table if not exists public.match_card_overrides (
  tournament_id text primary key,
  name text not null,
  tagline text not null,
  description text not null,
  map text not null,
  rounds text not null,
  capacity integer not null,
  presentation_mode text not null,
  scheduled_at timestamptz,
  card_entry_fee integer,
  reward_label text,
  version integer not null default 1,
  change_note text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  constraint match_card_overrides_known_id check (tournament_id in ('solo-survival-01', 'squad-last-circle-01', 'clash-squad-cup-01')),
  constraint match_card_overrides_name check (char_length(name) between 2 and 80 and name = btrim(name)),
  constraint match_card_overrides_tagline check (char_length(tagline) between 5 and 180 and tagline = btrim(tagline)),
  constraint match_card_overrides_description check (char_length(description) between 20 and 1000 and description = btrim(description)),
  constraint match_card_overrides_map check (char_length(map) between 2 and 80 and map = btrim(map)),
  constraint match_card_overrides_rounds check (char_length(rounds) between 2 and 120 and rounds = btrim(rounds)),
  constraint match_card_overrides_capacity check (capacity between 1 and 500),
  constraint match_card_overrides_presentation_mode check (presentation_mode in ('coming_soon', 'scheduled', 'registration_open')),
  constraint match_card_overrides_presentation_fields check (
    (presentation_mode = 'coming_soon' and scheduled_at is null and card_entry_fee is null and reward_label is null)
    or
    (presentation_mode = 'scheduled' and scheduled_at is not null and card_entry_fee is not null and reward_label is not null
      and card_entry_fee between 0 and 100000 and char_length(reward_label) between 5 and 120 and reward_label = btrim(reward_label))
    or
    (presentation_mode = 'registration_open' and scheduled_at is not null and card_entry_fee is not null and reward_label is not null
      and card_entry_fee between 1 and 100000 and char_length(reward_label) between 5 and 120 and reward_label = btrim(reward_label))
  ),
  constraint match_card_overrides_version check (version >= 1),
  constraint match_card_overrides_change_note check (char_length(change_note) between 5 and 500 and change_note = btrim(change_note))
);

-- Reconcile an existing installation that used the earlier Match Cards draft.
alter table public.match_card_overrides
  add column if not exists presentation_mode text,
  add column if not exists scheduled_at timestamptz,
  add column if not exists card_entry_fee integer,
  add column if not exists reward_label text;

update public.match_card_overrides
set presentation_mode = 'coming_soon',
    scheduled_at = null,
    card_entry_fee = null,
    reward_label = null
where presentation_mode is null;

alter table public.match_card_overrides
  alter column presentation_mode set not null,
  drop constraint if exists match_card_overrides_stage,
  drop constraint if exists match_card_overrides_capacity,
  drop constraint if exists match_card_overrides_presentation_mode,
  drop constraint if exists match_card_overrides_presentation_fields;

alter table public.match_card_overrides
  drop column if exists stage;

alter table public.match_card_overrides
  add constraint match_card_overrides_capacity check (capacity between 1 and 500),
  add constraint match_card_overrides_presentation_mode check (presentation_mode in ('coming_soon', 'scheduled', 'registration_open')),
  add constraint match_card_overrides_presentation_fields check (
    (presentation_mode = 'coming_soon' and scheduled_at is null and card_entry_fee is null and reward_label is null)
    or
    (presentation_mode = 'scheduled' and scheduled_at is not null and card_entry_fee is not null and reward_label is not null
      and card_entry_fee between 0 and 100000 and char_length(reward_label) between 5 and 120 and reward_label = btrim(reward_label))
    or
    (presentation_mode = 'registration_open' and scheduled_at is not null and card_entry_fee is not null and reward_label is not null
      and card_entry_fee between 1 and 100000 and char_length(reward_label) between 5 and 120 and reward_label = btrim(reward_label))
  );

create table if not exists public.match_card_override_revisions (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null,
  version integer not null,
  snapshot jsonb not null,
  change_note text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid not null,
  constraint match_card_override_revisions_known_id check (tournament_id in ('solo-survival-01', 'squad-last-circle-01', 'clash-squad-cup-01')),
  constraint match_card_override_revisions_version check (version >= 1),
  constraint match_card_override_revisions_snapshot check (jsonb_typeof(snapshot) = 'object'),
  constraint match_card_override_revisions_note check (char_length(change_note) between 5 and 500),
  constraint match_card_override_revisions_unique_version unique (tournament_id, version)
);

alter table public.match_card_overrides enable row level security;
alter table public.match_card_override_revisions enable row level security;

drop trigger if exists match_card_overrides_set_updated_at on public.match_card_overrides;
create trigger match_card_overrides_set_updated_at
before update on public.match_card_overrides
for each row execute function public.set_updated_at();

drop policy if exists "public reads match card overrides" on public.match_card_overrides;
create policy "public reads match card overrides" on public.match_card_overrides for select to anon, authenticated using (true);
drop policy if exists "organizer reads all match card overrides" on public.match_card_overrides;
create policy "organizer reads all match card overrides" on public.match_card_overrides for select to authenticated using (public.is_active_admin());
drop policy if exists "organizer reads match card revisions" on public.match_card_override_revisions;
create policy "organizer reads match card revisions" on public.match_card_override_revisions for select to authenticated using (public.is_active_admin());

revoke all on public.match_card_overrides from anon, authenticated;
revoke all on public.match_card_override_revisions from anon, authenticated;
grant select (tournament_id, name, tagline, description, map, rounds, capacity, presentation_mode, scheduled_at, card_entry_fee, reward_label, version, updated_at)
on public.match_card_overrides to anon, authenticated;
grant select on public.match_card_override_revisions to authenticated;

create or replace function public.save_match_card_override(
  p_tournament_id text,
  p_name text,
  p_tagline text,
  p_description text,
  p_map text,
  p_rounds text,
  p_capacity integer,
  p_presentation_mode text,
  p_scheduled_at timestamptz,
  p_card_entry_fee integer,
  p_reward_label text,
  p_expected_version integer,
  p_change_note text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_row public.match_card_overrides%rowtype;
  normalized_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  normalized_tagline text := regexp_replace(btrim(coalesce(p_tagline, '')), '\s+', ' ', 'g');
  normalized_description text := regexp_replace(btrim(coalesce(p_description, '')), '\s+', ' ', 'g');
  normalized_map text := regexp_replace(btrim(coalesce(p_map, '')), '\s+', ' ', 'g');
  normalized_rounds text := regexp_replace(btrim(coalesce(p_rounds, '')), '\s+', ' ', 'g');
  normalized_reward text := regexp_replace(btrim(coalesce(p_reward_label, '')), '\s+', ' ', 'g');
  normalized_note text := regexp_replace(btrim(coalesce(p_change_note, '')), '\s+', ' ', 'g');
  stored_scheduled_at timestamptz;
  stored_entry_fee integer;
  stored_reward text;
  resulting_version integer;
begin
  if not public.is_active_admin() then raise exception 'Organizer access required'; end if;
  if p_tournament_id not in ('solo-survival-01', 'squad-last-circle-01', 'clash-squad-cup-01') then raise exception 'Unknown match card ID'; end if;
  if p_presentation_mode not in ('coming_soon', 'scheduled') then raise exception 'Presentation mode must be Coming soon or Scheduled'; end if;
  if char_length(normalized_name) not between 2 and 80 then raise exception 'Name must be 2 to 80 characters'; end if;
  if char_length(normalized_tagline) not between 5 and 180 then raise exception 'Tagline must be 5 to 180 characters'; end if;
  if char_length(normalized_description) not between 20 and 1000 then raise exception 'Description must be 20 to 1000 characters'; end if;
  if char_length(normalized_map) not between 2 and 80 then raise exception 'Map must be 2 to 80 characters'; end if;
  if char_length(normalized_rounds) not between 2 and 120 then raise exception 'Rounds must be 2 to 120 characters'; end if;
  if char_length(normalized_note) not between 5 and 500 then raise exception 'Change note must be 5 to 500 characters'; end if;
  if p_capacity is null or p_capacity not between 1 and 500 then raise exception 'Capacity must be from 1 to 500'; end if;
  if p_expected_version is null or p_expected_version < 0 then raise exception 'Expected version is invalid'; end if;

  if p_presentation_mode = 'scheduled' then
    if p_scheduled_at is null or p_scheduled_at <= now() then raise exception 'Scheduled match time must be later than now'; end if;
    if p_card_entry_fee is null or p_card_entry_fee not between 0 and 100000 then raise exception 'Card entry fee must be from 0 to 100000'; end if;
    if char_length(normalized_reward) not between 5 and 120 then raise exception 'Reward summary must be 5 to 120 characters'; end if;
    stored_scheduled_at := p_scheduled_at;
    stored_entry_fee := p_card_entry_fee;
    stored_reward := normalized_reward;
  else
    stored_scheduled_at := null;
    stored_entry_fee := null;
    stored_reward := null;
  end if;

  select * into current_row from public.match_card_overrides where tournament_id = p_tournament_id for update;
  if not found then
    if p_expected_version <> 0 then raise exception 'Version conflict: reload the current match card before saving'; end if;
    insert into public.match_card_overrides (
      tournament_id, name, tagline, description, map, rounds, capacity, presentation_mode,
      scheduled_at, card_entry_fee, reward_label, version, change_note, created_by, updated_by
    ) values (
      p_tournament_id, normalized_name, normalized_tagline, normalized_description, normalized_map, normalized_rounds,
      p_capacity, p_presentation_mode, stored_scheduled_at, stored_entry_fee, stored_reward, 1, normalized_note, auth.uid(), auth.uid()
    );
    return 1;
  end if;

  if current_row.version <> p_expected_version then raise exception 'Version conflict: reload the current match card before saving'; end if;
  insert into public.match_card_override_revisions (tournament_id, version, snapshot, change_note, changed_by)
  values (current_row.tournament_id, current_row.version, to_jsonb(current_row), normalized_note, auth.uid());
  resulting_version := current_row.version + 1;
  update public.match_card_overrides set
    name = normalized_name,
    tagline = normalized_tagline,
    description = normalized_description,
    map = normalized_map,
    rounds = normalized_rounds,
    capacity = p_capacity,
    presentation_mode = p_presentation_mode,
    scheduled_at = stored_scheduled_at,
    card_entry_fee = stored_entry_fee,
    reward_label = stored_reward,
    version = resulting_version,
    change_note = normalized_note,
    updated_by = auth.uid()
  where tournament_id = p_tournament_id;
  return resulting_version;
end;
$$;

revoke all on function public.save_match_card_override(text, text, text, text, text, text, integer, text, timestamptz, integer, text, integer, text) from public;
grant execute on function public.save_match_card_override(text, text, text, text, text, text, integer, text, timestamptz, integer, text, integer, text) to authenticated;

commit;

-- After creating the organizer in Authentication, approve that user with:
-- insert into public.admin_users (user_id, email)
-- select id, email from auth.users where email = 'organizer@example.com';

-- ============================================================================
-- Migration 2026-10-08: dynamic registration (open registration cycles)
-- Source: supabase-migrations/2026-10-08-registration-open.sql (verbatim copy).
-- Runs as a second transaction after the consolidated schema above so a fresh
-- execution of this file reaches the same final state as applying the
-- consolidated schema followed by that migration. Keep this file self-contained;
-- do not replace this block with a psql \i include.
-- ============================================================================
begin;

-- Dynamic registration validation is centralized so RPC inserts and table checks
-- apply the same participant and public-lineup rules.
create or replace function public.registration_participants_are_valid(
  p_tournament_id text,
  p_participants jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  expected_count integer;
  participant jsonb;
  participant_number integer := 0;
  participant_name text;
  participant_uid text;
  participant_age text;
  seen_uids text[] := array[]::text[];
begin
  expected_count := case
    when p_tournament_id = 'solo-survival-01' then 1
    when p_tournament_id in ('squad-last-circle-01', 'clash-squad-cup-01') then 4
    else 0
  end;

  if expected_count = 0
    or p_participants is null
    or jsonb_typeof(p_participants) <> 'array'
    or jsonb_array_length(p_participants) <> expected_count then
    return false;
  end if;

  for participant in select value from jsonb_array_elements(p_participants)
  loop
    participant_number := participant_number + 1;
    if jsonb_typeof(participant) <> 'object'
      or not (participant ? 'name')
      or not (participant ? 'uid')
      or not (participant ? 'age')
      or not (participant ? 'captain')
      or jsonb_typeof(participant -> 'name') <> 'string'
      or jsonb_typeof(participant -> 'uid') <> 'string'
      or jsonb_typeof(participant -> 'age') not in ('string', 'number')
      or jsonb_typeof(participant -> 'captain') <> 'boolean'
      or exists (
        select 1
        from jsonb_object_keys(participant) as participant_keys(key_name)
        where key_name not in ('name', 'uid', 'age', 'captain', 'fieldPrefix')
      ) then
      return false;
    end if;

    participant_name := regexp_replace(btrim(participant ->> 'name'), '\s+', ' ', 'g');
    participant_uid := participant ->> 'uid';
    participant_age := participant ->> 'age';

    if char_length(participant_name) not between 2 and 32
      or participant_name ~ '[[:cntrl:]]'
      or participant_uid !~ '^[0-9]{6,12}$'
      or participant_age !~ '^[0-9]{1,3}$'
      or participant_age::integer not between 13 and 80
      or (participant ->> 'captain')::boolean <> (participant_number = 1)
      or participant_uid = any(seen_uids) then
      return false;
    end if;

    seen_uids := array_append(seen_uids, participant_uid);
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function public.canonical_registration_participants(
  p_tournament_id text,
  p_participants jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  canonical_participants jsonb;
begin
  if not public.registration_participants_are_valid(p_tournament_id, p_participants) then
    raise exception 'Participant lineup is invalid';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'name', regexp_replace(btrim(participant.value ->> 'name'), '\s+', ' ', 'g'),
      'uid', participant.value ->> 'uid',
      'age', (participant.value ->> 'age')::integer,
      'captain', participant.ordinality = 1
    )
    order by participant.ordinality
  )
  into canonical_participants
  from jsonb_array_elements(p_participants) with ordinality as participant(value, ordinality);

  return canonical_participants;
end;
$$;

create or replace function public.public_player_lineup_is_valid(
  p_tournament_id text,
  p_players jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  expected_count integer;
  player jsonb;
begin
  expected_count := case
    when p_tournament_id = 'solo-survival-01' then 1
    when p_tournament_id in ('squad-last-circle-01', 'clash-squad-cup-01') then 4
    else 0
  end;

  if expected_count = 0
    or p_players is null
    or jsonb_typeof(p_players) <> 'array'
    or jsonb_array_length(p_players) <> expected_count then
    return false;
  end if;

  for player in select value from jsonb_array_elements(p_players)
  loop
    if jsonb_typeof(player) <> 'object'
      or not (player ? 'displayName')
      or not (player ? 'uid')
      or jsonb_typeof(player -> 'displayName') <> 'string'
      or jsonb_typeof(player -> 'uid') <> 'string'
      or exists (
        select 1
        from jsonb_object_keys(player) as player_keys(key_name)
        where key_name not in ('displayName', 'uid')
      )
      or char_length(player ->> 'displayName') not between 2 and 32
      or (player ->> 'displayName') ~ '[[:cntrl:]]'
      or (player ->> 'uid') !~ '^[0-9]{6,12}$' then
      return false;
    end if;
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

revoke all on function public.registration_participants_are_valid(text, jsonb) from public, anon, authenticated;
revoke all on function public.canonical_registration_participants(text, jsonb) from public, anon, authenticated;
revoke all on function public.public_player_lineup_is_valid(text, jsonb) from public, anon, authenticated;
grant execute on function public.registration_participants_are_valid(text, jsonb) to authenticated;

-- The override row is the authoritative one-lobby configuration. A cycle changes
-- whenever a closed configuration changes its time, fee, or capacity.
alter table public.match_card_overrides
  add column if not exists registration_cycle integer default 1;

update public.match_card_overrides
set registration_cycle = 1
where registration_cycle is null;

alter table public.match_card_overrides
  alter column registration_cycle set default 1,
  alter column registration_cycle set not null,
  drop constraint if exists match_card_overrides_presentation_mode,
  drop constraint if exists match_card_overrides_presentation_fields,
  drop constraint if exists match_card_overrides_registration_cycle;

alter table public.match_card_overrides
  add constraint match_card_overrides_presentation_mode
    check (presentation_mode in ('coming_soon', 'scheduled', 'registration_open')),
  add constraint match_card_overrides_presentation_fields check (
    (presentation_mode = 'coming_soon'
      and scheduled_at is null and card_entry_fee is null and reward_label is null)
    or
    (presentation_mode = 'scheduled'
      and scheduled_at is not null and card_entry_fee is not null and reward_label is not null
      and card_entry_fee between 0 and 100000
      and char_length(reward_label) between 5 and 120 and reward_label = btrim(reward_label))
    or
    (presentation_mode = 'registration_open'
      and scheduled_at is not null and card_entry_fee is not null and reward_label is not null
      and card_entry_fee between 1 and 100000
      and char_length(reward_label) between 5 and 120 and reward_label = btrim(reward_label))
  ),
  add constraint match_card_overrides_registration_cycle check (registration_cycle >= 1);

revoke all on public.match_card_overrides from anon, authenticated;
grant select (
  tournament_id, name, tagline, description, map, rounds, capacity,
  presentation_mode, scheduled_at, card_entry_fee, reward_label,
  registration_cycle, version, updated_at
) on public.match_card_overrides to anon, authenticated;

create or replace function public.save_match_card_override(
  p_tournament_id text,
  p_name text,
  p_tagline text,
  p_description text,
  p_map text,
  p_rounds text,
  p_capacity integer,
  p_presentation_mode text,
  p_scheduled_at timestamptz,
  p_card_entry_fee integer,
  p_reward_label text,
  p_expected_version integer,
  p_change_note text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_row public.match_card_overrides%rowtype;
  normalized_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  normalized_tagline text := regexp_replace(btrim(coalesce(p_tagline, '')), '\s+', ' ', 'g');
  normalized_description text := regexp_replace(btrim(coalesce(p_description, '')), '\s+', ' ', 'g');
  normalized_map text := regexp_replace(btrim(coalesce(p_map, '')), '\s+', ' ', 'g');
  normalized_rounds text := regexp_replace(btrim(coalesce(p_rounds, '')), '\s+', ' ', 'g');
  normalized_reward text := regexp_replace(btrim(coalesce(p_reward_label, '')), '\s+', ' ', 'g');
  normalized_note text := regexp_replace(btrim(coalesce(p_change_note, '')), '\s+', ' ', 'g');
  stored_scheduled_at timestamptz;
  stored_entry_fee integer;
  stored_reward text;
  configuration_changed boolean;
  resulting_cycle integer;
  resulting_version integer;
begin
  if not public.is_active_admin() then raise exception 'Organizer access required'; end if;
  if p_tournament_id not in ('solo-survival-01', 'squad-last-circle-01', 'clash-squad-cup-01') then raise exception 'Unknown match card ID'; end if;
  if p_presentation_mode not in ('coming_soon', 'scheduled', 'registration_open') then raise exception 'Presentation mode is invalid'; end if;
  if char_length(normalized_name) not between 2 and 80 then raise exception 'Name must be 2 to 80 characters'; end if;
  if char_length(normalized_tagline) not between 5 and 180 then raise exception 'Tagline must be 5 to 180 characters'; end if;
  if char_length(normalized_description) not between 20 and 1000 then raise exception 'Description must be 20 to 1000 characters'; end if;
  if char_length(normalized_map) not between 2 and 80 then raise exception 'Map must be 2 to 80 characters'; end if;
  if char_length(normalized_rounds) not between 2 and 120 then raise exception 'Rounds must be 2 to 120 characters'; end if;
  if char_length(normalized_note) not between 5 and 500 then raise exception 'Change note must be 5 to 500 characters'; end if;
  if p_capacity is null or p_capacity not between 1 and 500 then raise exception 'Capacity must be from 1 to 500'; end if;
  if p_expected_version is null or p_expected_version < 0 then raise exception 'Expected version is invalid'; end if;

  if p_presentation_mode in ('scheduled', 'registration_open') then
    if p_scheduled_at is null then raise exception 'Scheduled match time is required'; end if;
    if p_presentation_mode = 'registration_open' and p_scheduled_at <= now() then raise exception 'Open registration requires a future match time'; end if;
    if p_card_entry_fee is null or p_card_entry_fee not between 0 and 100000 then raise exception 'Card entry fee must be from 0 to 100000'; end if;
    if p_presentation_mode = 'registration_open' and p_card_entry_fee = 0 then raise exception 'Open registration requires a paid entry fee'; end if;
    if char_length(normalized_reward) not between 5 and 120 then raise exception 'Reward summary must be 5 to 120 characters'; end if;
    stored_scheduled_at := p_scheduled_at;
    stored_entry_fee := p_card_entry_fee;
    stored_reward := normalized_reward;
  else
    stored_scheduled_at := null;
    stored_entry_fee := null;
    stored_reward := null;
  end if;

  select * into current_row
  from public.match_card_overrides
  where tournament_id = p_tournament_id
  for update;

  if not found then
    if p_expected_version <> 0 then raise exception 'Version conflict: reload the current match card before saving'; end if;
    insert into public.match_card_overrides (
      tournament_id, name, tagline, description, map, rounds, capacity, presentation_mode,
      scheduled_at, card_entry_fee, reward_label, registration_cycle, version,
      change_note, created_by, updated_by
    ) values (
      p_tournament_id, normalized_name, normalized_tagline, normalized_description,
      normalized_map, normalized_rounds, p_capacity, p_presentation_mode,
      stored_scheduled_at, stored_entry_fee, stored_reward, 1, 1,
      normalized_note, auth.uid(), auth.uid()
    );
    return 1;
  end if;

  if current_row.version <> p_expected_version then raise exception 'Version conflict: reload the current match card before saving'; end if;

  configuration_changed := current_row.scheduled_at is distinct from stored_scheduled_at
    or current_row.card_entry_fee is distinct from stored_entry_fee
    or current_row.capacity is distinct from p_capacity;

  if current_row.presentation_mode = 'registration_open'
    and p_presentation_mode = 'registration_open'
    and configuration_changed then
    raise exception 'Close registration before changing time, fee, or capacity';
  end if;

  resulting_cycle := current_row.registration_cycle;
  if configuration_changed then
    resulting_cycle := resulting_cycle + 1;
  end if;

  insert into public.match_card_override_revisions (
    tournament_id, version, snapshot, change_note, changed_by
  ) values (
    current_row.tournament_id, current_row.version, to_jsonb(current_row), normalized_note, auth.uid()
  );

  resulting_version := current_row.version + 1;
  update public.match_card_overrides set
    name = normalized_name,
    tagline = normalized_tagline,
    description = normalized_description,
    map = normalized_map,
    rounds = normalized_rounds,
    capacity = p_capacity,
    presentation_mode = p_presentation_mode,
    scheduled_at = stored_scheduled_at,
    card_entry_fee = stored_entry_fee,
    reward_label = stored_reward,
    registration_cycle = resulting_cycle,
    version = resulting_version,
    change_note = normalized_note,
    updated_by = auth.uid()
  where tournament_id = p_tournament_id;

  return resulting_version;
end;
$$;

revoke all on function public.save_match_card_override(text, text, text, text, text, text, integer, text, timestamptz, integer, text, integer, text) from public;
grant execute on function public.save_match_card_override(text, text, text, text, text, text, integer, text, timestamptz, integer, text, integer, text) to authenticated;

-- Schema v1 remains a frozen Solo compatibility shape. Schema v2 is accepted only
-- through submit_registration and records the complete private lineup.
alter table public.registrations
  add column if not exists team_name text,
  add column if not exists participants jsonb,
  add column if not exists slot_capacity integer,
  add column if not exists registration_cycle integer;

alter table public.registrations
  drop constraint if exists registrations_schema,
  drop constraint if exists registrations_reference,
  drop constraint if exists registrations_tournament,
  drop constraint if exists registrations_time_slot,
  drop constraint if exists registrations_payment_amount,
  drop constraint if exists registrations_slot,
  drop constraint if exists registrations_dynamic_payload;

alter table public.registrations
  add constraint registrations_schema check (schema_version in (1, 2)),
  add constraint registrations_reference check (
    (schema_version = 1 and reference ~ '^QW-SOLO01-[0-9]{4}-[A-F0-9]{6}$')
    or
    (schema_version = 2 and (
      (tournament_id = 'solo-survival-01' and reference ~ '^QW-SOLO01-[0-9]{4}-[A-F0-9]{6}$')
      or (tournament_id = 'squad-last-circle-01' and reference ~ '^QW-BR01-[0-9]{4}-[A-F0-9]{6}$')
      or (tournament_id = 'clash-squad-cup-01' and reference ~ '^QW-TDM01-[0-9]{4}-[A-F0-9]{6}$')
    ))
  ),
  add constraint registrations_tournament check (
    (schema_version = 1 and tournament_id = 'solo-survival-01' and tournament_name = 'Solo Survival 01')
    or
    (schema_version = 2
      and tournament_id in ('solo-survival-01', 'squad-last-circle-01', 'clash-squad-cup-01')
      and char_length(tournament_name) between 2 and 80 and tournament_name = btrim(tournament_name))
  ),
  add constraint registrations_time_slot check (
    (schema_version = 1 and (
      (time_slot_id = 'solo-2026-10-06-1930' and time_slot_label = '7:30 PM lobby' and time_slot_at = '2026-10-06 19:30:00+05:30'::timestamptz)
      or (time_slot_id = 'solo-2026-10-06-2100' and time_slot_label = '9:00 PM lobby' and time_slot_at = '2026-10-06 21:00:00+05:30'::timestamptz)
    ))
    or
    (schema_version = 2
      and time_slot_id = tournament_id || '-cycle-' || registration_cycle::text
      and time_slot_label = tournament_name || ' lobby')
  ),
  add constraint registrations_payment_amount check (
    (schema_version = 1 and payment_amount = 10)
    or (schema_version = 2 and payment_amount between 1 and 100000)
  ),
  add constraint registrations_slot check (
    slot is null or slot between 1 and coalesce(slot_capacity, 50)
  ),
  add constraint registrations_dynamic_payload check (
    (schema_version = 1
      and team_name is null and participants is null
      and slot_capacity is null and registration_cycle is null)
    or
    (schema_version = 2
      and slot_capacity between 1 and 500
      and registration_cycle >= 1
      and public.registration_participants_are_valid(tournament_id, participants)
      and display_name = participants -> 0 ->> 'name'
      and ff_uid = participants -> 0 ->> 'uid'
      and age::text = participants -> 0 ->> 'age'
      and (
        (tournament_id = 'solo-survival-01' and team_name is null)
        or
        (tournament_id in ('squad-last-circle-01', 'clash-squad-cup-01')
          and char_length(team_name) between 2 and 40 and team_name = btrim(team_name))
      ))
  );

create index if not exists registrations_cycle_idx
  on public.registrations (tournament_id, registration_cycle, registration_status);

-- New registrations are accepted only through submit_registration. Historical schema-v1
-- rows remain readable and reviewable, but no client can create another one.
drop policy if exists "player creates complete registration" on public.registrations;
drop policy if exists "player creates legacy v1 registration" on public.registrations;
revoke insert on public.registrations from authenticated;

-- Public rows contain only names and UIDs. Existing Solo rows are converted to a
-- one-player lineup while preserving their old lobby and slot semantics.
alter table public.public_players
  add column if not exists team_name text,
  add column if not exists players jsonb,
  add column if not exists slot_capacity integer,
  add column if not exists registration_cycle integer;

update public.public_players
set players = jsonb_build_array(jsonb_build_object('displayName', display_name, 'uid', ff_uid))
where players is null;

update public.public_players set slot_capacity = 50 where slot_capacity is null;
update public.public_players set registration_cycle = 1 where registration_cycle is null;

alter table public.public_players
  alter column players set not null,
  alter column slot_capacity set not null,
  alter column registration_cycle set not null,
  drop constraint if exists public_players_reference,
  drop constraint if exists public_players_tournament,
  drop constraint if exists public_players_time_slot,
  drop constraint if exists public_players_slot,
  drop constraint if exists public_players_team,
  drop constraint if exists public_players_lineup,
  drop constraint if exists public_players_capacity,
  drop constraint if exists public_players_registration_cycle;

alter table public.public_players
  add constraint public_players_reference check (
    (tournament_id = 'solo-survival-01' and reference ~ '^QW-SOLO01-[0-9]{4}-[A-F0-9]{6}$')
    or (tournament_id = 'squad-last-circle-01' and reference ~ '^QW-BR01-[0-9]{4}-[A-F0-9]{6}$')
    or (tournament_id = 'clash-squad-cup-01' and reference ~ '^QW-TDM01-[0-9]{4}-[A-F0-9]{6}$')
  ),
  add constraint public_players_tournament check (
    tournament_id in ('solo-survival-01', 'squad-last-circle-01', 'clash-squad-cup-01')
  ),
  add constraint public_players_time_slot check (
    (tournament_id = 'solo-survival-01' and (
      (time_slot_id = 'solo-2026-10-06-1930' and time_slot_label = '7:30 PM lobby' and time_slot_at = '2026-10-06 19:30:00+05:30'::timestamptz)
      or (time_slot_id = 'solo-2026-10-06-2100' and time_slot_label = '9:00 PM lobby' and time_slot_at = '2026-10-06 21:00:00+05:30'::timestamptz)
    ))
    or
    (time_slot_id = tournament_id || '-cycle-' || registration_cycle::text
      and char_length(time_slot_label) between 7 and 86)
  ),
  add constraint public_players_slot check (slot between 1 and slot_capacity),
  add constraint public_players_team check (
    (tournament_id = 'solo-survival-01' and team_name is null)
    or
    (tournament_id in ('squad-last-circle-01', 'clash-squad-cup-01')
      and char_length(team_name) between 2 and 40 and team_name = btrim(team_name))
  ),
  add constraint public_players_lineup check (
    public.public_player_lineup_is_valid(tournament_id, players)
    and display_name = players -> 0 ->> 'displayName'
    and ff_uid = players -> 0 ->> 'uid'
  ),
  add constraint public_players_capacity check (slot_capacity between 1 and 500),
  add constraint public_players_registration_cycle check (registration_cycle >= 1);

revoke all on public.public_players from anon, authenticated;
grant select on public.public_players to anon, authenticated;

create or replace function public.submit_registration(
  p_registration_id uuid,
  p_reference text,
  p_tournament_id text,
  p_team_name text,
  p_participants jsonb,
  p_contact_whatsapp text,
  p_payment_method text,
  p_payment_reference text,
  p_screenshot_path text,
  p_screenshot_content_type text,
  p_screenshot_size integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  requesting_user uuid := auth.uid();
  registration_config public.match_card_overrides%rowtype;
  canonical_participants jsonb;
  normalized_reference text := upper(btrim(coalesce(p_reference, '')));
  normalized_team_name text := regexp_replace(btrim(coalesce(p_team_name, '')), '\s+', ' ', 'g');
  normalized_contact text := btrim(coalesce(p_contact_whatsapp, ''));
  normalized_payment_method text := lower(btrim(coalesce(p_payment_method, '')));
  normalized_payment_reference text := upper(regexp_replace(btrim(coalesce(p_payment_reference, '')), '\s+', '', 'g'));
  expected_extension text;
  expected_path text;
  proof_metadata jsonb;
  active_registration_count integer;
  derived_lobby_id text;
  derived_lobby_label text;
begin
  if requesting_user is null
    or not exists (select 1 from auth.users where id = requesting_user) then
    raise exception 'Authenticated player access required';
  end if;
  if p_registration_id is null then raise exception 'Registration ID is required'; end if;
  if p_tournament_id not in ('solo-survival-01', 'squad-last-circle-01', 'clash-squad-cup-01') then raise exception 'Unknown tournament'; end if;

  canonical_participants := public.canonical_registration_participants(p_tournament_id, p_participants);

  if p_tournament_id = 'solo-survival-01' then
    normalized_team_name := null;
    if coalesce(btrim(p_team_name), '') <> '' then raise exception 'Solo registration does not use a team name'; end if;
  elsif char_length(normalized_team_name) not between 2 and 40 or normalized_team_name ~ '[[:cntrl:]]' then
    raise exception 'Team name must be 2 to 40 characters';
  end if;

  if (p_tournament_id = 'solo-survival-01' and normalized_reference !~ '^QW-SOLO01-[0-9]{4}-[A-F0-9]{6}$')
    or (p_tournament_id = 'squad-last-circle-01' and normalized_reference !~ '^QW-BR01-[0-9]{4}-[A-F0-9]{6}$')
    or (p_tournament_id = 'clash-squad-cup-01' and normalized_reference !~ '^QW-TDM01-[0-9]{4}-[A-F0-9]{6}$') then
    raise exception 'Registration reference is invalid for this tournament';
  end if;
  if normalized_contact !~ '^\+91[6-9][0-9]{9}$' then raise exception 'WhatsApp number is invalid'; end if;
  if normalized_payment_method <> 'upi' then raise exception 'Unsupported payment method'; end if;
  if normalized_payment_reference !~ '^[A-Z0-9-]{6,40}$' then raise exception 'Payment reference is invalid'; end if;
  if p_screenshot_content_type is null
    or p_screenshot_content_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Payment proof type is invalid';
  end if;
  if p_screenshot_size is null or p_screenshot_size not between 1 and 2097152 then raise exception 'Payment proof size is invalid'; end if;

  expected_extension := case p_screenshot_content_type
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    else 'webp'
  end;
  expected_path := requesting_user::text || '/' || p_registration_id::text || '/' || normalized_reference || '.' || expected_extension;
  if p_screenshot_path is distinct from expected_path then raise exception 'Payment proof path is invalid'; end if;

  select objects.metadata
  into proof_metadata
  from storage.objects as objects
  where objects.bucket_id = 'payment-proofs' and objects.name = expected_path
  for key share;
  if not found then raise exception 'Payment proof was not uploaded'; end if;
  if coalesce(proof_metadata ->> 'mimetype', '') <> p_screenshot_content_type
    or coalesce(proof_metadata ->> 'size', '') !~ '^[0-9]+$' then
    raise exception 'Payment proof metadata does not match the uploaded object';
  end if;
  if (proof_metadata ->> 'size')::bigint <> p_screenshot_size then
    raise exception 'Payment proof metadata does not match the uploaded object';
  end if;

  select * into registration_config
  from public.match_card_overrides
  where tournament_id = p_tournament_id
  for update;
  if not found then raise exception 'Registration is not configured for this tournament'; end if;
  if registration_config.presentation_mode <> 'registration_open' then raise exception 'Registration is closed'; end if;
  if registration_config.scheduled_at is null or registration_config.scheduled_at <= now() then raise exception 'Registration has closed for this match'; end if;
  if registration_config.card_entry_fee is null or registration_config.card_entry_fee not between 1 and 100000 then raise exception 'Registration fee configuration is invalid'; end if;
  if registration_config.capacity not between 1 and 500 then raise exception 'Registration capacity is invalid'; end if;

  select count(*) into active_registration_count
  from public.registrations
  where tournament_id = p_tournament_id
    and schema_version = 2
    and registration_cycle = registration_config.registration_cycle
    and registration_status in ('pending', 'confirmed');
  if active_registration_count >= registration_config.capacity then raise exception 'This tournament lobby is full'; end if;

  if exists (
    select 1
    from public.registrations as existing_registration
    cross join lateral jsonb_array_elements(existing_registration.participants) as existing_participant
    cross join lateral jsonb_array_elements(canonical_participants) as submitted_participant
    where existing_registration.tournament_id = p_tournament_id
      and existing_registration.schema_version = 2
      and existing_registration.registration_cycle = registration_config.registration_cycle
      and existing_registration.registration_status in ('pending', 'confirmed')
      and existing_participant ->> 'uid' = submitted_participant ->> 'uid'
  ) then
    raise exception 'A player UID is already active in this registration cycle';
  end if;

  derived_lobby_id := p_tournament_id || '-cycle-' || registration_config.registration_cycle::text;
  derived_lobby_label := registration_config.name || ' lobby';

  insert into public.registrations (
    id, schema_version, owner_user_id, reference, tournament_id, tournament_name,
    time_slot_id, time_slot_label, time_slot_at, display_name, ff_uid, age,
    team_name, participants, slot_capacity, registration_cycle,
    contact_whatsapp, payment_method, payment_reference, payment_amount,
    screenshot_path, screenshot_content_type, screenshot_size,
    rules_accepted, guardian_approved, payment_confirmed, public_roster_approved,
    payment_status, registration_status, slot, organizer_note, reviewed_by
  ) values (
    p_registration_id, 2, requesting_user, normalized_reference, p_tournament_id, registration_config.name,
    derived_lobby_id, derived_lobby_label, registration_config.scheduled_at,
    canonical_participants -> 0 ->> 'name', canonical_participants -> 0 ->> 'uid',
    (canonical_participants -> 0 ->> 'age')::smallint,
    normalized_team_name, canonical_participants, registration_config.capacity, registration_config.registration_cycle,
    normalized_contact, normalized_payment_method, normalized_payment_reference, registration_config.card_entry_fee,
    expected_path, p_screenshot_content_type, p_screenshot_size,
    true, true, true, true,
    'pending', 'pending', null, '', null
  );

  return p_registration_id;
end;
$$;

revoke all on function public.submit_registration(uuid, text, text, text, jsonb, text, text, text, text, text, integer) from public, anon;
grant execute on function public.submit_registration(uuid, text, text, text, jsonb, text, text, text, text, text, integer) to authenticated;

create or replace function public.review_registration(
  p_registration_id uuid,
  p_payment_status text,
  p_registration_status text,
  p_slot smallint,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  selected_registration public.registrations%rowtype;
  public_lineup jsonb;
begin
  if not public.is_active_admin() then raise exception 'Organizer access required'; end if;
  if p_payment_status not in ('pending', 'verified', 'not-found', 'duplicate') then raise exception 'Unsupported payment status'; end if;
  if p_registration_status not in ('pending', 'confirmed', 'rejected', 'cancelled') then raise exception 'Unsupported registration status'; end if;
  if p_note is null or char_length(p_note) > 500 then raise exception 'Organizer note is invalid'; end if;

  select * into selected_registration
  from public.registrations
  where id = p_registration_id
  for update;
  if not found then raise exception 'Registration not found'; end if;

  if selected_registration.schema_version = 2
    and selected_registration.registration_status in ('rejected', 'cancelled')
    and p_registration_status in ('pending', 'confirmed') then
    raise exception 'Inactive registrations cannot be reactivated; submit a new registration in the current cycle';
  end if;

  if p_registration_status = 'confirmed'
    and (p_payment_status <> 'verified'
      or p_slot is null
      or p_slot not between 1 and coalesce(selected_registration.slot_capacity, 50)) then
    raise exception 'Verified payment and an available slot within this registration capacity are required for confirmation';
  end if;

  update public.registrations set
    payment_status = p_payment_status,
    registration_status = p_registration_status,
    slot = p_slot,
    organizer_note = p_note,
    reviewed_by = auth.uid()
  where id = p_registration_id;

  if p_registration_status = 'confirmed' then
    if selected_registration.schema_version = 2 then
      select jsonb_agg(
        jsonb_build_object('displayName', participant.value ->> 'name', 'uid', participant.value ->> 'uid')
        order by participant.ordinality
      )
      into public_lineup
      from jsonb_array_elements(selected_registration.participants) with ordinality as participant(value, ordinality);
    else
      public_lineup := jsonb_build_array(jsonb_build_object(
        'displayName', selected_registration.display_name,
        'uid', selected_registration.ff_uid
      ));
    end if;

    insert into public.public_players (
      id, reference, tournament_id, time_slot_id, time_slot_label, time_slot_at,
      display_name, ff_uid, team_name, players, slot_capacity, registration_cycle,
      slot, status, confirmed_at
    ) values (
      selected_registration.id, selected_registration.reference, selected_registration.tournament_id,
      selected_registration.time_slot_id, selected_registration.time_slot_label, selected_registration.time_slot_at,
      selected_registration.display_name, selected_registration.ff_uid, selected_registration.team_name,
      public_lineup, coalesce(selected_registration.slot_capacity, 50),
      coalesce(selected_registration.registration_cycle, 1), p_slot, 'Confirmed', now()
    )
    on conflict (id) do update set
      reference = excluded.reference,
      tournament_id = excluded.tournament_id,
      time_slot_id = excluded.time_slot_id,
      time_slot_label = excluded.time_slot_label,
      time_slot_at = excluded.time_slot_at,
      display_name = excluded.display_name,
      ff_uid = excluded.ff_uid,
      team_name = excluded.team_name,
      players = excluded.players,
      slot_capacity = excluded.slot_capacity,
      registration_cycle = excluded.registration_cycle,
      slot = excluded.slot,
      status = excluded.status,
      confirmed_at = excluded.confirmed_at;
  else
    delete from public.public_players where id = p_registration_id;
  end if;
end;
$$;

revoke all on function public.review_registration(uuid, text, text, smallint, text) from public;
grant execute on function public.review_registration(uuid, text, text, smallint, text) to authenticated;

commit;

-- ============================================================================
-- Migration 2026-10-09: email-only Custom Room access
-- Source: supabase-migrations/2026-10-09-custom-room-details.sql (verbatim copy).
-- Runs after the dynamic registration migration so fresh installations receive
-- the same private email mapping and current-cycle room credential boundary.
-- ============================================================================
begin;

-- Email access mappings and room secrets are isolated from every client role.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter default privileges in schema private revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke all on sequences from public, anon, authenticated;
alter default privileges in schema private revoke all on functions from public, anon, authenticated;

create table if not exists private.registration_access_emails (
  registration_id uuid primary key references public.registrations(id) on delete cascade,
  email_normalized text not null,
  created_at timestamptz not null default now(),
  constraint registration_access_emails_email check (
    char_length(email_normalized) between 3 and 254
    and email_normalized = lower(btrim(email_normalized))
    and email_normalized ~ '^[^@[:space:][:cntrl:]]+@[^@[:space:][:cntrl:]]+$'
  )
);

create index if not exists registration_access_emails_lookup_idx
  on private.registration_access_emails (email_normalized, registration_id);

alter table private.registration_access_emails
  drop constraint if exists registration_access_emails_email_normalized_key;

create table if not exists private.tournament_room_credentials (
  tournament_id text not null,
  registration_cycle integer not null,
  room_id text not null,
  room_password text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  primary key (tournament_id, registration_cycle),
  constraint tournament_room_credentials_tournament check (
    tournament_id in ('solo-survival-01', 'squad-last-circle-01', 'clash-squad-cup-01')
  ),
  constraint tournament_room_credentials_cycle check (registration_cycle >= 1),
  constraint tournament_room_credentials_room_id check (
    char_length(room_id) between 1 and 64
    and room_id = btrim(room_id)
    and room_id !~ '[[:cntrl:]]'
  ),
  constraint tournament_room_credentials_room_password check (
    char_length(room_password) between 1 and 64
    and room_password = btrim(room_password)
    and room_password !~ '[[:cntrl:]]'
  )
);

alter table private.registration_access_emails enable row level security;
alter table private.registration_access_emails force row level security;
alter table private.tournament_room_credentials enable row level security;
alter table private.tournament_room_credentials force row level security;

revoke all on private.registration_access_emails from public, anon, authenticated;
revoke all on private.tournament_room_credentials from public, anon, authenticated;

-- The original secured registration function remains the single insertion path.
-- This overload adds the private email mapping in the same transaction.
create or replace function public.submit_registration(
  p_registration_id uuid,
  p_reference text,
  p_tournament_id text,
  p_team_name text,
  p_participants jsonb,
  p_contact_whatsapp text,
  p_payment_method text,
  p_payment_reference text,
  p_screenshot_path text,
  p_screenshot_content_type text,
  p_screenshot_size integer,
  p_registration_email text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_email text := lower(btrim(coalesce(p_registration_email, '')));
  submitted_registration_id uuid;
begin
  if char_length(normalized_email) not between 3 and 254
    or normalized_email !~ '^[^@[:space:][:cntrl:]]+@[^@[:space:][:cntrl:]]+$' then
    raise exception 'Registration email is invalid';
  end if;

  submitted_registration_id := public.submit_registration(
    p_registration_id,
    p_reference,
    p_tournament_id,
    p_team_name,
    p_participants,
    p_contact_whatsapp,
    p_payment_method,
    p_payment_reference,
    p_screenshot_path,
    p_screenshot_content_type,
    p_screenshot_size
  );

  insert into private.registration_access_emails (registration_id, email_normalized)
  values (submitted_registration_id, normalized_email);

  return submitted_registration_id;
end;
$$;

revoke all on function public.submit_registration(uuid, text, text, text, jsonb, text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.submit_registration(uuid, text, text, text, jsonb, text, text, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.submit_registration(uuid, text, text, text, jsonb, text, text, text, text, text, integer, text) to authenticated;

create or replace function public.save_tournament_room_credentials(
  p_tournament_id text,
  p_expected_cycle integer,
  p_room_id text,
  p_room_password text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_config public.match_card_overrides%rowtype;
begin
  if not public.is_active_admin() then raise exception 'Organizer access required'; end if;
  if p_tournament_id not in ('solo-survival-01', 'squad-last-circle-01', 'clash-squad-cup-01') then
    raise exception 'Unknown tournament';
  end if;
  if p_expected_cycle is null or p_expected_cycle < 1 then raise exception 'Expected registration cycle is invalid'; end if;
  if p_room_id is null
    or p_room_id is distinct from btrim(p_room_id)
    or char_length(p_room_id) not between 1 and 64
    or p_room_id ~ '[[:cntrl:]]' then
    raise exception 'Room ID must be 1 to 64 trimmed characters without control characters';
  end if;
  if p_room_password is null
    or p_room_password is distinct from btrim(p_room_password)
    or char_length(p_room_password) not between 1 and 64
    or p_room_password ~ '[[:cntrl:]]' then
    raise exception 'Room password must be 1 to 64 trimmed characters without control characters';
  end if;

  select match_config.*
  into current_config
  from public.match_card_overrides as match_config
  where match_config.tournament_id = p_tournament_id
  for update;

  if not found then raise exception 'Registration is not configured for this tournament'; end if;
  if current_config.presentation_mode <> 'registration_open'
    or current_config.scheduled_at is null
    or current_config.scheduled_at <= now() then
    raise exception 'Custom Room details can be saved only while registration is open for a future match';
  end if;
  if current_config.registration_cycle <> p_expected_cycle then
    raise exception 'Registration cycle conflict: reload the current match card';
  end if;

  insert into private.tournament_room_credentials (
    tournament_id, registration_cycle, room_id, room_password,
    created_by, updated_by
  ) values (
    current_config.tournament_id, current_config.registration_cycle,
    p_room_id, p_room_password, auth.uid(), auth.uid()
  )
  on conflict (tournament_id, registration_cycle) do update set
    room_id = excluded.room_id,
    room_password = excluded.room_password,
    updated_at = now(),
    updated_by = auth.uid();
end;
$$;

revoke all on function public.save_tournament_room_credentials(text, integer, text, text) from public, anon, authenticated;
grant execute on function public.save_tournament_room_credentials(text, integer, text, text) to authenticated;

create or replace function public.get_active_custom_rooms()
returns table (
  tournament_id text,
  tournament_name text,
  scheduled_at timestamptz,
  registration_cycle integer,
  room_id text,
  room_password text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_active_admin() then raise exception 'Organizer access required'; end if;

  return query
  select
    match_config.tournament_id,
    match_config.name,
    match_config.scheduled_at,
    match_config.registration_cycle,
    credentials.room_id,
    credentials.room_password
  from public.match_card_overrides as match_config
  left join private.tournament_room_credentials as credentials
    on credentials.tournament_id = match_config.tournament_id
    and credentials.registration_cycle = match_config.registration_cycle
  where match_config.tournament_id in ('solo-survival-01', 'squad-last-circle-01', 'clash-squad-cup-01')
    and match_config.presentation_mode = 'registration_open'
    and match_config.scheduled_at > now()
  order by match_config.scheduled_at, match_config.tournament_id;
end;
$$;

revoke all on function public.get_active_custom_rooms() from public, anon, authenticated;
grant execute on function public.get_active_custom_rooms() to authenticated;

create or replace function public.is_tournament_room_ready(p_tournament_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    coalesce(p_tournament_id in ('solo-survival-01', 'squad-last-circle-01', 'clash-squad-cup-01'), false)
    and exists (
      select 1
      from public.match_card_overrides as match_config
      join private.tournament_room_credentials as credentials
        on credentials.tournament_id = match_config.tournament_id
        and credentials.registration_cycle = match_config.registration_cycle
      where match_config.tournament_id = p_tournament_id
    );
$$;

revoke all on function public.is_tournament_room_ready(text) from public, anon, authenticated;
grant execute on function public.is_tournament_room_ready(text) to anon, authenticated;

create or replace function public.get_current_tournament_room_credentials(
  p_tournament_id text,
  p_registration_email text
)
returns table (
  room_id text,
  room_password text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_email text := lower(btrim(coalesce(p_registration_email, '')));
begin
  if p_tournament_id not in ('solo-survival-01', 'squad-last-circle-01', 'clash-squad-cup-01') then
    return;
  end if;
  if char_length(normalized_email) not between 3 and 254
    or normalized_email !~ '^[^@[:space:][:cntrl:]]+@[^@[:space:][:cntrl:]]+$' then
    return;
  end if;

  return query
  select credentials.room_id, credentials.room_password
  from public.match_card_overrides as match_config
  join private.tournament_room_credentials as credentials
    on credentials.tournament_id = match_config.tournament_id
    and credentials.registration_cycle = match_config.registration_cycle
  where match_config.tournament_id = p_tournament_id
    and exists (
      select 1
      from public.registrations as registration
      join private.registration_access_emails as access_email
        on access_email.registration_id = registration.id
      where registration.tournament_id = match_config.tournament_id
        and registration.schema_version = 2
        and registration.registration_cycle = match_config.registration_cycle
        and registration.payment_status = 'verified'
        and registration.registration_status = 'confirmed'
        and access_email.email_normalized = normalized_email
    )
  limit 1;
end;
$$;

revoke all on function public.get_current_tournament_room_credentials(text, text) from public, anon, authenticated;
grant execute on function public.get_current_tournament_room_credentials(text, text) to anon, authenticated;

commit;

-- ============================================================================
-- Migration 2026-10-10: clear current-cycle Custom Room credentials
-- Source: supabase-migrations/2026-10-10-clear-custom-room.sql
-- ============================================================================
begin;

create or replace function public.clear_tournament_room_credentials(
  p_tournament_id text,
  p_expected_cycle integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_cycle integer;
begin
  if not public.is_active_admin() then raise exception 'Organizer access required'; end if;
  if p_tournament_id not in ('solo-survival-01', 'squad-last-circle-01', 'clash-squad-cup-01') then
    raise exception 'Unknown tournament';
  end if;
  if p_expected_cycle is null or p_expected_cycle < 1 then
    raise exception 'Expected registration cycle is invalid';
  end if;

  select match_config.registration_cycle
  into current_cycle
  from public.match_card_overrides as match_config
  where match_config.tournament_id = p_tournament_id
  for update;

  if not found then raise exception 'Registration is not configured for this tournament'; end if;
  if current_cycle <> p_expected_cycle then
    raise exception 'Registration cycle conflict: reload the current match';
  end if;

  delete from private.tournament_room_credentials
  where tournament_id = p_tournament_id
    and registration_cycle = current_cycle;
end;
$$;

revoke all on function public.clear_tournament_room_credentials(text, integer) from public, anon, authenticated;
grant execute on function public.clear_tournament_room_credentials(text, integer) to authenticated;

commit;
begin;

-- Retire the known pre-consolidation Match Card overload without changing the
-- current 13-argument function.
do $retire_match_card_overloads$
begin
  if to_regprocedure(
    'public.save_match_card_override(text,text,text,text,text,text,text,integer,integer,text)'
  ) is not null then
    execute 'revoke all on function public.save_match_card_override(text, text, text, text, text, text, text, integer, integer, text) from public, anon, authenticated';
    execute 'drop function public.save_match_card_override(text, text, text, text, text, text, text, integer, integer, text)';
  end if;
end;
$retire_match_card_overloads$;

-- Room readiness and player credential access share the same current-cycle,
-- registration-open, future-match boundary. Email remains the required access
-- credential for confirmed registrations.
create or replace function public.is_tournament_room_ready(p_tournament_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    coalesce(
      p_tournament_id in (
        'solo-survival-01',
        'squad-last-circle-01',
        'clash-squad-cup-01'
      ),
      false
    )
    and exists (
      select 1
      from public.match_card_overrides as match_config
      join private.tournament_room_credentials as credentials
        on credentials.tournament_id = match_config.tournament_id
        and credentials.registration_cycle = match_config.registration_cycle
      where match_config.tournament_id = p_tournament_id
        and match_config.presentation_mode = 'registration_open'
        and match_config.scheduled_at > now()
    );
$$;

revoke all on function public.is_tournament_room_ready(text) from public, anon, authenticated;
grant execute on function public.is_tournament_room_ready(text) to anon, authenticated;

create or replace function public.get_current_tournament_room_credentials(
  p_tournament_id text,
  p_registration_email text
)
returns table (
  room_id text,
  room_password text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_email text := lower(btrim(coalesce(p_registration_email, '')));
begin
  if p_tournament_id not in (
    'solo-survival-01',
    'squad-last-circle-01',
    'clash-squad-cup-01'
  ) then
    return;
  end if;

  if char_length(normalized_email) not between 3 and 254
    or normalized_email !~ '^[^@[:space:][:cntrl:]]+@[^@[:space:][:cntrl:]]+$' then
    return;
  end if;

  return query
  select credentials.room_id, credentials.room_password
  from public.match_card_overrides as match_config
  join private.tournament_room_credentials as credentials
    on credentials.tournament_id = match_config.tournament_id
    and credentials.registration_cycle = match_config.registration_cycle
  where match_config.tournament_id = p_tournament_id
    and match_config.presentation_mode = 'registration_open'
    and match_config.scheduled_at > now()
    and exists (
      select 1
      from public.registrations as registration
      join private.registration_access_emails as access_email
        on access_email.registration_id = registration.id
      where registration.tournament_id = match_config.tournament_id
        and registration.schema_version = 2
        and registration.registration_cycle = match_config.registration_cycle
        and registration.payment_status = 'verified'
        and registration.registration_status = 'confirmed'
        and access_email.email_normalized = normalized_email
    )
  limit 1;
end;
$$;

revoke all on function public.get_current_tournament_room_credentials(text, text) from public, anon, authenticated;
grant execute on function public.get_current_tournament_room_credentials(text, text) to anon, authenticated;

-- The return shape gains an activity marker. Closed or expired current-cycle
-- rows remain visible to organizers only when credentials still need clearing.
drop function if exists public.get_active_custom_rooms();

create function public.get_active_custom_rooms()
returns table (
  tournament_id text,
  tournament_name text,
  scheduled_at timestamptz,
  registration_cycle integer,
  room_id text,
  room_password text,
  active boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_active_admin() then
    raise exception 'Organizer access required';
  end if;

  return query
  select
    match_config.tournament_id,
    match_config.name,
    match_config.scheduled_at,
    match_config.registration_cycle,
    credentials.room_id,
    credentials.room_password,
    (
      match_config.presentation_mode = 'registration_open'
      and match_config.scheduled_at > now()
    ) as active
  from public.match_card_overrides as match_config
  left join private.tournament_room_credentials as credentials
    on credentials.tournament_id = match_config.tournament_id
    and credentials.registration_cycle = match_config.registration_cycle
  where match_config.tournament_id in (
      'solo-survival-01',
      'squad-last-circle-01',
      'clash-squad-cup-01'
    )
    and (
      (
        match_config.presentation_mode = 'registration_open'
        and match_config.scheduled_at > now()
      )
      or credentials.tournament_id is not null
    )
  order by match_config.scheduled_at nulls last, match_config.tournament_id;
end;
$$;

revoke all on function public.get_active_custom_rooms() from public, anon, authenticated;
grant execute on function public.get_active_custom_rooms() to authenticated;

-- Results now snapshot any confirmed public player from any known tournament
-- cycle. Existing legacy results are retained as cycle 1.
alter table public.match_results
  add column if not exists registration_cycle integer;

update public.match_results
set registration_cycle = 1
where registration_cycle is null;

alter table public.match_results
  alter column registration_cycle set not null,
  drop constraint if exists match_results_tournament,
  drop constraint if exists match_results_time_slot,
  drop constraint if exists match_results_registration_cycle;

alter table public.match_results
  add constraint match_results_tournament check (
    tournament_id in (
      'solo-survival-01',
      'squad-last-circle-01',
      'clash-squad-cup-01'
    )
  ),
  add constraint match_results_registration_cycle check (registration_cycle >= 1);

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
  result_image_alt text;
begin
  if not public.is_active_admin() then
    raise exception 'Organizer access required';
  end if;

  if p_tournament_id is null or p_tournament_id not in (
    'solo-survival-01',
    'squad-last-circle-01',
    'clash-squad-cup-01'
  ) then
    raise exception 'Unsupported tournament';
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
    select 1
    from storage.objects
    where bucket_id = 'winner-images'
      and name = p_image_path
  ) then
    raise exception 'Winner image was not uploaded';
  end if;

  select public_player.*
  into winner
  from public.public_players as public_player
  where public_player.id = p_winner_public_player_id
    and public_player.status = 'Confirmed'
  for update;

  if not found then
    raise exception 'Choose a confirmed player from the selected lobby';
  end if;

  if winner.tournament_id not in (
      'solo-survival-01',
      'squad-last-circle-01',
      'clash-squad-cup-01'
    )
    or winner.registration_cycle is null
    or winner.registration_cycle < 1 then
    raise exception 'Confirmed player has an invalid tournament cycle';
  end if;

  if winner.tournament_id is distinct from p_tournament_id
    or winner.time_slot_id is distinct from p_time_slot_id then
    raise exception 'Choose a confirmed player from the selected lobby';
  end if;

  result_image_alt := coalesce(
    nullif(btrim(p_image_alt), ''),
    winner.display_name || ' celebrates winning ' || winner.time_slot_label
  );
  if char_length(result_image_alt) not between 5 and 180 then
    raise exception 'Winner image description must be from 5 to 180 characters';
  end if;

  insert into public.match_results (
    tournament_id,
    time_slot_id,
    time_slot_label,
    time_slot_at,
    registration_cycle,
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
    winner.tournament_id,
    winner.time_slot_id,
    winner.time_slot_label,
    winner.time_slot_at,
    winner.registration_cycle,
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
    time_slot_label = excluded.time_slot_label,
    time_slot_at = excluded.time_slot_at,
    registration_cycle = excluded.registration_cycle,
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

revoke all on function public.publish_match_result(text, text, uuid, smallint, integer, text, text) from public, anon, authenticated;
grant execute on function public.publish_match_result(text, text, uuid, smallint, integer, text, text) to authenticated;

-- Replace the non-concurrent review entry point with an optimistic-locking
-- signature. The public-player row lock serializes deconfirmation against result
-- publication, so a published winner cannot be removed by a concurrent review.
do $retire_review_registration$
begin
  if to_regprocedure(
    'public.review_registration(uuid,text,text,smallint,text)'
  ) is not null then
    execute 'revoke all on function public.review_registration(uuid, text, text, smallint, text) from public, anon, authenticated';
    execute 'drop function public.review_registration(uuid, text, text, smallint, text)';
  end if;
end;
$retire_review_registration$;

create or replace function public.review_registration(
  p_registration_id uuid,
  p_payment_status text,
  p_registration_status text,
  p_slot smallint,
  p_note text,
  p_expected_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  selected_registration public.registrations%rowtype;
  public_lineup jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'Organizer access required';
  end if;

  if p_payment_status not in ('pending', 'verified', 'not-found', 'duplicate') then
    raise exception 'Unsupported payment status';
  end if;

  if p_registration_status not in ('pending', 'confirmed', 'rejected', 'cancelled') then
    raise exception 'Unsupported registration status';
  end if;

  if p_note is null or char_length(p_note) > 500 then
    raise exception 'Organizer note is invalid';
  end if;

  if p_expected_updated_at is null then
    raise exception 'Expected registration update time is required';
  end if;

  select registration.*
  into selected_registration
  from public.registrations as registration
  where registration.id = p_registration_id
  for update;

  if not found then
    raise exception 'Registration not found';
  end if;

  if selected_registration.updated_at is distinct from p_expected_updated_at then
    raise exception 'Registration conflict: reload the current registration before reviewing';
  end if;

  if selected_registration.schema_version = 2
    and selected_registration.registration_status in ('rejected', 'cancelled')
    and p_registration_status in ('pending', 'confirmed') then
    raise exception 'Inactive registrations cannot be reactivated; submit a new registration in the current cycle';
  end if;

  if p_registration_status = 'confirmed'
    and (
      p_payment_status <> 'verified'
      or p_slot is null
      or p_slot not between 1 and coalesce(selected_registration.slot_capacity, 50)
    ) then
    raise exception 'Verified payment and an available slot within this registration capacity are required for confirmation';
  end if;

  if p_registration_status <> 'confirmed' then
    perform 1
    from public.public_players as public_player
    where public_player.id = p_registration_id
    for update;

    if exists (
      select 1
      from public.match_results as result
      where result.winner_public_player_id = p_registration_id
        and result.published = true
    ) then
      raise exception 'Remove the published winner result before deconfirming, rejecting, or cancelling this registration';
    end if;
  end if;

  update public.registrations
  set payment_status = p_payment_status,
      registration_status = p_registration_status,
      slot = p_slot,
      organizer_note = p_note,
      reviewed_by = auth.uid()
  where id = p_registration_id;

  if p_registration_status = 'confirmed' then
    if selected_registration.schema_version = 2 then
      select jsonb_agg(
        jsonb_build_object(
          'displayName', participant.value ->> 'name',
          'uid', participant.value ->> 'uid'
        )
        order by participant.ordinality
      )
      into public_lineup
      from jsonb_array_elements(selected_registration.participants)
        with ordinality as participant(value, ordinality);
    else
      public_lineup := jsonb_build_array(
        jsonb_build_object(
          'displayName', selected_registration.display_name,
          'uid', selected_registration.ff_uid
        )
      );
    end if;

    insert into public.public_players (
      id,
      reference,
      tournament_id,
      time_slot_id,
      time_slot_label,
      time_slot_at,
      display_name,
      ff_uid,
      team_name,
      players,
      slot_capacity,
      registration_cycle,
      slot,
      status,
      confirmed_at
    ) values (
      selected_registration.id,
      selected_registration.reference,
      selected_registration.tournament_id,
      selected_registration.time_slot_id,
      selected_registration.time_slot_label,
      selected_registration.time_slot_at,
      selected_registration.display_name,
      selected_registration.ff_uid,
      selected_registration.team_name,
      public_lineup,
      coalesce(selected_registration.slot_capacity, 50),
      coalesce(selected_registration.registration_cycle, 1),
      p_slot,
      'Confirmed',
      now()
    )
    on conflict (id) do update set
      reference = excluded.reference,
      tournament_id = excluded.tournament_id,
      time_slot_id = excluded.time_slot_id,
      time_slot_label = excluded.time_slot_label,
      time_slot_at = excluded.time_slot_at,
      display_name = excluded.display_name,
      ff_uid = excluded.ff_uid,
      team_name = excluded.team_name,
      players = excluded.players,
      slot_capacity = excluded.slot_capacity,
      registration_cycle = excluded.registration_cycle,
      slot = excluded.slot,
      status = excluded.status,
      confirmed_at = excluded.confirmed_at;
  else
    delete from public.public_players
    where id = p_registration_id;
  end if;
end;
$$;

revoke all on function public.review_registration(uuid, text, text, smallint, text, timestamptz) from public, anon, authenticated;
grant execute on function public.review_registration(uuid, text, text, smallint, text, timestamptz) to authenticated;

-- Deleting a terminal duplicate reconciles the shared payment reference. The
-- same advisory lock used by registration inserts keeps this cleanup serialized.
create or replace function public.delete_registration(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_status text;
  initial_payment_reference text;
  selected_payment_reference text;
  survivor_ids uuid[];
begin
  if not public.is_active_admin() then
    raise exception 'Organizer access required';
  end if;

  select registration.payment_reference
  into initial_payment_reference
  from public.registrations as registration
  where registration.id = p_registration_id;

  if not found then
    raise exception 'Registration not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(initial_payment_reference, 0));

  select registration.registration_status, registration.payment_reference
  into current_status, selected_payment_reference
  from public.registrations as registration
  where registration.id = p_registration_id
  for update;

  if not found then
    raise exception 'Registration not found';
  end if;

  if selected_payment_reference is distinct from initial_payment_reference then
    raise exception 'Registration conflict: reload before deleting';
  end if;

  if current_status not in ('cancelled', 'rejected') then
    raise exception 'Cancel or reject the registration before deleting it';
  end if;

  delete from public.public_players
  where id = p_registration_id;

  delete from public.registrations
  where id = p_registration_id;

  select array_agg(locked_registration.id order by locked_registration.id)
  into survivor_ids
  from (
    select registration.id
    from public.registrations as registration
    where registration.payment_reference = selected_payment_reference
    for update
  ) as locked_registration;

  if coalesce(cardinality(survivor_ids), 0) = 1 then
    update public.registrations
    set payment_status = 'pending'
    where id = survivor_ids[1]
      and registration_status <> 'confirmed'
      and payment_status = 'duplicate';
  end if;
end;
$$;

revoke all on function public.delete_registration(uuid) from public, anon, authenticated;
grant execute on function public.delete_registration(uuid) to authenticated;

-- Public roster reads are cycle-scoped while retaining the already-public,
-- sanitized public_players shape.
create or replace function public.get_current_public_players(p_tournament_id text)
returns table (
  id uuid,
  reference text,
  tournament_id text,
  time_slot_id text,
  time_slot_label text,
  time_slot_at timestamptz,
  display_name text,
  ff_uid text,
  slot smallint,
  status text,
  confirmed_at timestamptz,
  team_name text,
  players jsonb,
  slot_capacity integer,
  registration_cycle integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_tournament_id is null or p_tournament_id not in (
    'solo-survival-01',
    'squad-last-circle-01',
    'clash-squad-cup-01'
  ) then
    raise exception 'Unknown tournament';
  end if;

  return query
  select
    public_player.id,
    public_player.reference,
    public_player.tournament_id,
    public_player.time_slot_id,
    public_player.time_slot_label,
    public_player.time_slot_at,
    public_player.display_name,
    public_player.ff_uid,
    public_player.slot,
    public_player.status,
    public_player.confirmed_at,
    public_player.team_name,
    public_player.players,
    public_player.slot_capacity,
    public_player.registration_cycle
  from public.match_card_overrides as match_config
  join public.public_players as public_player
    on public_player.tournament_id = match_config.tournament_id
    and public_player.registration_cycle = match_config.registration_cycle
  where match_config.tournament_id = p_tournament_id
  order by public_player.time_slot_at, public_player.slot, public_player.reference;
end;
$$;

revoke all on function public.get_current_public_players(text) from public, anon, authenticated;
grant execute on function public.get_current_public_players(text) to anon, authenticated;

-- Historical roster rows remain available only to approved organizers. Public
-- clients must use the current-cycle RPC above.
create or replace function public.get_admin_public_players()
returns table (
  id uuid,
  tournament_id text,
  registration_cycle integer,
  time_slot_id text,
  time_slot_label text,
  time_slot_at timestamptz,
  display_name text,
  ff_uid text,
  slot smallint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_active_admin() then
    raise exception 'Organizer access required';
  end if;

  return query
  select
    public_player.id,
    public_player.tournament_id,
    public_player.registration_cycle,
    public_player.time_slot_id,
    public_player.time_slot_label,
    public_player.time_slot_at,
    public_player.display_name,
    public_player.ff_uid,
    public_player.slot
  from public.public_players as public_player
  order by public_player.time_slot_at desc, public_player.slot, public_player.id;
end;
$$;

revoke all on function public.get_admin_public_players() from public, anon, authenticated;
grant execute on function public.get_admin_public_players() to authenticated;

drop policy if exists "public reads confirmed players" on public.public_players;
revoke select on public.public_players from anon, authenticated;

-- Occupancy includes only schema-v2 pending and confirmed registrations in
-- currently open, future cycles.
create or replace function public.get_current_tournament_occupancy()
returns table (
  tournament_id text,
  registration_cycle integer,
  capacity integer,
  active_count integer,
  spots_left integer
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    match_config.tournament_id,
    match_config.registration_cycle,
    match_config.capacity,
    occupancy.active_count,
    greatest(match_config.capacity - occupancy.active_count, 0) as spots_left
  from public.match_card_overrides as match_config
  cross join lateral (
    select count(*)::integer as active_count
    from public.registrations as registration
    where registration.tournament_id = match_config.tournament_id
      and registration.schema_version = 2
      and registration.registration_cycle = match_config.registration_cycle
      and registration.registration_status in ('pending', 'confirmed')
  ) as occupancy
  where match_config.tournament_id in (
      'solo-survival-01',
      'squad-last-circle-01',
      'clash-squad-cup-01'
    )
    and match_config.presentation_mode = 'registration_open'
    and match_config.scheduled_at > now()
  order by match_config.scheduled_at, match_config.tournament_id;
$$;

revoke all on function public.get_current_tournament_occupancy() from public, anon, authenticated;
grant execute on function public.get_current_tournament_occupancy() to anon, authenticated;

commit;
