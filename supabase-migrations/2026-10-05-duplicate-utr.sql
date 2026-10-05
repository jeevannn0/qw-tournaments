begin;

create or replace function public.flag_duplicate_payment_reference()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.payment_reference, 0));

  if exists (
    select 1 from public.registrations
    where payment_reference = new.payment_reference
  ) then
    new.payment_status = 'duplicate';
    update public.registrations
    set payment_status = 'duplicate'
    where payment_reference = new.payment_reference
      and registration_status <> 'confirmed';
  end if;

  return new;
end;
$$;

drop trigger if exists registrations_flag_duplicate_payment on public.registrations;
create trigger registrations_flag_duplicate_payment
before insert on public.registrations
for each row execute function public.flag_duplicate_payment_reference();

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
  and payment_status in ('pending', 'duplicate')
  and registration_status = 'pending'
  and slot is null
  and organizer_note = ''
  and reviewed_by is null
  and rules_accepted
  and guardian_approved
  and payment_confirmed
  and public_roster_approved
);

commit;
