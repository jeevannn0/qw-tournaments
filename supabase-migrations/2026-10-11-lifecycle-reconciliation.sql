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
