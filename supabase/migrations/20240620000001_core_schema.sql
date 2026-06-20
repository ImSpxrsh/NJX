-- CC-102 / CC-104: Core schema — households, trusted_contacts, checks,
-- verification_requests, phone_alerts.
-- This migration is additive and idempotent (uses IF NOT EXISTS) so it can be
-- applied alongside the existing 001_circlecheck_foundation.sql without
-- conflicting on environments that already ran the foundation migration.

create extension if not exists "pgcrypto";

-- Households
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Trusted contacts
create table if not exists public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  display_name text not null,
  phone_e164 text,
  email text,
  channel text not null check (channel in ('sms', 'email', 'manual_demo')),
  destination_verified_at timestamptz,
  destination_verified_channel text check (destination_verified_channel in ('sms', 'email')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists trusted_contacts_household_id_idx on public.trusted_contacts(household_id);

-- Checks
-- Note: status_source and requested_action columns were added in this migration
-- to persist values that were previously derived at read time.
create table if not exists public.checks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source text not null check (source in ('web', 'phone')),
  state text not null check (state in ('RECEIVED','PAUSED','PENDING','VERIFIED','DENIED','EXPIRED')),
  verification_level text not null check (verification_level in ('L0','L1','L2','L3')),
  sanitized_summary text not null,
  evidence_json jsonb not null,
  policy_reasons jsonb not null default '[]',
  requested_action text,
  status_source text not null default 'POLICY_ENGINE'
    check (status_source in ('POLICY_ENGINE','ENROLLED_CONTACT','NO_RESPONSE','SYSTEM_EXPIRY')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);
create index if not exists checks_household_id_idx on public.checks(household_id);
create index if not exists checks_state_idx on public.checks(state);
create index if not exists checks_expires_at_idx on public.checks(expires_at) where state = 'PENDING';

-- Verification requests
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.checks(id) on delete cascade,
  trusted_contact_id uuid not null references public.trusted_contacts(id),
  token_hash text not null unique,  -- SHA-256 hex of raw token; raw token never stored
  status text not null check (status in ('PENDING','COMPLETED','EXPIRED')) default 'PENDING',
  response text check (response in ('CONFIRMED_MINE','DENIED_MINE','CALL_ME')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index if not exists verification_requests_check_id_idx on public.verification_requests(check_id);
create index if not exists verification_requests_token_hash_idx on public.verification_requests(token_hash);

-- Phone alerts
create table if not exists public.phone_alerts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  check_id uuid not null references public.checks(id),
  twilio_call_sid_hash text not null unique,
  pressed_digit text not null check (pressed_digit = '1'),
  created_at timestamptz not null default now()
);
