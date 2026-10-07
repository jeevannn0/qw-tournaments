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
