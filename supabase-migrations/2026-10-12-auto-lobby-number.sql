begin;

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
  effective_registration_status text;
  assigned_slot smallint;
  public_lineup jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'Organizer access required';
  end if;

  if p_payment_status is null
    or p_payment_status not in ('pending', 'verified', 'not-found', 'duplicate') then
    raise exception 'Unsupported payment status';
  end if;

  if p_registration_status is null
    or p_registration_status not in ('pending', 'confirmed', 'rejected', 'cancelled') then
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

  perform pg_advisory_xact_lock(
    hashtextextended(
      selected_registration.tournament_id || ':' || selected_registration.time_slot_id,
      0
    )
  );

  if selected_registration.schema_version = 2
    and selected_registration.registration_status in ('rejected', 'cancelled')
    and p_registration_status in ('pending', 'confirmed') then
    raise exception 'Inactive registrations cannot be reactivated; submit a new registration in the current cycle';
  end if;

  effective_registration_status := case
    when p_registration_status in ('rejected', 'cancelled') then p_registration_status
    when p_payment_status = 'verified' then 'confirmed'
    else 'pending'
  end;

  if effective_registration_status = 'confirmed' then
    if selected_registration.registration_status = 'confirmed'
      and selected_registration.slot between 1 and coalesce(selected_registration.slot_capacity, 50)
      and not exists (
        select 1
        from public.public_players as occupied_player
        where occupied_player.tournament_id = selected_registration.tournament_id
          and occupied_player.time_slot_id = selected_registration.time_slot_id
          and occupied_player.slot = selected_registration.slot
          and occupied_player.id <> selected_registration.id
      ) then
      assigned_slot := selected_registration.slot;
    else
      select candidate.slot::smallint
      into assigned_slot
      from generate_series(
        1,
        coalesce(selected_registration.slot_capacity, 50)
      ) as candidate(slot)
      where not exists (
        select 1
        from public.public_players as occupied_player
        where occupied_player.tournament_id = selected_registration.tournament_id
          and occupied_player.time_slot_id = selected_registration.time_slot_id
          and occupied_player.slot = candidate.slot
          and occupied_player.id <> selected_registration.id
      )
      order by candidate.slot
      limit 1;

      if assigned_slot is null then
        raise exception 'No lobby slots are available for this tournament time slot';
      end if;
    end if;
  else
    assigned_slot := null;

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
      registration_status = effective_registration_status,
      slot = assigned_slot,
      organizer_note = p_note,
      reviewed_by = auth.uid()
  where id = p_registration_id;

  if effective_registration_status = 'confirmed' then
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
      assigned_slot,
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

commit;
