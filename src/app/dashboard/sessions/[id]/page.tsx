import Link from "next/link";
import { notFound } from "next/navigation";
import { Ollie } from "@/components/ollie";
import { coordinatorLinks, SiteHeader } from "@/components/site-header";
import { LiveUpdates } from "@/components/dashboard/live-updates";
import { DashboardStatusChip } from "@/components/dashboard/status";
import { getSessionOutcome, interviewState, sessionProgress } from "@/components/dashboard/session-outcome";
import { stripExpressions } from "@/components/participant/speech-timeline";
import { MatchChip } from "@/components/status-chip";
import { answerEvidence, applies, NAME_FIELD, PROFILE_QUESTIONS, sessionQuestions, type Evidence, type Question } from "@/lib/questions";
import { requireOwner } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import type { MatchResult } from "@/lib/types";
import "@/components/coordinator/report.css";

export const dynamic = "force-dynamic";

/** Matches the dashboard: no activity for this long and no end recorded means the participant left. */
const LIVE_WINDOW_MS = 10 * 60_000;
const isRecent = (time: string) => Date.now() - Date.parse(time) < LIVE_WINDOW_MS;

type Session = {
  id: string; status: string; answers: Record<string, unknown> | null; match_results: MatchResult[] | null;
  transcript: unknown; created_at: string; updated_at: string; questions?: unknown; end_reason?: string | null; studies: { name: string; questions?: Question[] | null } | null;
};
type Turn = { who: string; text: string };

// ElevenLabs sends [{ role, message }]; anything else (e.g. a plain summary string) is shown as-is.
function toTurns(transcript: unknown): Turn[] | string | null {
  if (!transcript) return null;
  if (typeof transcript === "string") return transcript;
  if (!Array.isArray(transcript)) return null;
  const turns = transcript.flatMap((item): Turn[] => {
    const turn = item as { role?: string; message?: string | null };
    // Ollie's lines can carry voice expression tags ("[warmly]"); show only the words.
    const text = turn?.message ? (turn.role === "agent" ? stripExpressions(turn.message) : turn.message) : "";
    return text ? [{ who: turn.role === "agent" ? "Ollie" : "Participant", text }] : [];
  });
  return turns.length ? turns : null;
}

const label = (field: string) => field.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
const show = (value: unknown) => typeof value === "string" ? value : JSON.stringify(value);

type AnswerRow = { key: string; number: string; text: string; value: string | null; skipped: boolean };

/** Answers in interview order with the original question text; extra fields (older campaigns) come last. */
function answerRows(answers: Record<string, unknown>, questions: Question[] | null): AnswerRow[] {
  const has = (key: string) => answers[key] !== undefined && answers[key] !== null && answers[key] !== "";
  const rows: AnswerRow[] = PROFILE_QUESTIONS.map((question, index) => ({ key: question.key, number: `P${index + 1}`, text: question.text, value: has(question.key) ? show(answers[question.key]) : null, skipped: false }));
  (questions ?? []).forEach((question, index) => rows.push({
    key: question.key, number: String(index + 1), text: question.text,
    value: has(question.key) ? show(answers[question.key]) : null,
    skipped: !has(question.key) && !applies(question, answers, questions ?? []),
  }));
  const known = new Set([...rows.map((row) => row.key), NAME_FIELD]);
  for (const [key, value] of Object.entries(answers)) if (!known.has(key)) rows.push({ key, number: "", text: label(key), value: show(value), skipped: false });
  return rows;
}

const EVIDENCE: Record<Evidence, { title: string; icon: string }> = {
  supports: { title: "Supports this result", icon: "✓" },
  against: { title: "Doesn't fit", icon: "✕" },
  verify: { title: "Needs verification", icon: "?" },
  skipped: { title: "Didn't apply", icon: "–" },
};

