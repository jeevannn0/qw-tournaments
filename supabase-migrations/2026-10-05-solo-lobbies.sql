begin;

-- Lobby columns cannot be inferred safely for existing registrations.
do $$
begin
  if exists (select 1 from public.registrations)
    or exists (select 1 from public.public_players) then
    raise exception 'Remove or explicitly migrate existing registrations before adding required lobby fields';
  end if;
end;
$$;

alter table public.registrations
  add column time_slot_id text,
  add column time_slot_label text,
  add column time_slot_at timestamptz;

alter table public.registrations
  alter column time_slot_id set not null,
  alter column time_slot_label set not null,
  alter column time_slot_at set not null;

alter table public.registrations
  add constraint registrations_time_slot check (
    (time_slot_id = 'solo-2026-10-06-1930'
      and time_slot_label = '7:30 PM lobby'
      and time_slot_at = '2026-10-06 19:30:00+05:30'::timestamptz)
    or
    (time_slot_id = 'solo-2026-10-06-2100'
      and time_slot_label = '9:00 PM lobby'
      and time_slot_at = '2026-10-06 21:00:00+05:30'::timestamptz)
  );

alter table public.registrations
  drop constraint registrations_slot;

alter table public.registrations
  add constraint registrations_slot check (slot is null or slot between 1 and 50);

alter table public.public_players
  add column time_slot_id text,
  add column time_slot_label text,
  add column time_slot_at timestamptz;

alter table public.public_players
  alter column time_slot_id set not null,
  alter column time_slot_label set not null,
  alter column time_slot_at set not null;

alter table public.public_players
  add constraint public_players_time_slot check (
    (time_slot_id = 'solo-2026-10-06-1930'
      and time_slot_label = '7:30 PM lobby'
      and time_slot_at = '2026-10-06 19:30:00+05:30'::timestamptz)
    or
    (time_slot_id = 'solo-2026-10-06-2100'
      and time_slot_label = '9:00 PM lobby'
      and time_slot_at = '2026-10-06 21:00:00+05:30'::timestamptz)
  );

alter table public.public_players
  drop constraint public_players_slot,
  drop constraint public_players_unique_slot;

alter table public.public_players
  add constraint public_players_slot check (slot between 1 and 50),
  add constraint public_players_unique_slot unique (tournament_id, time_slot_id, slot);

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

commit;
