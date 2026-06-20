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
) returns table(result_state public.check_state, result_message text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched_request public.verification_requests%rowtype;
  next_state public.check_state;
begin
  select * into matched_request
  from public.verification_requests
  where token_hash = encode(digest(supplied_token, 'sha256'), 'hex')
    and status = 'PENDING'
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Verification request unavailable';
  end if;

  update public.verification_requests
  set response = supplied_response,
      responded_at = now(),
      used_at = now(),
      status = 'COMPLETED'
  where id = matched_request.id;

  if supplied_response = 'CALL_ME' then
    return query select 'PENDING'::public.check_state, 'Callback requested';
    return;
  end if;

  next_state := case
    when supplied_response = 'CONFIRMED_MINE' then 'VERIFIED'::public.check_state
    else 'DENIED'::public.check_state
  end;

  update public.checks
  set state = next_state, updated_at = now()
  where id = matched_request.check_id and state = 'PENDING';

  if not found then
    raise exception 'Check is not pending';
  end if;

  return query select next_state, 'Contact response recorded';
end;
$$;

revoke all on function public.consume_verification_token(text, public.verification_response)
from public, anon, authenticated;
