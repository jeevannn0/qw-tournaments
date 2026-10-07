begin;

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
  constraint match_card_overrides_presentation_mode check (presentation_mode in ('coming_soon', 'scheduled')),
  constraint match_card_overrides_presentation_fields check (
    (presentation_mode = 'coming_soon' and scheduled_at is null and card_entry_fee is null and reward_label is null)
    or
    (presentation_mode = 'scheduled' and scheduled_at is not null and card_entry_fee is not null and reward_label is not null
      and card_entry_fee between 0 and 100000 and char_length(reward_label) between 5 and 120 and reward_label = btrim(reward_label))
  ),
  constraint match_card_overrides_version check (version >= 1),
  constraint match_card_overrides_change_note check (char_length(change_note) between 5 and 500 and change_note = btrim(change_note))
);

-- Upgrade the earlier presentation-only draft in place. CREATE TABLE IF NOT EXISTS
-- does not add new columns to an existing table, so every announcement column and
-- cross-field constraint is reconciled explicitly before policies and RPCs use it.
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
  add constraint match_card_overrides_presentation_mode check (presentation_mode in ('coming_soon', 'scheduled')),
  add constraint match_card_overrides_presentation_fields check (
    (presentation_mode = 'coming_soon' and scheduled_at is null and card_entry_fee is null and reward_label is null)
    or
    (presentation_mode = 'scheduled' and scheduled_at is not null and card_entry_fee is not null and reward_label is not null
      and card_entry_fee between 0 and 100000 and char_length(reward_label) between 5 and 120 and reward_label = btrim(reward_label))
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

drop function if exists public.save_match_card_override(text, text, text, text, text, text, text, integer, integer, text);
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
    name = normalized_name, tagline = normalized_tagline, description = normalized_description,
    map = normalized_map, rounds = normalized_rounds, capacity = p_capacity,
    presentation_mode = p_presentation_mode, scheduled_at = stored_scheduled_at,
    card_entry_fee = stored_entry_fee, reward_label = stored_reward,
    version = resulting_version, change_note = normalized_note, updated_by = auth.uid()
  where tournament_id = p_tournament_id;
  return resulting_version;
end;
$$;

revoke all on function public.save_match_card_override(text, text, text, text, text, text, integer, text, timestamptz, integer, text, integer, text) from public;
grant execute on function public.save_match_card_override(text, text, text, text, text, text, integer, text, timestamptz, integer, text, integer, text) to authenticated;

commit;
