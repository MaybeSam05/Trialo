<p align="center">
  <img src="public/ollie/hello.webp" alt="Ollie the penguin waving" width="140">
</p>

<h1 align="center">Trialo</h1>

<p align="center">
  <strong>Clinical-trial pre-screening by voice.</strong><br>
  A coordinator shares a link or QR code, a participant has a short conversation with Ollie,<br>
  and the research team gets structured answers and a preliminary summary to review.
</p>

<p align="center">
  <a href="https://trialo-regen.netlify.app">Live demo</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#configure-ollie-elevenlabs">Configure Ollie</a> ·
  <a href="#limitations-and-responsible-use">Limitations</a>
</p>

<p align="center">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149eca?logo=react">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres-3ecf8e?logo=supabase&logoColor=white">
  <img alt="ElevenLabs" src="https://img.shields.io/badge/ElevenLabs-Conversational%20AI-000000">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg">
</p>

> [!IMPORTANT]
> Trialo is a hackathon prototype built for HackRU (Regeneron track). It uses **synthetic demo data only**. It is not a medical device and never decides eligibility: every result is a preliminary summary for clinical research staff to review.

## What it does

**For coordinators**

- **Create a campaign:** name it, add screening questions (write them, paste them, or upload a CSV), review, and get a participant link and QR code.
- **Smart questions:** each question is *fits if yes*, *flag if yes*, or *info only*. Questions can depend on gender, an age range, or an earlier answer ("ask about inhaler use only if they have asthma").
- **Live dashboard:** sessions update every few seconds and show how far each person got. Each one reads *in progress*, *complete*, or *stopped early* (participant ended it, the call ended, or the connection dropped), with a review status: **Potential match for follow-up**, **Needs review**, or **Unlikely match**.
- **Session report:** every answer in interview order, which answers support or rule out each study, and the full call transcript.
- **One interview, many studies:** each participant's answers are also compared with your other campaigns' criteria, so the dashboard shows where else they may fit (*Potential match for follow-up*, *Needs review* or *Unlikely match*) without asking them to repeat a screening. The report shows which answer each match came from, and what still needs asking.
- **Private workspaces:** coordinators sign in (Clerk) and only see their own campaigns. A one-click demo account shows sample data.

**For participants**

- Scan a QR code, type a first name (optional), and talk to **Ollie**, an animated penguin with lip-synced speech and expressions.
- **Hold to talk:** the mic is live only while you hold the button (or the Space bar on a computer), so background noise never gets in.
- A clear counter ("Question 3 of 5"), large text, and a phone layout that fits one screen without scrolling.
- Skip any question or stop at any time. Answers so far are saved, and the closing screen says honestly whether the interview finished.
- No account, nothing to install. A text-only mode is also available.

## How it works

```mermaid
sequenceDiagram
    actor C as Coordinator
    participant T as Trialo (Next.js)
    participant DB as Supabase
    actor P as Participant
    participant O as Ollie (ElevenLabs)

    C->>T: Create campaign (questions)
    T->>DB: Save campaign
    T-->>C: Link + QR code
    P->>T: Open /s/<slug>
    T->>DB: Start session (copy of the questions)
    T->>O: Start voice session with a short-lived token and the question list
    loop Each question
        O->>P: Ask
        P->>O: Answer (hold to talk)
        O->>T: record_screening_answer(field, value)
        T->>DB: Save answer, rescore
    end
    O->>T: Post-call webhook (transcript)
    T->>DB: Save transcript
    C->>T: Review dashboard and report
```

- **Questions are versioned per session.** Each session keeps a copy of the questions it started with, so editing a campaign never changes interviews in progress or past reports.
- **Scoring is conservative.** A yes to a *fits* question supports a match; a no, or a yes to a *flag* question, may rule one out. "Not sure", "prefer not to say" and skipped questions are missing information that needs review, never an exclusion.
- **Cross-study matching is transparent.** An answer carries over to another study only when the participant answered the same question (same topic in any wording, with the same time frame) or it follows from their age. Everything else is shown as "not asked", never guessed.
- **Completion means every question that applies was answered.** Hanging up or receiving a transcript doesn't count as finishing.
- **Secrets stay on the server.** The browser gets a short-lived ElevenLabs conversation token; the ElevenLabs and Supabase keys never leave the server.

## Tech stack

