# Trialo

Minimal hackathon implementation of a QR-based clinical-trial pre-screening flow.

## Flow

1. A coordinator creates a campaign at `/`, receiving a unique `/s/<slug>` link and QR code.
2. A participant scans the QR code and opens the mobile browser link.
3. After the consent notice, the page starts an authenticated ElevenLabs voice session.
4. Ollie uses the `record_screening_answer` client tool to store confirmed answers during the interview.
5. The app runs conservative preliminary matching against the campaign's trial criteria and shows the result in `/dashboard` for coordinator review.
6. ElevenLabs sends a post-call webhook so the dashboard marks the session complete and retains its transcript.

## Setup

1. Run `npm install`.
2. Create a Supabase project. In its SQL Editor, run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL, Supabase service-role key, ElevenLabs API key, and Ollie's Agent ID.
4. Run `npm run dev`.

## Configure Ollie

In ElevenLabs Agent settings, add a **client tool** named `record_screening_answer`:

- Set it to block the agent while it runs.
- Parameters: `field` (string, the normalized answer key) and `value` (string, the confirmed answer).
- Add this instruction to Ollie's system prompt: "After the participant confirms each answer, call `record_screening_answer` with a concise field name and the exact confirmed value. Do not call it before consent."

Set Ollie's post-call webhook to:

`https://YOUR_DEPLOYED_DOMAIN/api/elevenlabs/post-call`

The application requests a server-generated ElevenLabs conversation token, so the ElevenLabs API key is never sent to the browser.

## Important limits

- The default five trials in `src/lib/defaults.ts` are synthetic demo criteria. Replace them with protocol-reviewed criteria before any real use.
- `src/lib/matching.ts` intentionally produces only `potential_match`, `needs_information`, or `possible_exclusion`. It must not be used to make an eligibility decision.
- This hackathon implementation has no coordinator login. Add authenticated, role-based access, webhook signature verification, retention/deletion controls, audit logs, and a formal privacy/HIPAA review before handling real participant health information.
