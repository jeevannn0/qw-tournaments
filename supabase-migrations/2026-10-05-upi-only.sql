begin;

-- Refuse to tighten the constraint if an unexpected non-UPI record exists.
do $$
begin
  if exists (
    select 1 from public.registrations where payment_method <> 'upi'
  ) then
    raise exception 'Resolve non-UPI registrations before applying the UPI-only constraint';
  end if;
end;
$$;

alter table public.registrations
  drop constraint if exists registrations_payment_method;

alter table public.registrations
  add constraint registrations_payment_method
  check (payment_method = 'upi');

commit;
