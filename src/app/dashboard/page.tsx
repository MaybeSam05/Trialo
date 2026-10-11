import Link from "next/link";
import { Ollie } from "@/components/ollie";
import { coordinatorLinks, SiteHeader } from "@/components/site-header";
import { LiveUpdates } from "@/components/dashboard/live-updates";
import { SessionsBoard, type BoardSession } from "@/components/dashboard/sessions-board";
import { getSessionOutcome, sessionProgress, type DashboardSession } from "@/components/dashboard/session-outcome";
import { requireOwner } from "@/lib/auth";
import { fitSummary, otherStudyFits, type Campaign } from "@/lib/cross-match";
import { sessionQuestions } from "@/lib/questions";
import { getSupabase } from "@/lib/supabase";
import "@/components/dashboard/dashboard.css";

export const dynamic = "force-dynamic";

type Row = DashboardSession & { updated_at: string | null; questions?: unknown; end_reason?: string | null; first_turn?: unknown; studies: { slug?: string; name: string; questions?: unknown[] | null } | null };

function toBoardSession(row: Row, campaigns: Campaign[]): BoardSession {
  const { questions } = sessionQuestions(row.questions, row.studies?.questions);
  // Same count and completion rule as the participant's counter and the session report.
  const { answered, total, complete } = sessionProgress(row, questions);
  // Where else this participant may fit, from the answers they already gave (see src/lib/cross-match.ts).
  const others = otherStudyFits(row.answers ?? {}, questions, campaigns, row.studies?.slug ?? "");
  return {
    id: row.id,
    campaign: row.studies?.name ?? "Unknown study",
    createdAt: row.created_at,
    lastActivity: row.updated_at ?? row.created_at,
    completed: complete,
    hasTranscript: row.first_turn !== undefined && row.first_turn !== null,
    endReason: row.end_reason ?? null,
    outcome: getSessionOutcome({ status: complete ? "completed" : "needs_review", match_results: row.match_results }),
    answered,
    total,
    others: others.filter((study) => study.fit === "match" || study.fit === "possible").map((study) => ({ label: study.label, fit: study.fit, summary: fitSummary(study) })),
    othersUnlikely: others.filter((study) => study.fit === "unlikely").length,
    othersTotal: others.length,
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
    // first_turn: just the transcript's first line, enough to know one arrived without loading every transcript.
    const columns = "id,status,answers,match_results,created_at,updated_at,first_turn:transcript->0";
    // Until the newer optional columns exist, fall back step by step (sessions then use their campaign's questions / no end reason).
    let result = await query(`${columns},questions,end_reason`);
    for (const fallback of [`${columns},questions`, columns]) {
      if (!result.error || !(result.error.code === "42703" || /questions|end_reason/.test(result.error.message))) break;
      result = await query(fallback);
    }
    if (result.error) throw result.error;
    // Every campaign on this account, to compare each participant with the other studies.
    const { data: campaigns } = await getSupabase().from("studies").select("slug,name,questions").eq("owner_id", owner);
    return { sessions: ((result.data ?? []) as unknown as Row[]).map((row) => toBoardSession(row, (campaigns ?? []) as Campaign[])), error: false, loadedAt: Date.now() };
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