| Area | Choice |
| --- | --- |
| App | [Next.js 16](https://nextjs.org) (App Router), React 19, TypeScript, plain CSS |
| Voice agent | [ElevenLabs Conversational AI](https://elevenlabs.io/conversational-ai) via `@elevenlabs/react` (client tool + post-call webhook) |
| Database | [Supabase](https://supabase.com) Postgres, accessed only from server routes |
| Auth | [Clerk](https://clerk.com) for coordinators; participants never sign in |
| Hosting | [Netlify](https://www.netlify.com) |

## Getting started

### Prerequisites

- Node.js **22.13+**
- A [Supabase](https://supabase.com) project, an [ElevenLabs](https://elevenlabs.io) agent, and a [Clerk](https://clerk.com) application

### 1. Install

```bash
git clone https://github.com/MaybeSam05/Popplio-Trial.git trialo
cd trialo
npm install
```

### 2. Set up the database

In the Supabase SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql). It is idempotent: every statement is `create … if not exists` or `add column if not exists`, so re-running it on an existing database only adds what's missing.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server only) |
| `ELEVENLABS_API_KEY` | ElevenLabs API key (server only, used to mint conversation tokens) |
| `ELEVENLABS_AGENT_ID` | Ollie's agent ID |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk keys. Without them, pages don't load |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/portal/sign-in` and `/portal/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/dashboard` |
| `NEXT_PUBLIC_APP_URL` | Optional base URL for participant links and QR codes |

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000, sign up at `/portal/sign-up`, and create a campaign. Use **Use the demo preset** for a ready-made three-question asthma study.

> [!TIP]
> If sign-in keeps looping back to the portal locally, sync your computer's clock. Clerk session tokens are sensitive to clock drift.

## Configure Ollie (ElevenLabs)

1. **Client tool.** Add a client tool named `record_screening_answer`, set to block the agent while it runs, with two string parameters:
   - `field`: the question's field name
   - `value`: the participant's confirmed answer
2. **Dynamic variables.** Declare these in the agent; Trialo fills them in when each session starts:
   - `{{study_name}}`: the campaign name
   - `{{participant_name}}`: the name the participant typed (may be empty)
   - `{{study_questions}}`: the full question list, with profile questions first and each question's `[field: …]` name and "only if" rule
3. **System prompt.** Include something like:
   > Ask the questions in {{study_questions}} one at a time, in order, in plain language. Skip a question only when its "only if" rule clearly doesn't match an earlier answer. After the participant confirms an answer, call `record_screening_answer` with `field` set to the exact field name in brackets and `value` set to their answer. Never tell the participant whether they are eligible.
4. **Post-call webhook.** Point it at `https://YOUR_DOMAIN/api/elevenlabs/post-call`. It stores the transcript for the session report.

## Screening questions

Coordinators build questions in the app, or upload a CSV like this (a template can be downloaded from the editor):

```csv
id,question,type,study,ask_if,min_age,max_age
allergies,Do you have seasonal allergies?,fit,Trial A,,12,
allergy_medicine,Do you take allergy medicine during allergy season?,fit,Trial A,allergies=yes,,
recent_cold,Have you had a cold or the flu in the last two weeks?,flag,Trial A,,,
womens_group,Would you join a women-only group session?,info,Trial B,gender=female,18,
```

| Column | Meaning |
| --- | --- |
| `type` | `fit` (a yes fits), `flag` (a yes may rule out), or `info` (collected, not scored) |
| `study` | Groups questions into separate study results within one campaign |
| `ask_if` | Ask only when an earlier answer matches, e.g. `gender=female` or `allergies=yes` |
| `min_age`, `max_age` | Ask only within an age range |

Every interview starts with two profile questions, age and gender. The participant's name is typed on the welcome screen rather than spoken, because names are easy to mishear.

## Demo data

```bash
npm run seed:demo        # three synthetic campaigns and about 55 sessions over two weeks
npm run demo:user        # create (or reset) the shared "trialo-demo" coordinator account
```

- `seed:demo` only replaces campaigns whose slug starts with `demo-`, so it's safe to re-run. Add `-- --clear-all` to wipe every campaign first, or run `npx tsx scripts/seed-demo.ts --dry-run` to preview without touching the database.
- `demo:user` prints a fresh password and gives the account every campaign without an owner. The portal's **Demo** button signs visitors into it with a one-time token.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Regression checks for rules, scoring, progress, endings, webhooks and request handling (no network or database needed) |
| `npm run seed:demo` | Load synthetic demo data |
| `npm run demo:user` | Create or reset the demo coordinator account |

## Project structure

```text
src/
  app/
    page.tsx                  Create a campaign
    s/[slug]/                 Participant interview (public)
    dashboard/                Sessions board, campaigns, session reports
    portal/                   Coordinator sign-in and sign-up (Clerk)
    api/
      studies/                Create campaigns, edit questions
      public/[slug]/sessions  Start a session (public)
      sessions/[id]/          Save answers, link the conversation, record how the call ended
      elevenlabs/             Conversation tokens, post-call webhook
  components/
    voice-screening.tsx       ElevenLabs wiring: client tool, dynamic variables, hold-to-talk mic
    participant/              Welcome, interview screen, Ollie, speech bubble, talk button
    coordinator/              Question editor, campaign review and sharing
    dashboard/                Live sessions board, outcome and interview-state rules
  lib/
    questions.ts              Question model, conditions, scoring, progress, CSV parsing
    cross-match.ts            Compare one participant's answers with other studies' criteria
supabase/schema.sql           Tables and additive migrations
scripts/                      Demo seeding, demo account, regression checks
```

## Deployment

Trialo runs on Netlify (Next.js is detected automatically). Set the environment variables above in the Netlify site settings, run `supabase/schema.sql` on the production database, and update Ollie's post-call webhook URL to the deployed domain.

## Limitations and responsible use

- **Synthetic data only.** Don't enter real health information. The participant screen says so too.
- **Not an eligibility decision.** Results are limited to *potential match*, *needs information* and *possible exclusion*, summarised as **Potential match for follow-up**, **Needs review** or **Unlikely match**, and always need review by qualified research staff.
- **Before any real use**, add webhook signature verification, role-based access and audit logs, data retention and deletion controls, protocol-reviewed criteria, and a formal privacy/HIPAA review.
- Voice-agent behaviour (which questions get asked, how answers are worded) depends on the ElevenLabs agent's prompt and settings.

## License

[MIT](LICENSE) © 2026 The Trialo team
