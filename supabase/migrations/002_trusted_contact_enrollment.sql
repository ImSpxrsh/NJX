-- CC-101: trusted-contact enrollment + destination verification.
--
-- Extends the trusted_contacts table with the destination-verification channel
-- and an updated_at column, and adds a separate table of short-lived, hashed
-- one-time codes that prove a household controls a destination. Verification
-- here is distinct from verification_requests (which verifies a suspicious
-- check against an already-enrolled contact).

-- --- trusted_contacts: record which channel verified the destination --------
alter table public.trusted_contacts
  add column if not exists destination_verified_channel text
    check (destination_verified_channel in ('sms', 'email'));

alter table public.trusted_contacts
  add column if not exists updated_at timestamptz not null default now();

-- verified_at and verified_channel are all-or-nothing consistent. Fails closed
-- against partially written verification state.
alter table public.trusted_contacts
  add constraint trusted_contacts_verification_consistent check (
    (destination_verified_at is null and destination_verified_channel is null)
    or
    (destination_verified_at is not null and destination_verified_channel is not null)
  );

-- One row per destination value within a household (blocks duplicates).
create unique index if not exists trusted_contacts_household_phone_idx
  on public.trusted_contacts(household_id, phone_e164)
  where phone_e164 is not null;
create unique index if not exists trusted_contacts_household_email_idx
  on public.trusted_contacts(household_id, email)
  where email is not null;

-- --- destination verification challenges (OTP codes) ------------------------
create table public.contact_destination_verifications (
  id uuid primary key default gen_random_uuid(),
  trusted_contact_id uuid not null
    references public.trusted_contacts(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  channel text not null check (channel in ('sms', 'email')),
  -- SHA-256 hex of the OTP. The plaintext code is never stored.
  code_hash text not null check (char_length(code_hash) = 64),
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);

create index contact_dest_verifications_contact_idx
  on public.contact_destination_verifications(trusted_contact_id);
create index contact_dest_verifications_household_created_idx
  on public.contact_destination_verifications(household_id, created_at);

alter table public.contact_destination_verifications enable row level security;

-- --- atomic consume: mark the challenge used AND verify the destination ------
-- Mirrors consume_verification_token: a single transaction so consumption and
-- the trust-state change cannot diverge (CLAUDE.md invariant 9).
create or replace function public.consume_destination_verification(
  supplied_contact_id uuid,
  supplied_code text,
  supplied_channel text
) returns public.trusted_contacts
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched public.contact_destination_verifications%rowtype;
  updated_contact public.trusted_contacts%rowtype;
begin
  select * into matched
  from public.contact_destination_verifications
  where trusted_contact_id = supplied_contact_id
    and consumed = false
    and expires_at > now()
    and code_hash = encode(digest(supplied_code, 'sha256'), 'hex')
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Verification challenge unavailable';
  end if;

  update public.contact_destination_verifications
  set consumed = true
  where id = matched.id;

  update public.trusted_contacts
  set destination_verified_at = now(),
      destination_verified_channel = supplied_channel,
      updated_at = now()
  where id = supplied_contact_id
  returning * into updated_contact;

  return updated_contact;
end;
$$;

revoke all on function public.consume_destination_verification(uuid, text, text)
from public, anon, authenticated;
