-- Squad-aware results, Booyah publish contract fix, and database linter hygiene.
--
-- 1. match_results stores the winning squad name and full lineup so the public
--    Booyah page and the organizer console show every player, not only the
--    captain that display_name/ff_uid denormalize.
-- 2. publish_match_result gains p_registration_cycle. The admin console has sent
--    that argument since commit ad2f014, but only a seven-argument overload
--    existed, so PostgREST rejected every publish with PGRST202 and no winner
--    card could ever be created. The cycle is now validated against the
--    confirmed public roster row and the old overload is removed.
-- 3. get_admin_public_players returns team_name and players so the winner
--    picker can label squads by squad name.
-- 4. Linter hygiene: organizer-only and trigger functions are no longer
--    executable by anon, RLS auth() calls are wrapped for initplan caching,
--    duplicate permissive SELECT policies are merged, and the match_results
--    winner foreign key gets a covering index.
--
-- Safe to re-run. No registration, roster, payment, or credential data changes.
begin;

-- ---------------------------------------------------------------------------
-- 1. Squad identity on published results
-- ---------------------------------------------------------------------------
alter table public.match_results
  add column if not exists team_name text,
  add column if not exists players jsonb;

alter table public.match_results drop constraint if exists match_results_team;
alter table public.match_results add constraint match_results_team check (
  (tournament_id = 'solo-survival-01' and team_name is null)
  or (
    tournament_id in ('squad-last-circle-01', 'clash-squad-cup-01')
    and char_length(team_name) between 2 and 40
    and team_name = btrim(team_name)
  )
);

alter table public.match_results drop constraint if exists match_results_lineup;
alter table public.match_results add constraint match_results_lineup check (
  public.public_player_lineup_is_valid(tournament_id, players)
  and display_name = players -> 0 ->> 'displayName'
  and ff_uid = players -> 0 ->> 'uid'
);

create index if not exists match_results_winner_public_player_idx
  on public.match_results (winner_public_player_id);

-- ---------------------------------------------------------------------------
-- 2. publish_match_result with the registration cycle the console sends
-- ---------------------------------------------------------------------------
drop function if exists public.publish_match_result(text, text, uuid, smallint, integer, text, text);

create or replace function public.publish_match_result(
  p_tournament_id text,
  p_registration_cycle integer,
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

  if p_registration_cycle is null or p_registration_cycle < 1 then
    raise exception 'Registration cycle is invalid';
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
    or winner.registration_cycle is distinct from p_registration_cycle
    or winner.time_slot_id is distinct from p_time_slot_id then
    raise exception 'Choose a confirmed player from the selected lobby';
  end if;

  result_image_alt := coalesce(
    nullif(btrim(p_image_alt), ''),
    coalesce(winner.team_name, winner.display_name) || ' celebrates winning ' || winner.time_slot_label
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
    team_name,
    players,
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
    winner.team_name,
    winner.players,
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
    team_name = excluded.team_name,
    players = excluded.players,
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

revoke all on function public.publish_match_result(text, integer, text, uuid, smallint, integer, text, text) from public, anon, authenticated;
grant execute on function public.publish_match_result(text, integer, text, uuid, smallint, integer, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Organizer roster feed includes squad identity (return type changes, so
--    the function is dropped first).
-- ---------------------------------------------------------------------------
drop function if exists public.get_admin_public_players();

create function public.get_admin_public_players()
returns table (
  id uuid,
  tournament_id text,
  registration_cycle integer,
  time_slot_id text,
  time_slot_label text,
  time_slot_at timestamptz,
  display_name text,
  ff_uid text,
  team_name text,
  players jsonb,
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
    public_player.team_name,
    public_player.players,
    public_player.slot
  from public.public_players as public_player
  order by public_player.time_slot_at desc, public_player.slot, public_player.id;
end;
$$;

revoke all on function public.get_admin_public_players() from public, anon, authenticated;
grant execute on function public.get_admin_public_players() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Linter hygiene
-- ---------------------------------------------------------------------------
-- Organizer-only SECURITY DEFINER functions must not be callable anonymously
-- (they already check is_active_admin(); this closes the lint finding).
revoke all on function public.remove_match_result(uuid) from public, anon;
revoke all on function public.save_match_card_override(text, text, text, text, text, text, integer, text, timestamptz, integer, text, integer, text) from public, anon;

-- Trigger functions are never called through the API. Execute privilege is
-- checked when a trigger is created, not when it fires, and every write path
-- that fires them runs inside SECURITY DEFINER functions owned by postgres.
revoke all on function public.flag_duplicate_payment_reference() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- auth.uid() wrapped in a scalar subquery is evaluated once per statement
-- instead of once per row.
drop policy if exists "organizer reads own approval" on public.admin_users;
create policy "organizer reads own approval" on public.admin_users
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "player reads own registration" on public.registrations;
create policy "player reads own registration" on public.registrations
  for select to authenticated
  using (owner_user_id = (select auth.uid()) or (select public.is_active_admin()));

-- "public reads match card overrides" already grants anon and authenticated
-- unconditional SELECT, so the organizer-only duplicate is redundant.
drop policy if exists "organizer reads all match card overrides" on public.match_card_overrides;

-- One permissive SELECT policy on match_results instead of two.
drop policy if exists "organizer reads all match results" on public.match_results;
drop policy if exists "public reads published match results" on public.match_results;
create policy "reads published results or organizer reads all" on public.match_results
  for select to anon, authenticated
  using (published = true or (select public.is_active_admin()));

notify pgrst, 'reload schema';

commit;
