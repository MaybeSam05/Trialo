import Link from "next/link";
import { Ollie } from "@/components/ollie";
import { coordinatorLinks, SiteHeader } from "@/components/site-header";
import { DashboardStatusChip } from "@/components/dashboard/status";
import { getSessionOutcome, type DashboardSession } from "@/components/dashboard/session-outcome";
import { getSupabase } from "@/lib/supabase";
import "@/components/dashboard/dashboard.css";

export const dynamic = "force-dynamic";

const startedDate = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
});
const startedTime = new Intl.DateTimeFormat("en-US", {
  hour: "numeric", minute: "2-digit", timeZone: "UTC",
});

export default async function Dashboard() {
  let rows: DashboardSession[] = [];
  let error = false;
  try {
    const result = await getSupabase()
      .from("screening_sessions")
      .select("id,status,answers,match_results,created_at,studies(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (result.error) throw result.error;
    rows = (result.data ?? []) as unknown as DashboardSession[];
  } catch {
    error = true;
  }

  const sessions = rows.map((row) => ({ ...row, outcome: getSessionOutcome(row) }));
  const count = (outcome: ReturnType<typeof getSessionOutcome>) =>
    sessions.filter((session) => session.outcome === outcome).length;
  const tiles = [
    { label: "Total sessions", value: sessions.length, tone: "total", note: "In the latest 100 sessions" },
    { label: "Potential match for follow-up", value: count("potential_match"), tone: "match", note: "At least one potential trial match" },
    { label: "Needs review", value: count("needs_review"), tone: "missing", note: "Incomplete or needs verification" },
    { label: "Unlikely match", value: count("unlikely_match"), tone: "exclude", note: "Reported exclusions across all trials" },
  ];

  return <>
    <SiteHeader subtitle="Coordinator" links={coordinatorLinks} />
    <main id="main" className="page coordinator-dashboard">
      <header className="dashboard-heading">
        <div className="dashboard-heading-copy">
          <span className="eyebrow muted">Coordinator workspace</span>
          <h1>Screening dashboard</h1>
          <p className="muted">A first look at your sessions. A person makes the next decision.</p>
        </div>
        <Link className="btn btn-primary" href="/">Create screening link <span aria-hidden="true">↗</span></Link>
      </header>

      <aside className="dashboard-notice" aria-label="Demo and AI disclosure">
        <span className="dashboard-demo">Demo data only</span>
        <p>AI-assisted pre-screening using synthetic data. Clinical research staff must review all results. This does not determine eligibility or enrollment.</p>
      </aside>

      <section className="dashboard-summary" aria-label="Session summary">
        {tiles.map((tile) => <article key={tile.tone} className={`card dashboard-summary-tile dashboard-tone-${tile.tone}`}>
          <h2><span className="dashboard-summary-dot" aria-hidden="true" />{tile.label}</h2>
          <strong className="dashboard-count" aria-label={error ? "Unavailable" : undefined}>{error ? "—" : tile.value}</strong>
          <p className="muted">{tile.note}</p>
        </article>)}
      </section>

      <section className="card dashboard-sessions" aria-labelledby="sessions-heading">
        <div className="dashboard-table-heading">
          <div><h2 id="sessions-heading">Recent sessions</h2><p className="muted">Latest 100 sessions, newest first · Dates in UTC</p></div>
          {!error && <span className="dashboard-session-count">{sessions.length} {sessions.length === 1 ? "session" : "sessions"}</span>}
        </div>
        {error ? <div className="dashboard-empty">
          <Ollie face="confused" size={112} />
          <h3 role="alert">We couldn’t load the sessions</h3>
          <p className="muted">Check the Supabase configuration and connection, then try again. Summary counts are unavailable until sessions load.</p>
          <Link href="/dashboard" className="btn btn-secondary">Try again</Link>
        </div> : sessions.length === 0 ? <div className="dashboard-empty">
          <Ollie face="resting" size={140} />
          <h3>No sessions yet</h3>
          <p className="muted">Create a screening link and try an interview with synthetic answers. Your demo sessions will appear here.</p>
          <Link href="/" className="btn btn-primary">Create your first screening link</Link>
        </div> : <>
          <p className="dashboard-scroll-hint muted">Swipe or scroll horizontally to see all columns.</p>
          <div className="dashboard-table-scroll" role="region" aria-label="Screening sessions, scroll horizontally for more columns" tabIndex={0}>
            <table className="dashboard-table">
              <caption className="dashboard-sr-only">Recent screening sessions. Open a session to review its individual trial results.</caption>
              <thead><tr><th scope="col">Session / campaign</th><th scope="col">Started (UTC)</th><th scope="col">Responses</th><th scope="col">Pre-screening status</th><th scope="col"><span className="dashboard-sr-only">Report</span></th></tr></thead>
              <tbody>{sessions.map((session) => {
                const date = new Date(session.created_at);
                const validDate = !Number.isNaN(date.getTime());
                return <tr key={session.id}>
                  <th scope="row" className="dashboard-session-cell">
                    <Link href={`/dashboard/sessions/${encodeURIComponent(session.id)}`} className="dashboard-report-link">
                      {session.studies?.name ?? "Unknown study"}<span className="dashboard-sr-only"> — view session {session.id}</span>
                    </Link>
                    <span className="dashboard-secondary">Session {session.id.slice(0, 8)}</span>
                  </th>
                  <td>{validDate ? <time dateTime={session.created_at}>{startedDate.format(date)}<span className="dashboard-secondary">{startedTime.format(date)}</span></time> : <span className="muted">Unavailable</span>}</td>
                  <td><span className="dashboard-responses">{Object.keys(session.answers ?? {}).length} saved</span><span className="dashboard-secondary">{session.status === "started" ? "In progress" : "Awaiting review"}</span></td>
                  <td><DashboardStatusChip status={session.outcome} /></td>
                  <td className="dashboard-open" aria-hidden="true">↗</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <footer className="dashboard-table-footer"><p className="muted">One summary status per session. Open a report for the results of each trial.</p></footer>
        </>}
      </section>
    </main>
  </>;
}
