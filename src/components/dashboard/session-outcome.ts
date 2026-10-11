import { answerProgress, type Question } from "@/lib/questions";
import type { MatchResult } from "@/lib/types";

export type DashboardSession = {
  id: string;
  status: string;
  answers: Record<string, unknown> | null;
  match_results: MatchResult[] | null;
  created_at: string;
  studies: { name: string } | null;
};

export type SessionOutcome = "potential_match" | "needs_review" | "unlikely_match";

// Each session belongs to exactly one summary tile. Partial interviews and absent
// results require review. A potential match to any trial takes precedence over
// missing information or reported exclusions for other trials in the campaign.
export function getSessionOutcome(session: Pick<DashboardSession, "status" | "match_results">): SessionOutcome {
  const results = session.match_results ?? [];
  if (session.status !== "completed" || results.length === 0) return "needs_review";
  if (results.some((result) => result.status === "potential_match")) return "potential_match";
  if (results.every((result) => result.status === "possible_exclusion")) return "unlikely_match";
  return "needs_review";
}

/** How a call ended, recorded by the interview page: the participant pressed End, Ollie hung up, or the connection failed. */
export type EndReason = "participant" | "agent" | "connection";
export const END_REASONS: readonly EndReason[] = ["participant", "agent", "connection"];
export const isEndReason = (value: unknown): value is EndReason => END_REASONS.includes(value as EndReason);

export type InterviewState = { label: string; detail: string; tone: "live" | "done" | "stopped" | "idle"; live: boolean };

const ENDED_BY: Record<EndReason, string> = { participant: "Participant ended the call", agent: "Ollie's call ended", connection: "Connection dropped" };

/**
 * What happened in the interview itself, kept separate from the review outcome. Only answering every applicable question
 * makes it complete; ending the call or receiving a transcript just means it's over.
 * `recent` = activity within the live window; `liveDetail` describes that activity.
 */
export function interviewState(session: { complete: boolean; answered: number; hasTranscript: boolean; endReason: string | null; recent: boolean }, liveDetail = ""): InterviewState {
  const reason = isEndReason(session.endReason) ? session.endReason : null;
  const over = Boolean(reason) || session.hasTranscript;
  if (session.complete) return { label: "Complete", detail: session.hasTranscript ? "All questions answered" : "All questions answered, transcript not received yet", tone: "done", live: false };
  if (!over && session.recent) return { label: "In progress", detail: liveDetail, tone: "live", live: true };
  if (session.answered === 0) return { label: "Not started", detail: reason ? `${ENDED_BY[reason]} before any answers` : "Opened the link, never answered", tone: "idle", live: false };
  return { label: "Stopped early", detail: reason ? `${ENDED_BY[reason]} before the last question` : session.hasTranscript ? "Call ended before the last question" : "Left before the last question", tone: "stopped", live: false };
}

/** A session's answer count and completion from the questions it was asked. Legacy keyword campaigns (no question list) keep their stored status. */
export function sessionProgress(session: { status: string; answers: Record<string, unknown> | null }, questions: Question[] | null) {
  const progress = answerProgress(session.answers ?? {}, questions);
  return { ...progress, complete: progress.total === null ? session.status === "completed" : progress.complete };
}
