# Coordinator dashboard

`/dashboard` preserves the existing server-side Supabase query for the latest 100 screening sessions. The summary counts sessions, not individual trial results; each session contributes to exactly one outcome tile.

## Overall session status

- Any status other than `completed`, or no trial results: **Needs review**.
- A completed session with a potential match to any trial: **Potential match for follow-up**, even if other trials need information or report exclusions.
- A completed session with reported exclusions for every returned trial: **Unlikely match**.
- All other combinations: **Needs review**.

These are preliminary display summaries. Matching logic, saved results, and final eligibility decisions are not changed. Open the linked session report for per-trial results.

`status.tsx` uses the shared `SessionChip` for Needs review and the existing chip classes for the two dashboard-specific labels. The shared `MatchChip` currently uses different wording and is owned by Pavan; it is not modified here.

## Live board

- `live-updates.tsx` re-fetches the page every 5 seconds while the tab is visible (Pause/Resume in the heading).
- `sessions-board.tsx` renders the tiles and table on the client. Tiles double as status filters; the bar above the table adds "Answering now", campaign and sort controls. Filters survive live refreshes.
- **Answering now**: a session that isn't `completed` and was updated in the last 10 minutes. `updated_at` is bumped by the answers API on every saved answer.
- Sessions that arrive between refreshes flash with a "New" badge (and are announced to screen readers); in-progress answer counts pulse when they go up.
- Responses show "N of M answered" when the campaign has a question list, otherwise "N saved".

## Local checks

Run `npm run build`, `npx tsc --noEmit`, and `npx eslint src`. Check `/dashboard` at 390px and 1440px with synthetic sessions only. Verify mixed trial results, incomplete sessions, no results, no sessions, and a database error. The table must scroll inside its card without making the whole page scroll horizontally. An unavailable database shows unavailable counts rather than zero sessions.

Real Supabase and ElevenLabs integration checks require the team's uncommitted environment variables. Figma reference: file `i6l0KjRT71LaESTaom4Ici`, node `9:126` (requires file access).
