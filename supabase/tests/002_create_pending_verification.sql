begin;
select plan(9);

insert into public.households (id, display_name) values
  ('10000000-0000-4000-8000-000000000001', 'Household A'),
  ('10000000-0000-4000-8000-000000000002', 'Household B');

insert into public.trusted_contacts (
  id,
  household_id,
  display_name,
  email,
  channel,
  destination_verified_at
) values
  (
    '10000000-0000-4000-8000-000000000011',
    '10000000-0000-4000-8000-000000000001',
    'Contact A',
    'a@example.test',
    'email',
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000012',
    '10000000-0000-4000-8000-000000000002',
    'Contact B',
    'b@example.test',
    'email',
    now()
  );

insert into public.checks (
  id,
  household_id,
  source,
  state,
  verification_level,
  sanitized_summary,
  evidence_json,
  policy_reasons
) values
  (
    '10000000-0000-4000-8000-000000000021',
    '10000000-0000-4000-8000-000000000001',
    'web',
    'PAUSED',
    'L3',
    'High-risk test request',
    '{}'::jsonb,
    '[]'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000022',
    '10000000-0000-4000-8000-000000000001',
    'web',
    'DENIED',
    'L3',
    'Terminal test request',
    '{}'::jsonb,
    '[]'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000023',
    '10000000-0000-4000-8000-000000000001',
    'web',
    'PAUSED',
    'L3',
    'Rollback test request',
    '{}'::jsonb,
    '[]'::jsonb
  );

select lives_ok(
  $$
    select * from public.create_pending_verification(
      '10000000-0000-4000-8000-000000000021',
      '10000000-0000-4000-8000-000000000011',
      repeat('a', 64),
      now() + interval '10 minutes'
    )
  $$,
  'valid request is created'
);

select is(
  (select state::text from public.checks where id = '10000000-0000-4000-8000-000000000021'),
  'PENDING',
  'check transitions to PENDING'
);

select is(
  (select count(*)::integer from public.verification_requests where check_id = '10000000-0000-4000-8000-000000000021'),
  1,
  'exactly one request is created'
);

select throws_ok(
  $$
    select * from public.create_pending_verification(
      '10000000-0000-4000-8000-000000000021',
      '10000000-0000-4000-8000-000000000011',
      repeat('b', 64),
      now() + interval '10 minutes'
    )
  $$,
  'P0001',
  'Check must be PAUSED and require L2/L3 verification',
  'duplicate creation is rejected after row locking'
);

select throws_ok(
  $$
    select * from public.create_pending_verification(
      '10000000-0000-4000-8000-000000000023',
      '10000000-0000-4000-8000-000000000012',
      repeat('c', 64),
      now() + interval '10 minutes'
    )
  $$,
  'P0001',
  'Trusted contact unavailable',
  'cross-household contact is rejected'
);

select throws_ok(
  $$
    select * from public.create_pending_verification(
      '10000000-0000-4000-8000-000000000022',
      '10000000-0000-4000-8000-000000000011',
      repeat('d', 64),
      now() + interval '10 minutes'
    )
  $$,
  'P0001',
  'Check must be PAUSED and require L2/L3 verification',
  'terminal check is rejected'
);

select throws_ok(
  $$
    select * from public.create_pending_verification(
      '10000000-0000-4000-8000-000000000023',
      '10000000-0000-4000-8000-000000000011',
      'not-a-hash',
      now() + interval '10 minutes'
    )
  $$,
  'P0001',
  'Invalid verification token hash',
  'invalid token hash is rejected'
);

select is(
  (select state::text from public.checks where id = '10000000-0000-4000-8000-000000000023'),
  'PAUSED',
  'failed creation leaves check PAUSED'
);

select is(
  (select count(*)::integer from public.verification_requests where check_id = '10000000-0000-4000-8000-000000000023'),
  0,
  'failed creation leaves no partial request'
);

select * from finish();
rollback;