export default async function SessionReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireOwner();
  let session: Session | null = null;
  try {
    const result = await getSupabase().from("screening_sessions").select("*,studies!inner(*)").eq("id", id).eq("studies.owner_id", owner).maybeSingle();
    session = result.data as unknown as Session | null;
  } catch { notFound(); }
  if (!session) notFound();

  const answers = session.answers ?? {};
  // The questions this session was asked (saved when it started), not the campaign's latest edit.
  const { questions, fromCampaign } = sessionQuestions(session.questions, session.studies?.questions);
  const rows = answerRows(answers, questions);
  const answeredCount = rows.filter((row) => row.value !== null).length;
  // Same count and completion rule as the dashboard and the participant's counter; ending the call alone isn't completion.
  const progress = sessionProgress(session, questions);
  const interview = interviewState({ complete: progress.complete, answered: progress.answered, hasTranscript: session.transcript !== null && session.transcript !== undefined,
    endReason: session.end_reason ?? null, recent: isRecent(session.updated_at) });
  const name = typeof answers[NAME_FIELD] === "string" ? answers[NAME_FIELD] as string : "";
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
            <DashboardStatusChip status={getSessionOutcome({ status: progress.complete ? "completed" : "needs_review", match_results: session.match_results })} />
            <span className="chip">{interview.label === "Complete" ? "Interview complete" : interview.label}</span>
            {interview.detail && <span className="muted">{interview.detail}</span>}
            {name && <span className="muted">Preferred name: {name}</span>}
            <span className="muted">Started {new Date(session.created_at).toLocaleString()}</span>
            <span className="muted">Session {session.id.slice(0, 8)}</span>
          </div>
          <LiveUpdates />
        </div>
      </div>
      {fromCampaign && <p className="panel">This session started before Trialo saved each session&apos;s questions, so it&apos;s shown against the campaign&apos;s current questions. If the campaign was edited after this interview, some questions may differ from what was asked.</p>}
      <p className="panel">Demo data only. These results come from published pre-screen criteria and need review by clinical research staff. They never determine eligibility.</p>
      <div className="report-grid">
        <div className="report-main">
          <section className="card stack" aria-labelledby="results-h">
            <h2 id="results-h">Study results</h2>
            {results.length === 0 ? <p className="muted">No results yet. They appear once the participant has answered the questions.</p>
              : <div>{results.map((result) => {
                const scored = (questions ?? []).filter((question) => question.trial === result.trialName && question.kind !== "info");
                const groups = (Object.keys(EVIDENCE) as Evidence[]).map((kind) => ({ kind, items: scored.filter((question) => answerEvidence(question, answers, questions ?? []) === kind) })).filter((group) => group.items.length);
                return <div key={result.trialId} className="trial-result">
                  <strong>{result.trialName}</strong>
                  <MatchChip status={result.status} />
                  <p className="muted">{result.reason}</p>
                  {groups.length > 0 && <div className="evidence">{groups.map((group) => <div key={group.kind} className={`evidence-group is-${group.kind}`}>
                    <p className="evidence-title"><span aria-hidden>{EVIDENCE[group.kind].icon}</span>{EVIDENCE[group.kind].title}</p>
                    <ul>{group.items.map((question) => <li key={question.key}>
                      <span>{question.text}</span>
                      <span className="evidence-answer">{answers[question.key] !== undefined && answers[question.key] !== "" ? `“${show(answers[question.key])}”` : group.kind === "skipped" ? "Not asked" : "No answer"}</span>
                    </li>)}</ul>
                  </div>)}</div>}
                </div>;
              })}</div>}
          </section>
          <section className="card stack" aria-labelledby="answers-h">
            <h2 id="answers-h">Answers <span className="muted answer-count">{progress.total === null ? `${progress.answered} answered` : `${progress.answered} of ${progress.total} answered`}, in interview order</span></h2>
            {answeredCount === 0 ? <p className="muted">No answers were saved in this session.</p>
              : <dl className="answer-list">{rows.map((row) => <div key={row.key} className={row.value === null ? "is-empty" : undefined}>
                <dt>{row.number && <span className="answer-num">{row.number}</span>}{row.text}</dt>
                <dd>{row.value ?? (row.skipped ? "Not asked (didn't apply)" : interview.live ? "No answer yet" : "Not answered")}</dd>
              </div>)}</dl>}
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
