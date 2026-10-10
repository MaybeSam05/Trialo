"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Ollie } from "@/components/ollie";
import { DashboardStatusChip } from "./status";
import type { SessionOutcome } from "./session-outcome";
import "./sessions-board.css";

export type BoardSession = {
  id: string;
  campaign: string;
  createdAt: string;
  lastActivity: string;
  completed: boolean;
  outcome: SessionOutcome;
  answered: number;
  total: number | null;
};

type Filter = "all" | "live" | SessionOutcome;
type Sort = "newest" | "oldest" | "activity";

/** A session counts as "answering now" if it isn't finished and saved something recently. */
const LIVE_WINDOW_MS = 10 * 60_000;
const HIGHLIGHT_MS = 6_000;

const startedDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const startedTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

const OUTCOME_FILTERS: { value: SessionOutcome; label: string; tone: string; note: string }[] = [
  { value: "potential_match", label: "Potential match for follow-up", tone: "match", note: "At least one potential trial match" },
  { value: "needs_review", label: "Needs review", tone: "missing", note: "Incomplete or needs verification" },
  { value: "unlikely_match", label: "Unlikely match", tone: "exclude", note: "Reported exclusions across all trials" },
];

export function SessionsBoard({ sessions, renderedAt }: { sessions: BoardSession[]; renderedAt: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [campaign, setCampaign] = useState("all");
  const [sort, setSort] = useState<Sort>("newest");
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

  const isLive = (session: BoardSession) => !session.completed && now - Date.parse(session.lastActivity) < LIVE_WINDOW_MS;
  const campaigns = useMemo(() => [...new Set(sessions.map((session) => session.campaign))].sort(), [sessions]);
  const inCampaign = campaign === "all" ? sessions : sessions.filter((session) => session.campaign === campaign);
  const counts = {
    all: inCampaign.length,
    live: inCampaign.filter(isLive).length,
    potential_match: inCampaign.filter((session) => session.outcome === "potential_match").length,
    needs_review: inCampaign.filter((session) => session.outcome === "needs_review").length,
    unlikely_match: inCampaign.filter((session) => session.outcome === "unlikely_match").length,
  };
  const shown = inCampaign
    .filter((session) => filter === "all" || (filter === "live" ? isLive(session) : session.outcome === filter))
    .sort((a, b) => sort === "oldest" ? Date.parse(a.createdAt) - Date.parse(b.createdAt)
      : sort === "activity" ? Date.parse(b.lastActivity) - Date.parse(a.lastActivity)
      : Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const filtered = filter !== "all" || campaign !== "all";
  const toggle = (value: Filter) => setFilter((current) => current === value ? "all" : value);
  const newCount = highlights.fresh.length;

  return <>
    <section className="dashboard-summary" aria-label="Session summary. Select a tile to filter the table.">
      <button type="button" className="card dashboard-summary-tile board-tile dashboard-tone-total" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
        <h2><span className="dashboard-summary-dot" aria-hidden="true" />Total sessions</h2>
        <strong className="dashboard-count">{counts.all}</strong>
        <p className="muted">{campaign === "all" ? "In the latest 100 sessions" : `In ${campaign}`}</p>
      </button>
      {OUTCOME_FILTERS.map((tile) => <button key={tile.value} type="button" className={`card dashboard-summary-tile board-tile dashboard-tone-${tile.tone}`} aria-pressed={filter === tile.value} onClick={() => toggle(tile.value)}>
        <h2><span className="dashboard-summary-dot" aria-hidden="true" />{tile.label}</h2>
        <strong className="dashboard-count">{counts[tile.value]}</strong>
        <p className="muted">{tile.note}</p>
      </button>)}
    </section>

    {counts.live > 0 && <button type="button" className="board-live-strip" aria-pressed={filter === "live"} onClick={() => toggle("live")}>
      <span className="board-live-dot" aria-hidden="true" />
      <strong>{counts.live} {counts.live === 1 ? "person is" : "people are"} answering now</strong>
      <span className="board-live-action">{filter === "live" ? "Show all sessions" : "Show only these"}</span>
    </button>}

    <section className="card dashboard-sessions" aria-labelledby="sessions-heading">
      <div className="dashboard-table-heading">
        <div><h2 id="sessions-heading">Recent sessions</h2><p className="muted">Dates in UTC · select a row to open its report</p></div>
        <span className="dashboard-session-count">{shown.length} of {sessions.length} {sessions.length === 1 ? "session" : "sessions"}</span>
      </div>

      {sessions.length > 0 && <div className="board-controls" role="group" aria-label="Filter and sort sessions">
        <div className="board-filters" role="group" aria-label="Status">
          {(["all", "live", ...OUTCOME_FILTERS.map((item) => item.value)] as Filter[]).map((value) => <button key={value} type="button" className="board-filter" data-tone={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {value === "all" ? "All" : value === "live" ? "Answering now" : OUTCOME_FILTERS.find((item) => item.value === value)?.label}
            <span className="board-filter-count">{counts[value]}</span>
          </button>)}
        </div>
        <div className="board-selects">
          <label>Campaign
            <select value={campaign} onChange={(event) => setCampaign(event.target.value)}>
              <option value="all">All campaigns</option>
              {campaigns.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>Sort
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="activity">Latest activity</option>
            </select>
          </label>
        </div>
      </div>}

      <p className="board-announce" aria-live="polite">{newCount > 0 ? `${newCount} new ${newCount === 1 ? "session" : "sessions"}` : ""}</p>

      {sessions.length === 0 ? <div className="dashboard-empty">
        <Ollie face="resting" size={140} />
        <h3>No sessions yet</h3>
        <p className="muted">Create a screening link and try an interview with synthetic answers. Your demo sessions will appear here as they happen.</p>
        <Link href="/" className="btn btn-primary">Create your first screening link</Link>
      </div> : shown.length === 0 ? <div className="dashboard-empty">
        <Ollie face="thinking" size={112} />
        <h3>No sessions match these filters</h3>
        <p className="muted">Try another status or campaign.</p>
        {filtered && <button type="button" className="btn btn-secondary" onClick={() => { setFilter("all"); setCampaign("all"); }}>Clear filters</button>}
      </div> : <>
        <p className="dashboard-scroll-hint muted">Swipe or scroll horizontally to see all columns.</p>
        <div className="dashboard-table-scroll" role="region" aria-label="Screening sessions, scroll horizontally for more columns" tabIndex={0}>
          <table className="dashboard-table">
            <caption className="dashboard-sr-only">Recent screening sessions. Open a session to review its individual trial results.</caption>
            <thead><tr><th scope="col">Session / campaign</th><th scope="col">Started (UTC)</th><th scope="col">Responses</th><th scope="col">Pre-screening status</th><th scope="col"><span className="dashboard-sr-only">Report</span></th></tr></thead>
            <tbody>{shown.map((session) => {
              const date = new Date(session.createdAt);
              const live = isLive(session);
              return <tr key={session.id} className={highlights.fresh.includes(session.id) ? "board-row-new" : undefined}>
                <th scope="row" className="dashboard-session-cell">
                  <Link href={`/dashboard/sessions/${encodeURIComponent(session.id)}`} className="dashboard-report-link">
                    {session.campaign}<span className="dashboard-sr-only"> — view session {session.id}</span>
                  </Link>
                  <span className="dashboard-secondary">Session {session.id.slice(0, 8)}{highlights.fresh.includes(session.id) && <span className="board-new-badge">New</span>}</span>
                </th>
                <td>{Number.isNaN(date.getTime()) ? <span className="muted">Unavailable</span> : <time dateTime={session.createdAt}>{startedDate.format(date)}<span className="dashboard-secondary">{startedTime.format(date)}</span></time>}</td>
                <td>
                  <span className={`dashboard-responses${highlights.bumped.includes(session.id) ? " board-bumped" : ""}`}>
                    {session.total ? `${Math.min(session.answered, session.total)} of ${session.total} answered` : `${session.answered} saved`}
                  </span>
                  {session.total ? <span className="board-mini-track" aria-hidden="true"><span style={{ width: `${Math.round(Math.min(1, session.answered / session.total) * 100)}%` }} /></span> : null}
                  <span className="dashboard-secondary">{session.completed ? "Interview complete" : !live ? "Not finished" : session.answered === 0 ? "Started, no answers yet" : `Last answer ${ago(now - Date.parse(session.lastActivity))}`}</span>
                </td>
                <td>{live ? <span className="chip board-live-chip">Answering now</span> : <DashboardStatusChip status={session.outcome} />}</td>
                <td className="dashboard-open" aria-hidden="true">↗</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <footer className="dashboard-table-footer"><p className="muted">One summary status per session. Sessions in progress show &ldquo;Answering now&rdquo; until they finish. Open a report for the results of each trial.</p></footer>
      </>}
    </section>
  </>;
}

function ago(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1_000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  return `${minutes} min ago`;
}
