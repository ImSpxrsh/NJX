create extension if not exists pgcrypto;

create type public.check_source as enum ('web', 'phone');
create type public.check_state as enum (
  'RECEIVED', 'PAUSED', 'PENDING', 'VERIFIED', 'DENIED', 'EXPIRED'
);
create type public.verification_level as enum ('L0', 'L1', 'L2', 'L3');
create type public.verification_response as enum (
  'CONFIRMED_MINE', 'DENIED_MINE', 'CALL_ME'
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  phone_e164 text,
  email text,
  channel text not null check (channel in ('sms', 'email', 'manual_demo')),
  destination_verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint usable_destination check (phone_e164 is not null or email is not null)
);

create table public.checks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source public.check_source not null,
  state public.check_state not null,
  verification_level public.verification_level not null,
  sanitized_summary text not null check (char_length(sanitized_summary) <= 500),
  evidence_json jsonb not null,
  policy_reasons jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.checks(id) on delete cascade,
  trusted_contact_id uuid not null references public.trusted_contacts(id),
  token_hash text not null unique check (char_length(token_hash) = 64),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'COMPLETED', 'EXPIRED')),
  response public.verification_response,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table public.phone_alerts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  check_id uuid not null references public.checks(id) on delete cascade,
  twilio_call_sid_hash text not null unique check (char_length(twilio_call_sid_hash) = 64),
  pressed_digit text not null check (pressed_digit = '1'),
  created_at timestamptz not null default now()
);

create index checks_state_idx on public.checks(state);
create index checks_expiry_idx on public.checks(expires_at);
create index trusted_contacts_household_idx on public.trusted_contacts(household_id);
create index verification_requests_hash_idx on public.verification_requests(token_hash);
create index verification_requests_expiry_idx on public.verification_requests(expires_at);

alter table public.households enable row level security;
alter table public.trusted_contacts enable row level security;
alter table public.checks enable row level security;
alter table public.verification_requests enable row level security;
alter table public.phone_alerts enable row level security;

create or replace function public.consume_verification_token(
  supplied_token text,
  supplied_response public.verification_response
) returns table(result_status text, result_state public.check_state, result_message text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched_request_id uuid;
  matched_check_id uuid;
  next_state public.check_state;
begin
  if supplied_token is null or supplied_token !~ '^[A-Za-z0-9_-]{43}$' then
    return query select
      'REJECTED',
      null::public.check_state,
      'Verification response was not accepted';
    return;
  end if;

  select vr.id, vr.check_id into matched_request_id, matched_check_id
  from public.verification_requests vr
  join public.checks c on c.id = vr.check_id
  where vr.token_hash = encode(digest(supplied_token, 'sha256'), 'hex')
    and vr.status = 'PENDING'
    and vr.used_at is null
    and vr.expires_at > now()
    and c.state = 'PENDING'
    and not exists (
      select 1
      from public.verification_requests newer
      where newer.check_id = vr.check_id
        and newer.created_at > vr.created_at
    )
  for update of vr, c;

  if not found then
    return query select
      'REJECTED',
      null::public.check_state,
      'Verification response was not accepted';
    return;
  end if;

  if supplied_response = 'CALL_ME' then
    update public.verification_requests
    set response = supplied_response,
        responded_at = now(),
        used_at = now(),
        status = 'COMPLETED'
    where id = matched_request_id;

    return query select
      'ACCEPTED',
      'PENDING'::public.check_state,
      'Verification response recorded';
    return;
  end if;

  next_state := case
    when supplied_response = 'CONFIRMED_MINE' then 'VERIFIED'::public.check_state
    else 'DENIED'::public.check_state
  end;

  update public.checks
  set state = next_state, updated_at = now()
  where id = matched_check_id and state = 'PENDING';

  if not found then
    return query select
      'REJECTED',
      null::public.check_state,
      'Verification response was not accepted';
    return;
  end if;

  update public.verification_requests
  set response = supplied_response,
      responded_at = now(),
      used_at = now(),
      status = 'COMPLETED'
  where id = matched_request_id;

  return query select
    'ACCEPTED',
    next_state,
    'Verification response recorded';
end;
$$;

revoke all on function public.consume_verification_token(text, public.verification_response)
from public, anon, authenticated;
