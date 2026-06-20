-- CC-104: Transactional verification request creation.
-- Creates a verification request and transitions check PAUSED -> PENDING atomically.
-- This is an updated version of create_pending_verification that works with the
-- text-column schema (no PG enums) introduced in 20240620000001_core_schema.sql.
-- Executed as service role only (restricted via REVOKE below).
create or replace function public.create_pending_verification_v2(
  p_check_id uuid,
  p_trusted_contact_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns table(request_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check_state text;
  v_household_id uuid;
  v_contact_household_id uuid;
  v_request_id uuid;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid verification token hash';
  end if;

  if p_expires_at <= now() then
    raise exception 'Verification expiry must be in the future';
  end if;

  -- Lock and validate check
  select state, household_id into v_check_state, v_household_id
  from public.checks
  where id = p_check_id
  for update;

  if not found then
    raise exception 'check_not_found' using hint = 'No check found with this ID';
  end if;

  if v_check_state != 'PAUSED' then
    raise exception 'invalid_state' using hint = 'Check must be PAUSED to create a verification request';
  end if;

  -- Validate contact belongs to same household and is verified
  select household_id into v_contact_household_id
  from public.trusted_contacts
  where id = p_trusted_contact_id
    and destination_verified_at is not null;

  if v_contact_household_id is null or v_contact_household_id != v_household_id then
    raise exception 'Trusted contact unavailable';
  end if;

  -- Check for existing active request
  if exists (
    select 1 from public.verification_requests
    where check_id = p_check_id and status = 'PENDING' and used_at is null
  ) then
    raise exception 'Active verification request already exists';
  end if;

  -- Create request
  v_request_id := gen_random_uuid();
  insert into public.verification_requests(
    id, check_id, trusted_contact_id, token_hash, expires_at
  ) values (
    v_request_id, p_check_id, p_trusted_contact_id, p_token_hash, p_expires_at
  );

  -- Transition check to PENDING
  update public.checks
  set state = 'PENDING',
      updated_at = now(),
      expires_at = p_expires_at,
      status_source = 'NO_RESPONSE'
  where id = p_check_id
    and state = 'PAUSED';

  if not found then
    raise exception 'Check transition failed';
  end if;

  return query select v_request_id, p_expires_at;
end;
$$;

revoke all on function public.create_pending_verification_v2(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.create_pending_verification_v2(uuid, uuid, text, timestamptz)
  to service_role;

-- CC-105: Atomic token consumption.
-- Hashes token, locks request, validates, transitions check state atomically.
-- This is an updated version that works with text-column schema (no PG enums).
create or replace function public.consume_verification_token_v2(
  p_token_hash text,
  p_response text
)
returns table(ok boolean, state text, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_check_id uuid;
  v_request_status text;
  v_request_used_at timestamptz;
  v_request_expires_at timestamptz;
  v_check_state text;
  v_new_state text;
begin
  -- Lock the matching request
  select id, check_id, status, used_at, expires_at
  into v_request_id, v_check_id, v_request_status, v_request_used_at, v_request_expires_at
  from public.verification_requests
  where token_hash = p_token_hash
  for update;

  if not found then
    return query select false, null::text, 'UNKNOWN_TOKEN'::text;
    return;
  end if;

  if v_request_used_at is not null or v_request_status != 'PENDING' then
    return query select false, null::text, 'ALREADY_USED'::text;
    return;
  end if;

  if v_request_expires_at <= now() then
    update public.verification_requests set status = 'EXPIRED' where id = v_request_id;
    return query select false, null::text, 'EXPIRED'::text;
    return;
  end if;

  -- Validate check is still PENDING
  select state into v_check_state from public.checks where id = v_check_id for update;

  if v_check_state != 'PENDING' then
    return query select false, null::text, 'ALREADY_USED'::text;
    return;
  end if;

  -- Mark request used
  update public.verification_requests
  set used_at = now(), responded_at = now(), response = p_response, status = 'COMPLETED'
  where id = v_request_id;

  -- CALL_ME keeps check PENDING
  if p_response = 'CALL_ME' then
    return query select true, 'PENDING'::text, null::text;
    return;
  end if;

  v_new_state := case p_response
    when 'CONFIRMED_MINE' then 'VERIFIED'
    when 'DENIED_MINE' then 'DENIED'
    else null
  end;

  if v_new_state is null then
    raise exception 'invalid_response' using hint = 'Unknown response value';
  end if;

  update public.checks
  set state = v_new_state,
      updated_at = now(),
      status_source = 'ENROLLED_CONTACT'
  where id = v_check_id;

  return query select true, v_new_state, null::text;
end;
$$;

revoke all on function public.consume_verification_token_v2(text, text)
  from public, anon, authenticated;
grant execute on function public.consume_verification_token_v2(text, text)
  to service_role;
