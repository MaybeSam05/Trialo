"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Ollie } from "@/components/ollie";
import { DashboardStatusChip } from "./status";
import type { StudyFit } from "@/lib/cross-match";
import { interviewState, type SessionOutcome } from "./session-outcome";
import "./sessions-board.css";

export type BoardSession = {
  id: string;
  campaign: string;
  createdAt: string;
  lastActivity: string;
  /** Every applicable question answered (not just "the call ended"). */
  completed: boolean;
  hasTranscript: boolean;
  endReason: string | null;
  outcome: SessionOutcome;
  answered: number;
  total: number | null;
  /** Other studies on this account where the participant may fit, best first (potential match or needs review only). */
  others: { label: string; fit: StudyFit; summary: string }[];
  othersUnlikely: number;
  othersTotal: number;
};

type Status = "all" | "live" | SessionOutcome;
type Sort = "newest" | "oldest" | "activity";

/** A session counts as "answering now" if it isn't finished and saved something recently. */
const LIVE_WINDOW_MS = 10 * 60_000;
const HIGHLIGHT_MS = 6_000;
const PAGE_SIZES = [10, 25, 50];

const startedDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const startedTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

const OUTCOMES: { value: SessionOutcome; label: string; tone: string; note: string }[] = [
  { value: "potential_match", label: "Potential match for follow-up", tone: "match", note: "At least one potential trial match" },
  { value: "needs_review", label: "Needs review", tone: "missing", note: "Incomplete or needs verification" },
  { value: "unlikely_match", label: "Unlikely match", tone: "exclude", note: "Reported exclusions across all trials" },
];
const STATUS_LABEL: Record<Status, string> = { all: "All statuses", live: "Answering now", potential_match: "Potential match for follow-up", needs_review: "Needs review", unlikely_match: "Unlikely match" };
const SORT_LABEL: Record<Sort, string> = { newest: "Newest first", oldest: "Oldest first", activity: "Latest activity" };

/** What happened in the interview itself (see interviewState), kept separate from the review outcome. */
function stateOf(session: BoardSession, now: number) {
  const since = now - Date.parse(session.lastActivity);
  return interviewState({ complete: session.completed, answered: session.answered, hasTranscript: session.hasTranscript, endReason: session.endReason, recent: since < LIVE_WINDOW_MS },
    session.answered === 0 ? "Started, no answers yet" : `Last answer ${ago(since)}`);
}

