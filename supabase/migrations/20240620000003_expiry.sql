-- CC-106: Expiry function.
-- Marks all PENDING checks with expires_at <= now() as EXPIRED.
-- Idempotent: safe to run multiple times.
-- This updates the expire_pending_checks function to also set status_source.
create or replace function public.expire_pending_checks()
returns table(expired_checks integer, expired_requests integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  request_count integer;
  check_count integer;
begin
  -- Expire associated verification requests first
  update public.verification_requests
  set status = 'EXPIRED'
  where status = 'PENDING'
    and expires_at <= now();

  get diagnostics request_count = row_count;

  -- Expire PENDING checks whose expiry window has passed
  update public.checks
  set state = 'EXPIRED',
      status_source = 'SYSTEM_EXPIRY',
      updated_at = now()
  where state = 'PENDING'
    and expires_at is not null
    and expires_at <= now();

  get diagnostics check_count = row_count;

  return query select check_count, request_count;
end;
$$;

revoke all on function public.expire_pending_checks()
  from public, anon, authenticated;
grant execute on function public.expire_pending_checks()
  to service_role;
