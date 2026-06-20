-- CC-202 Destination verification.
--
-- Enrollment verification is a separate subsystem from request verification
-- (migration 001): its own table, its own purpose-bound hashing, and its own
-- consume functions. A request-verification token can never satisfy an
-- enrollment check and vice versa because the hashed value is domain-separated
-- by the purpose prefix below, matching src/lib/security/enrollment-tokens.ts.

create type public.enrollment_channel as enum ('sms', 'email');
create type public.enrollment_status as enum (
  'PENDING', 'VERIFIED', 'EXPIRED', 'LOCKED'
);

create table public.enrollment_verifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  trusted_contact_id uuid not null
    references public.trusted_contacts(id) on delete cascade,
  channel public.enrollment_channel not null,
  -- Destination under verification. Internal only; never exposed in public reads.
  destination text not null,
  -- Purpose-bound SHA-256 of the code/link token. The raw secret is never stored.
  secret_hash text not null check (char_length(secret_hash) = 64),
  status public.enrollment_status not null default 'PENDING',
  attempt_count int not null default 0 check (attempt_count >= 0),
  max_attempts int not null default 5 check (max_attempts between 1 and 20),
  resend_count int not null default 0 check (resend_count >= 0),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now()
);

create index enrollment_verifications_contact_idx
  on public.enrollment_verifications(trusted_contact_id);
create index enrollment_verifications_hash_idx
  on public.enrollment_verifications(secret_hash);
create index enrollment_verifications_status_idx
  on public.enrollment_verifications(status);
create index enrollment_verifications_expiry_idx
  on public.enrollment_verifications(expires_at);

-- Enforce at most one active (PENDING) enrollment per contact at the database
-- level, so a retry/resend can never create multiple simultaneously valid
-- secrets even under concurrency.
create unique index enrollment_verifications_one_pending
  on public.enrollment_verifications(trusted_contact_id)
  where status = 'PENDING';

alter table public.enrollment_verifications enable row level security;

-- Email/link consumption. Located by hash, so no identifier is needed in the
-- URL. Returns a status to trusted server code, which collapses every
-- non-VERIFIED outcome to a single generic failure before responding.
create or replace function public.consume_enrollment_link(
  supplied_token text
) returns table(verified boolean, result_status public.enrollment_status)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched public.enrollment_verifications%rowtype;
  computed_hash text := encode(
    digest(
      'circlecheck:enrollment-destination:v1:link:' || supplied_token,
      'sha256'
    ),
    'hex'
  );
begin
  select * into matched
  from public.enrollment_verifications
  where secret_hash = computed_hash
    and channel = 'email'
    and status = 'PENDING'
  for update;

  if not found then
    return query select false, 'EXPIRED'::public.enrollment_status;
    return;
  end if;

  if matched.expires_at <= now() then
    update public.enrollment_verifications
    set status = 'EXPIRED' where id = matched.id;
    return query select false, 'EXPIRED'::public.enrollment_status;
    return;
  end if;

  update public.enrollment_verifications
  set status = 'VERIFIED', consumed_at = now(), last_attempt_at = now()
  where id = matched.id;

  update public.trusted_contacts
  set destination_verified_at = now(),
      email = matched.destination,
      channel = 'email'
  where id = matched.trusted_contact_id;

  return query select true, 'VERIFIED'::public.enrollment_status;
end;
$$;

-- SMS/code consumption. Attempt increments are committed even on failure (no
-- exception-based rollback), and the per-contact attempt cap locks the record.
create or replace function public.consume_enrollment_code(
  p_contact uuid,
  supplied_code text
) returns table(verified boolean, result_status public.enrollment_status)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched public.enrollment_verifications%rowtype;
  computed_hash text := encode(
    digest(
      'circlecheck:enrollment-destination:v1:code:'
        || p_contact::text || ':' || supplied_code,
      'sha256'
    ),
    'hex'
  );
begin
  select * into matched
  from public.enrollment_verifications
  where trusted_contact_id = p_contact
    and channel = 'sms'
    and status = 'PENDING'
  order by created_at desc
  limit 1
  for update;

  if not found then
    return query select false, 'EXPIRED'::public.enrollment_status;
    return;
  end if;

  if matched.expires_at <= now() then
    update public.enrollment_verifications
    set status = 'EXPIRED' where id = matched.id;
    return query select false, 'EXPIRED'::public.enrollment_status;
    return;
  end if;

  if matched.attempt_count >= matched.max_attempts then
    update public.enrollment_verifications
    set status = 'LOCKED' where id = matched.id;
    return query select false, 'LOCKED'::public.enrollment_status;
    return;
  end if;

  if matched.secret_hash <> computed_hash then
    update public.enrollment_verifications
    set attempt_count = attempt_count + 1,
        last_attempt_at = now(),
        status = case
          when attempt_count + 1 >= max_attempts
          then 'LOCKED'::public.enrollment_status
          else status
        end
    where id = matched.id;
    return query
      select false,
        (select status from public.enrollment_verifications where id = matched.id);
    return;
  end if;

  update public.enrollment_verifications
  set status = 'VERIFIED', consumed_at = now(), last_attempt_at = now()
  where id = matched.id;

  update public.trusted_contacts
  set destination_verified_at = now(),
      phone_e164 = matched.destination,
      channel = 'sms'
  where id = matched.trusted_contact_id;

  return query select true, 'VERIFIED'::public.enrollment_status;
end;
$$;

revoke all on function public.consume_enrollment_link(text)
from public, anon, authenticated;
revoke all on function public.consume_enrollment_code(uuid, text)
from public, anon, authenticated;
