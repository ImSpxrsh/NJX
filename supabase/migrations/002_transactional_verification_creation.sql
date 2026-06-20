create unique index if not exists one_active_verification_per_check_idx
on public.verification_requests(check_id)
where status = 'PENDING' and used_at is null;

create or replace function public.create_pending_verification(
  target_check_id uuid,
  target_trusted_contact_id uuid,
  supplied_token_hash text,
  supplied_expires_at timestamptz
) returns table(request_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  locked_check public.checks%rowtype;
  contact_household_id uuid;
  new_request_id uuid;
begin
  if supplied_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid verification token hash';
  end if;

  if supplied_expires_at <= now() then
    raise exception 'Verification expiry must be in the future';
  end if;

  select *
  into locked_check
  from public.checks
  where id = target_check_id
  for update;

  if not found then
    raise exception 'Check unavailable';
  end if;

  if locked_check.state <> 'PAUSED'
    or locked_check.verification_level not in ('L2', 'L3') then
    raise exception 'Check must be PAUSED and require L2/L3 verification';
  end if;

  select household_id
  into contact_household_id
  from public.trusted_contacts
  where id = target_trusted_contact_id
    and destination_verified_at is not null
  for share;

  if not found or contact_household_id <> locked_check.household_id then
    raise exception 'Trusted contact unavailable';
  end if;

  if exists (
    select 1
    from public.verification_requests
    where check_id = target_check_id
      and status = 'PENDING'
      and used_at is null
  ) then
    raise exception 'Active verification request already exists';
  end if;

  insert into public.verification_requests (
    check_id,
    trusted_contact_id,
    token_hash,
    expires_at
  ) values (
    target_check_id,
    target_trusted_contact_id,
    supplied_token_hash,
    supplied_expires_at
  )
  returning id into new_request_id;

  update public.checks
  set state = 'PENDING',
      expires_at = supplied_expires_at,
      updated_at = now()
  where id = target_check_id
    and state = 'PAUSED';

  if not found then
    raise exception 'Check transition failed';
  end if;

  return query
  select new_request_id, supplied_expires_at;
end;
$$;

revoke all on function public.create_pending_verification(
  uuid,
  uuid,
  text,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.create_pending_verification(
  uuid,
  uuid,
  text,
  timestamptz
) to service_role;
