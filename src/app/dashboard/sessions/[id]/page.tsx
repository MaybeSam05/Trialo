import Link from "next/link";
import { notFound } from "next/navigation";
import { Ollie } from "@/components/ollie";
import { coordinatorLinks, SiteHeader } from "@/components/site-header";
import { DashboardStatusChip } from "@/components/dashboard/status";
import { getSessionOutcome } from "@/components/dashboard/session-outcome";
import { MatchChip, SessionChip } from "@/components/status-chip";
import { getSupabase } from "@/lib/supabase";
import type { MatchResult } from "@/lib/types";
import "@/components/coordinator/report.css";

export const dynamic = "force-dynamic";

type Session = {
  id: string; status: string; answers: Record<string, unknown> | null; match_results: MatchResult[] | null;
  transcript: unknown; created_at: string; updated_at: string; studies: { name: string } | null;
};
type Turn = { who: string; text: string };

// ElevenLabs sends [{ role, message }]; anything else (e.g. a plain summary string) is shown as-is.
function toTurns(transcript: unknown): Turn[] | string | null {
  if (!transcript) return null;
  if (typeof transcript === "string") return transcript;
  if (!Array.isArray(transcript)) return null;
  const turns = transcript.flatMap((item): Turn[] => {
    const turn = item as { role?: string; message?: string | null };
    return turn?.message ? [{ who: turn.role === "agent" ? "Ollie" : "Participant", text: turn.message }] : [];
  });
  return turns.length ? turns : null;
}

const label = (field: string) => field.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
const show = (value: unknown) => typeof value === "string" ? value : JSON.stringify(value);

export default async function SessionReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let session: Session | null = null;
  try {
    const result = await getSupabase().from("screening_sessions").select("id,status,answers,match_results,transcript,created_at,updated_at,studies(name)").eq("id", id).maybeSingle();
    session = result.data as unknown as Session | null;
  } catch { notFound(); }
  if (!session) notFound();

  const answers = Object.entries(session.answers ?? {});
  const results = session.match_results ?? [];
  const transcript = toTurns(session.transcript);

  return <>
    <SiteHeader subtitle="Coordinator" links={coordinatorLinks} />
    <main id="main" className="page">
      <Link className="report-back" href="/dashboard">&larr; Back to dashboard</Link>
      <div className="page-head">
        <Ollie face="hello" size={64} />
        <div className="titles">
          <h1>{session.studies?.name ?? "Unknown study"}</h1>
          <div className="report-meta">
            <DashboardStatusChip status={getSessionOutcome({ status: session.status, match_results: session.match_results })} />
            <SessionChip status={session.status} />
            <span className="muted">Started {new Date(session.created_at).toLocaleString()}</span>
            <span className="muted">Session {session.id.slice(0, 8)}</span>
          </div>
        </div>
      </div>
      <p className="panel">Demo data only. These results come from published pre-screen criteria and need review by clinical research staff. They never determine eligibility.</p>
      <div className="report-grid">
        <div className="report-main">
          <section className="card stack" aria-labelledby="results-h">
            <h2 id="results-h">Study results</h2>
            {results.length === 0 ? <p className="muted">No results yet. They appear once the participant has answered the questions.</p>
              : <div>{results.map((result) => <div key={result.trialId} className="trial-result">
                <strong>{result.trialName}</strong>
                <MatchChip status={result.status} />
                <p className="muted">{result.reason}</p>
              </div>)}</div>}
          </section>
          <section className="card stack" aria-labelledby="answers-h">
            <h2 id="answers-h">Answers</h2>
            {answers.length === 0 ? <p className="muted">No answers were saved in this session.</p>
              : <dl className="answer-list">{answers.map(([field, value]) => <div key={field}><dt>{label(field)}</dt><dd>{show(value)}</dd></div>)}</dl>}
          </section>
        </div>
        <aside className="report-side">
          <section className="card stack" aria-labelledby="transcript-h">
            <h2 id="transcript-h">Transcript</h2>
            {!transcript ? <p className="muted">The transcript appears after the interview ends.</p>
              : typeof transcript === "string" ? <p>{transcript}</p>
              : <div className="turns">{transcript.map((turn, index) => <p key={index} className="turn"><span className="who">{turn.who}</span>{turn.text}</p>)}</div>}
          </section>
          <p className="muted">Transcripts and answers contain demo data only and should not be kept after the event.</p>
        </aside>
      </div>
    </main>
  </>;
}