export function SessionsBoard({ sessions, renderedAt }: { sessions: BoardSession[]; renderedAt: number }) {
  const [status, setStatus] = useState<Status>("all");
  const [campaign, setCampaign] = useState("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(renderedAt);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);

  // Highlight sessions that arrive, and answer counts that go up, between refreshes.
  const [known, setKnown] = useState(() => new Map(sessions.map((session) => [session.id, session.answered])));
  const [highlights, setHighlights] = useState<{ fresh: string[]; bumped: string[]; round: number }>({ fresh: [], bumped: [], round: 0 });
  const signature = sessions.map((session) => `${session.id}:${session.answered}`).join("|");
  const [seenSignature, setSeenSignature] = useState(signature);
  if (signature !== seenSignature) {
    setSeenSignature(signature);
    const fresh = sessions.filter((session) => !known.has(session.id)).map((session) => session.id);
    const bumped = sessions.filter((session) => (known.get(session.id) ?? session.answered) < session.answered).map((session) => session.id);
    setKnown(new Map(sessions.map((session) => [session.id, session.answered])));
    if (fresh.length || bumped.length) setHighlights((current) => ({ fresh, bumped, round: current.round + 1 }));
  }
  useEffect(() => {
    if (!highlights.fresh.length && !highlights.bumped.length) return;
    const timer = setTimeout(() => setHighlights((current) => ({ fresh: [], bumped: [], round: current.round })), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlights]);

  const isLive = (session: BoardSession) => stateOf(session, now).live;
  const campaigns = useMemo(() => [...new Set(sessions.map((session) => session.campaign))].sort(), [sessions]);

  // Everything except the status filter, so the status options can show live counts.
  const needle = query.trim().toLowerCase();
  const fromTime = from ? Date.parse(`${from}T00:00:00Z`) : -Infinity;
  const toTime = to ? Date.parse(`${to}T23:59:59.999Z`) : Infinity;
  const scoped = sessions.filter((session) => {
    const started = Date.parse(session.createdAt);
    return (campaign === "all" || session.campaign === campaign)
      && (!needle || session.campaign.toLowerCase().includes(needle) || session.id.toLowerCase().startsWith(needle))
      && started >= fromTime && started <= toTime;
  });
  const counts: Record<Status, number> = {
    all: scoped.length,
    live: scoped.filter(isLive).length,
    potential_match: scoped.filter((session) => session.outcome === "potential_match" && !isLive(session)).length,
    needs_review: scoped.filter((session) => session.outcome === "needs_review" && !isLive(session)).length,
    unlikely_match: scoped.filter((session) => session.outcome === "unlikely_match" && !isLive(session)).length,
  };
  const shown = scoped
    .filter((session) => status === "all" || (status === "live" ? isLive(session) : session.outcome === status && !isLive(session)))
    .sort((a, b) => sort === "oldest" ? Date.parse(a.createdAt) - Date.parse(b.createdAt)
      : sort === "activity" ? Date.parse(b.lastActivity) - Date.parse(a.lastActivity)
      : Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = shown.slice(current * pageSize, current * pageSize + pageSize);

  // Any filter change goes back to the first page.
  const filter = <T,>(set: (value: T) => void) => (value: T) => { set(value); setPage(0); };
  const active = [
    status !== "all" && { key: "status", label: STATUS_LABEL[status], clear: () => filter(setStatus)("all") },
    campaign !== "all" && { key: "campaign", label: campaign, clear: () => filter(setCampaign)("all") },
    needle && { key: "query", label: `“${query.trim()}”`, clear: () => filter(setQuery)("") },
    (from || to) && { key: "dates", label: `${from || "…"} to ${to || "…"}`, clear: () => { setFrom(""); setTo(""); setPage(0); } },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];
  const clearAll = () => { setStatus("all"); setCampaign("all"); setQuery(""); setFrom(""); setTo(""); setPage(0); };
  const liveTotal = sessions.filter(isLive).length;
  const newCount = highlights.fresh.length;

  return <>
    <section className="dashboard-summary" aria-label="Session summary">
      <article className="card dashboard-summary-tile dashboard-tone-total">
        <h2><span className="dashboard-summary-dot" aria-hidden="true" />Total sessions</h2>
        <strong className="dashboard-count">{sessions.length}</strong>
        <p className="muted">{liveTotal > 0 ? <span className="board-live-note"><span className="board-live-dot" aria-hidden="true" />{liveTotal} answering now</span> : "In the latest 500 sessions"}</p>
      </article>
      {OUTCOMES.map((tile) => <article key={tile.value} className={`card dashboard-summary-tile dashboard-tone-${tile.tone}`}>
        <h2><span className="dashboard-summary-dot" aria-hidden="true" />{tile.label}</h2>
        <strong className="dashboard-count">{sessions.filter((session) => session.outcome === tile.value && !isLive(session)).length}</strong>
        <p className="muted">{tile.note}</p>
      </article>)}
    </section>

    <section className="card dashboard-sessions" aria-labelledby="sessions-heading">
      <div className="dashboard-table-heading">
        <div><h2 id="sessions-heading">Sessions</h2><p className="muted">Dates in UTC · select a session to open its report</p></div>
        <span className="dashboard-session-count" aria-live="polite">{shown.length === sessions.length ? `${sessions.length} sessions` : `${shown.length} of ${sessions.length} sessions`}</span>
      </div>

      {sessions.length > 0 && <div className="board-toolbar" role="search" aria-label="Find sessions">
        <label className="board-search">Search
          <input type="search" value={query} placeholder="Campaign name or session ID" onChange={(event) => filter(setQuery)(event.target.value)} />
        </label>
        <label>Status
          <select value={status} onChange={(event) => filter(setStatus)(event.target.value as Status)}>
            {(Object.keys(STATUS_LABEL) as Status[]).map((value) => <option key={value} value={value}>{STATUS_LABEL[value]} ({counts[value]})</option>)}
          </select>
        </label>
        <label>Campaign
          <select value={campaign} onChange={(event) => filter(setCampaign)(event.target.value)}>
            <option value="all">All campaigns</option>
            {campaigns.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <div className="board-dates" role="group" aria-label="Started between">
          <label>From<input type="date" value={from} max={to || undefined} onChange={(event) => filter(setFrom)(event.target.value)} /></label>
          <label>To<input type="date" value={to} min={from || undefined} onChange={(event) => filter(setTo)(event.target.value)} /></label>
        </div>
        <label>Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
            {(Object.keys(SORT_LABEL) as Sort[]).map((value) => <option key={value} value={value}>{SORT_LABEL[value]}</option>)}
          </select>
        </label>
      </div>}

      {active.length > 0 && <div className="board-active" aria-label="Active filters">
        <span className="muted">Showing:</span>
        {active.map((item) => <button key={item.key} type="button" className="board-pill" onClick={item.clear} aria-label={`Remove filter ${item.label}`}>{item.label}<span aria-hidden="true">×</span></button>)}
        <button type="button" className="board-clear" onClick={clearAll}>Clear all</button>
      </div>}

      <p className="board-announce" aria-live="polite">{newCount > 0 ? `${newCount} new ${newCount === 1 ? "session" : "sessions"}` : ""}</p>

      {sessions.length === 0 ? <div className="dashboard-empty">
        <Ollie face="resting" size={140} />
        <h3>No sessions yet</h3>
        <p className="muted">Create a campaign, share its link, and try an interview with synthetic answers. Your demo sessions will appear here as they happen.</p>
        <Link href="/" className="btn btn-primary">Create your first campaign</Link>
      </div> : shown.length === 0 ? <div className="dashboard-empty">
        <Ollie face="thinking" size={112} />
        <h3>No sessions match these filters</h3>
        <p className="muted">Try another search, status, campaign or date range.</p>
        <button type="button" className="btn btn-secondary" onClick={clearAll}>Clear filters</button>
      </div> : <>
        <div className="dashboard-table-scroll board-scroll" role="region" aria-label="Screening sessions" tabIndex={0}>
          <table className="dashboard-table board-table">
            <caption className="dashboard-sr-only">Screening sessions. Open a session to review its individual trial results.</caption>
            <thead><tr><th scope="col">Session / campaign</th><th scope="col">Started (UTC)</th><th scope="col">Interview</th><th scope="col">Review status</th><th scope="col">Other studies</th><th scope="col"><span className="dashboard-sr-only">Report</span></th></tr></thead>
            <tbody>{visible.map((session) => {
              const date = new Date(session.createdAt);
              const interview = stateOf(session, now);
              const live = interview.live;
              const fresh = highlights.fresh.includes(session.id);
              return <tr key={session.id} className={fresh ? "board-row-new" : undefined}>
                <th scope="row" className="dashboard-session-cell">
                  <Link href={`/dashboard/sessions/${encodeURIComponent(session.id)}`} className="dashboard-report-link">
                    {session.campaign}<span className="dashboard-sr-only"> — view session {session.id}</span>
                  </Link>
                  <span className="dashboard-secondary">Session {session.id.slice(0, 8)}{fresh && <span className="board-new-badge">New</span>}</span>
                </th>
                <td data-label="Started">{Number.isNaN(date.getTime()) ? <span className="muted">Unavailable</span> : <time dateTime={session.createdAt}>{startedDate.format(date)}<span className="dashboard-secondary">{startedTime.format(date)}</span></time>}</td>
                <td data-label="Interview">
                  <span className={`board-interview is-${interview.tone}`}>{interview.label}</span>
                  <span className={`dashboard-responses${highlights.bumped.includes(session.id) ? " board-bumped" : ""}`}>
                    {session.total ? `${Math.min(session.answered, session.total)} of ${session.total} answered` : `${session.answered} answers saved`}
                  </span>
                  {session.total ? <span className="board-mini-track" aria-hidden="true"><span style={{ width: `${Math.round(Math.min(1, session.answered / session.total) * 100)}%` }} /></span> : null}
                  <span className="dashboard-secondary">{interview.detail}</span>
                </td>
                <td data-label="Review status">{live ? <span className="chip">Not ready</span> : <DashboardStatusChip status={session.outcome} />}</td>
                <td data-label="Other studies" className="board-others"><OtherStudies session={session} /></td>
                <td className="dashboard-open" aria-hidden="true">↗</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <nav className="board-pager" aria-label="Pages">
          <label>Rows per page
            <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}>
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <span className="board-range" aria-live="polite">{current * pageSize + 1}–{current * pageSize + visible.length} of {shown.length}</span>
          <button type="button" className="btn btn-secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
          <button type="button" className="btn btn-secondary" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
        </nav>
        <footer className="dashboard-table-footer board-legend">
          <p className="muted"><strong>Interview</strong> is what happened on the call: in progress, complete (every question that applies was answered), or stopped early (the participant ended the call, the call or connection dropped, or they left). <strong>Review status</strong> is the pre-screening summary for staff; it reads &ldquo;Not ready&rdquo; while someone is still answering.</p>
        </footer>
      </>}
    </section>
  </>;
}

function ago(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1_000));
  if (seconds < 60) return "just now";
  return `${Math.round(seconds / 60)} min ago`;
}

/** The participant's best fits among the account's other studies, from answers they already gave. Details are in the report. */
function OtherStudies({ session }: { session: BoardSession }) {
  if (session.othersTotal === 0) return <span className="dashboard-secondary">No other studies</span>;
  if (!session.others.length) return <span className="dashboard-secondary">{session.othersUnlikely === session.othersTotal ? "Unlikely for other studies" : "Not enough information yet"}</span>;
  const more = session.others.length - 2;
  return <>
    <ul className="board-fits">{session.others.slice(0, 2).map((study) => <li key={study.label} title={study.summary}>
      <span className={`board-fit is-${study.fit}`}>{study.fit === "match" ? "Potential match" : "Needs review"}</span>
      <span className="board-fit-name">{study.label}</span>
    </li>)}</ul>
    {more > 0 && <span className="dashboard-secondary">+{more} more in the report</span>}
  </>;
}
