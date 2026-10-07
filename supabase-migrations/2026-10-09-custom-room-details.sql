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
