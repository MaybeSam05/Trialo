# Coordinator dashboard

`/dashboard` loads the account's latest 500 screening sessions with a server-side Supabase query. The summary counts sessions, not individual trial results; each session contributes to exactly one outcome tile.

## Overall session status

- Any status other than `completed`, or no trial results: **Needs review**.
- A completed session with a potential match to any trial: **Potential match for follow-up**, even if other trials need information or report exclusions.
- A completed session with reported exclusions for every returned trial: **Unlikely match**.
- All other combinations: **Needs review**.

These are preliminary display summaries. Matching logic, saved results, and final eligibility decisions are not changed. Open the linked session report for per-trial results.

`status.tsx` uses the shared `SessionChip` for Needs review and the existing chip classes for the two dashboard-specific labels. Per-trial results in the session report use the shared `MatchChip` (`src/components/status-chip.tsx`).

## Live board

- `live-updates.tsx` re-fetches the page every 5 seconds while the tab is visible, and right away when you return to the tab. The "Live · updated Ns ago" label shows when it last refreshed.
- `sessions-board.tsx` renders the summary tiles and the table on the client. The bar above the table has search (campaign name or session ID), status (including "Answering now"), campaign, date range and sort, plus pagination. Filters survive live refreshes, and active filters show as removable pills.
- **Answering now**: a session that isn't complete, has no recorded end (`end_reason`) or transcript, and was updated in the last 10 minutes. `updated_at` is bumped by the answers API on every saved answer (not by the post-call webhook).
- **Complete** means every question that applies to the participant (age, gender and the campaign's questions, after conditions and age limits) has an answer. Ending the call or receiving a transcript doesn't make a session complete. Otherwise it's **Stopped early**, with how it ended when known: the participant pressed End, Ollie's call ended, or the connection dropped (`end_reason`, reported by the interview page).
- Sessions that arrive between refreshes flash with a "New" badge (and are announced to screen readers); in-progress answer counts pulse when they go up.
- **Other studies**: the participant's best fits among this account's other campaigns (Potential match / Needs review), from answers they already gave; hover for "Fits N of M criteria". Matching rules are in `src/lib/cross-match.ts`; the session report lists every criterion and which answer it came from.
- Responses show "N of M answered", counting the questions that apply to that participant (never the typed name), the same rule as the participant's counter and the session report (`answerProgress` in `src/lib/questions.ts`). Legacy campaigns without a question list show "N saved".

## Local checks

Run `npm run lint`, `npm test`, `npx tsc --noEmit` and `npm run build`. Check `/dashboard` at 390px and 1440px with synthetic sessions only. Verify mixed trial results, incomplete sessions, no results, no sessions, and a database error. The table must scroll inside its card without making the whole page scroll horizontally. An unavailable database shows unavailable counts rather than zero sessions.

Real Supabase and ElevenLabs integration checks need the environment variables from `.env.example` (never committed). Figma reference: file `i6l0KjRT71LaESTaom4Ici`, node `9:126` (requires file access).
