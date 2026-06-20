# CircleCheck

CircleCheck is an accessible, risk-adaptive verification prototype for urgent
impersonation requests. It extracts explainable warning signs, applies a
deterministic L0-L3 policy, and routes high-risk requests to a pre-enrolled
trusted contact.

It is not a fraud classifier, voice-clone detector, or guarantee that a request
is legitimate.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Demo behavior is disabled by default. For the deterministic two-screen demo,
set these server-side values:

```env
CIRCLECHECK_RUNTIME_MODE=demo
CIRCLECHECK_REPOSITORY_MODE=demo
PUBLIC_APP_URL=http://localhost:3000
```

Then open `http://localhost:3000/demo`. A production-built deployment must also
set `CIRCLECHECK_DEMO_DEPLOYMENT=true` deliberately; production plus demo
without that marker is rejected.

## Quality gates

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

See `docs/` for architecture, API contracts, threat model, demo steps, and
limitations.

## Database types

`src/types/database.ts` is synchronized with the checked-in Supabase migration.
After changing the local Supabase schema, regenerate it with:

```bash
npm run db:types
```

Review generated changes together with the migration. Domain code must continue
to use runtime-validated mapper functions rather than trusting generated row
types at API boundaries. Read mappers validate database rows, while write
mappers construct restricted inserts such as PAUSED-only check creation.

Database policy tests require a running local Supabase stack:

```bash
npx supabase start
npm run test:db
```
