# Demo runbook

1. Run `npm install`, copy `.env.example` to `.env.local`, set
   `CIRCLECHECK_RUNTIME_MODE=demo` and `CIRCLECHECK_REPOSITORY_MODE=demo`, then
   run `npm run dev`.
2. Open `http://localhost:3000/demo`.
3. Select **Reset and create demo request**. This loads the gift-card fixture.
4. Open the senior view and observe L3, the explicit hold, and pending status.
5. Open the trusted-contact view in another tab.
6. Select **No, this request was not mine**, confirm, and return to the senior
   tab. Short polling changes the source-labeled state to DENIED.
7. For Twilio, call the configured number and press 1. The spoken path stores no
   audio recording, transcription, or speech model configuration. Known caller
   routing creates a pending L3 check and delivers the same one-time
   trusted-contact link path as web checks; unknown callers hear only
   printed-card safety instructions.
8. To demonstrate network failure, stop the dev server. The user should continue
   to follow the printed-card instruction and known callback number.
9. External model failure needs no intervention: fixture/rule extraction is the
   current default and LLM provider fallback.

Repeat from step 2 to reset temporary state.
