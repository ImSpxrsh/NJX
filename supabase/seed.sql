insert into public.households (id, display_name)
values ('00000000-0000-4000-8000-000000000001', 'CircleCheck Demo Household')
on conflict do nothing;

insert into public.trusted_contacts (
  id, household_id, display_name, email, channel, destination_verified_at
) values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'Demo Trusted Contact',
  'trusted-contact@example.test',
  'manual_demo',
  now()
) on conflict do nothing;

insert into public.phone_caller_mappings (household_id, caller_phone_hash)
values (
  '00000000-0000-4000-8000-000000000001',
  encode(digest('+15555550100', 'sha256'), 'hex')
) on conflict do nothing;
