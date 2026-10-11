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

## Coordinator accounts (Clerk)

Coordinators sign in at `/portal` with a username and password (sign-up is open at `/portal/sign-up`). Each account only sees the campaigns it created (`studies.owner_id`) and their sessions. Participants never sign in: `/s/<slug>`, the participant APIs and the ElevenLabs webhook stay public.

- Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env.local` (and Netlify), plus `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/portal`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/portal/sign-up` and both `..._FALLBACK_REDIRECT_URL=/dashboard`. Without the keys every page fails to load.
- Run the `owner_id` lines in `supabase/schema.sql` once.
- `npm run demo:user` creates (or resets the password of) the shared `trialo-demo` account and gives it every campaign without an owner.
- If sign-in loops back to the portal locally, sync your computer clock; Clerk session tokens are sensitive to clock drift.

## Demo data

`npm run seed:demo` fills Supabase with realistic, fully synthetic data: three campaigns with their own question lists and about 55 sessions over the past two weeks (completed, unsure, exclusions, drop-offs, links opened but never started, and two people "answering now"). It replaces only campaigns whose slug starts with `demo-`, so it is safe to re-run.

- `npm run seed:demo -- --clear-all` also deletes every other campaign and session first (use it to wipe old test data).
- `npx tsx scripts/seed-demo.ts --dry-run` previews the data without touching the database.

Requires `.env.local` and the `studies.questions` column from `supabase/schema.sql`.

## Configure Ollie

In ElevenLabs Agent settings, add a **client tool** named `record_screening_answer`:

- Set it to block the agent while it runs.
- Parameters: `field` (string, the normalized answer key) and `value` (string, the confirmed answer).
- Add this instruction to Ollie's system prompt: "After the participant confirms each answer, call `record_screening_answer` with a concise field name and the exact confirmed value. Do not call it before consent."

### Coordinator-defined questions

Coordinators edit each campaign's questions at `/` (when creating) or `/dashboard/studies/<slug>` (afterwards). Questions are stored in `studies.questions` (run the last statement of `supabase/schema.sql` once on existing databases; until then campaigns fall back to the demo trials). Each question is yes/no and is marked as *include* (a yes fits), *exclude* (a yes is a flag) or *info* (collected, not scored).

The app passes two dynamic variables when a session starts, so Ollie's system prompt must use them instead of a fixed question list:

- `{{study_name}}`: the campaign name.
- `{{study_questions}}`: a numbered list such as `1. [field: q1] Do you have type 2 diabetes?`.

Add to Ollie's system prompt: "Ask the questions in {{study_questions}} one at a time, in order, in plain language. After the participant confirms an answer, call `record_screening_answer` with `field` set to the exact field name in brackets and `value` set to yes, no or not sure. If {{study_questions}} is empty, use your default questions." Then declare both variables in the agent's dynamic-variable settings.

Set Ollie's post-call webhook to:

`https://YOUR_DEPLOYED_DOMAIN/api/elevenlabs/post-call`

The application requests a server-generated ElevenLabs conversation token, so the ElevenLabs API key is never sent to the browser.

## Important limits

- The default five trials in `src/lib/defaults.ts` are synthetic demo criteria. Replace them with protocol-reviewed criteria before any real use.
- `src/lib/matching.ts` intentionally produces only `potential_match`, `needs_information`, or `possible_exclusion`. It must not be used to make an eligibility decision.
- This hackathon implementation has no coordinator login. Add authenticated, role-based access, webhook signature verification, retention/deletion controls, audit logs, and a formal privacy/HIPAA review before handling real participant health information.
