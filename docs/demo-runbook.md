# Demo runbook

## Prerequisites

Demo mode requires `CIRCLECHECK_REPOSITORY_MODE=demo` in your environment.
Copy `.env.example` to `.env.local` — the default file sets this value.

Demo mode is **disabled by default**. The following values do NOT enable it:
`""`, `"false"`, `"False"`, `"FALSE"`, `"0"`, `"no"`, `"off"`, `"development"`,
`"production"`, or any string other than `"demo"`.

Setting `NODE_ENV=production` together with `CIRCLECHECK_REPOSITORY_MODE=demo`
is contradictory. The runtime resolves to production mode and disables all
demo behavior.

## Starting the demo

1. Run `npm install`, copy `.env.example` to `.env.local`, and run `npm run dev`.
2. Open `http://localhost:3000/demo`.
   A yellow **DEMO MODE** banner is visible at the top of every page while
   demo mode is active. It will not appear in production.
3. Select **Reset and create demo request**. This loads the gift-card fixture.
4. Open the senior view and observe L3, the explicit hold, and pending status.
5. Open the trusted-contact view in another tab using the `demoContactUrl`
   returned by `/api/analyze`. This URL is only present in demo mode.
6. Select **No, this request was not mine**, confirm, and return to the senior
   tab. Short polling changes the source-labeled state to DENIED.
7. For Twilio, call the configured number and press 1. The spoken path stores no
   audio; use server/Supabase inspection until contact delivery is integrated.
8. To demonstrate network failure, stop the dev server. The user should continue
   to follow the printed-card instruction and known callback number.
9. External model failure needs no intervention: fixture/rule extraction is the
   current default and LLM provider fallback.

Repeat from step 2 to reset temporary state.

## Non-production banner

The yellow banner (`DEMO MODE — This environment uses simulated data...`)
appears in the application shell whenever `CIRCLECHECK_REPOSITORY_MODE=demo`
is set. It is rendered server-side and cannot be activated by query parameters,
cookies, local storage, or any client-controlled mechanism.

## Running environment-mode tests

```bash
npm test -- src/lib/runtime-mode.test.ts
npm test -- src/app/api/analyze/route.test.ts
npm test -- src/app/api/demo/reset/route.test.ts
npm test -- src/components/DemoBanner.test.tsx
```

Or run all tests:

```bash
npm test
```
