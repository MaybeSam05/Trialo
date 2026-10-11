import Link from "next/link";
import { Ollie } from "@/components/ollie";
import { coordinatorLinks, SiteHeader } from "@/components/site-header";
import { LiveUpdates } from "@/components/dashboard/live-updates";
import { SessionsBoard, type BoardSession } from "@/components/dashboard/sessions-board";
import { getSessionOutcome, type DashboardSession } from "@/components/dashboard/session-outcome";
import { requireOwner } from "@/lib/auth";
import { sessionQuestions } from "@/lib/questions";
import { getSupabase } from "@/lib/supabase";
import "@/components/dashboard/dashboard.css";

export const dynamic = "force-dynamic";

type Row = DashboardSession & { updated_at: string | null; questions?: unknown; studies: { name: string; questions?: unknown[] | null } | null };

function toBoardSession(row: Row): BoardSession {
  const { questions } = sessionQuestions(row.questions, row.studies?.questions);
  return {
    id: row.id,
    campaign: row.studies?.name ?? "Unknown study",
    createdAt: row.created_at,
    lastActivity: row.updated_at ?? row.created_at,
    completed: row.status === "completed",
    outcome: getSessionOutcome(row),
    answered: Object.keys(row.answers ?? {}).length,
    total: questions?.length || null,
  };
}

async function loadSessions(owner: string) {
  try {
    const query = (columns: string) => getSupabase()
      .from("screening_sessions")
      // studies!inner + owner filter: only sessions from this account's campaigns.
      .select(`${columns},studies!inner(*)`)
      .eq("studies.owner_id", owner)
      .order("created_at", { ascending: false })
      .limit(500);
    const columns = "id,status,answers,match_results,created_at,updated_at";
    let result = await query(`${columns},questions`);
    // Before screening_sessions.questions exists, every session falls back to its campaign's questions.
    if (result.error && (result.error.code === "42703" || /questions/.test(result.error.message))) result = await query(columns);
    if (result.error) throw result.error;
    return { sessions: ((result.data ?? []) as unknown as Row[]).map(toBoardSession), error: false, loadedAt: Date.now() };
  } catch {
    return { sessions: [], error: true, loadedAt: Date.now() };
  }
}

export default async function Dashboard() {
  const { sessions, error, loadedAt } = await loadSessions(await requireOwner());

  return <>
    <SiteHeader subtitle="Coordinator" links={coordinatorLinks} />
    <main id="main" className="page coordinator-dashboard">
      <header className="dashboard-heading">
        <div className="dashboard-heading-copy">
          <span className="eyebrow muted">Coordinator workspace</span>
          <h1>Screening dashboard</h1>
          <p className="muted">A first look at your sessions. A person makes the next decision.</p>
          <LiveUpdates />
        </div>
        <Link className="btn btn-primary" href="/">Create campaign</Link>
      </header>

      {error ? <section className="card dashboard-sessions" aria-labelledby="sessions-heading">
        <div className="dashboard-table-heading"><div><h2 id="sessions-heading">Recent sessions</h2></div></div>
        <div className="dashboard-empty">
          <Ollie face="confused" size={112} />
          <h3 role="alert">We couldn’t load the sessions</h3>
          <p className="muted">Check the Supabase configuration and connection. The dashboard keeps retrying while live updates are on.</p>
          <Link href="/dashboard" className="btn btn-secondary">Try again</Link>
        </div>
      </section> : <SessionsBoard sessions={sessions} renderedAt={loadedAt} />}
    </main>
  </>;
}
