begin;

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
