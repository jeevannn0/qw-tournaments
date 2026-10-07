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
