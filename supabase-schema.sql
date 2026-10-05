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
create policy "player creates complete registration"
on public.registrations
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and schema_version = 1
  and tournament_id = 'solo-survival-01'
  and tournament_name = 'Solo Survival 01'
  and payment_amount = 10
  and payment_status = 'pending'
  and registration_status = 'pending'
  and slot is null
  and organizer_note = ''
  and reviewed_by is null
  and rules_accepted
  and guardian_approved
  and payment_confirmed
  and public_roster_approved
);

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
grant select, insert on public.registrations to authenticated;
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

commit;

-- After creating the organizer in Authentication, approve that user with:
-- insert into public.admin_users (user_id, email)
-- select id, email from auth.users where email = 'organizer@example.com';
