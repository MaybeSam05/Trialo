// Interview progress: which question Ollie is on, out of the questions that apply to this participant.
import type { EndReason } from "@/components/dashboard/session-outcome";
import { answerProgress, applicableKeys, PROFILE_QUESTIONS, type Question } from "@/lib/questions";

/** Used when the campaign has no question list (legacy studies). */
export const DEFAULT_TOTAL = 6;

/** Field names from Ollie, normalised so "Type 2 Diabetes" and "type_2_diabetes" count once. */
export function normalizeField(field: string): string {
  return field.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

// Names Ollie might use for the profile questions.
const ALIASES: Record<string, string> = { sex: "gender", sex_at_birth: "gender", gender_identity: "gender", age_years: "age", years_old: "age" };

/** Every field the interview can save, in the order Ollie asks them. */
export function interviewKeys(questions: Question[]): string[] {
  return [...PROFILE_QUESTIONS.map((question) => question.key), ...questions.map((question) => question.key)];
}

/**
 * Maps the field name Ollie used to one of the interview's keys ("Asthma diagnosis" -> "asthma", "sex" -> "gender").
 * Returns null for anything that isn't one of the questions, so it can't push the count ahead.
 */
export function matchQuestionKey(field: string, keys: readonly string[]): string | null {
  const name = normalizeField(field);
  const wanted = ALIASES[name] ?? name;
  if (!wanted) return null;
  if (keys.includes(wanted)) return wanted;
  const close = keys.filter((key) => wanted.startsWith(`${key}_`) || key.startsWith(`${wanted}_`));
  return close.length === 1 ? close[0] : null;
}

/**
 * Two different things, kept apart so they can't contradict each other:
 * - `current` is where the interview is: the question after the furthest one answered, so a question the participant
 *   skipped doesn't hold the position back and a corrected earlier answer doesn't move it.
 * - `answered`, `percent` and `finished` count only questions that actually have an answer (the same count as the
 *   dashboard and report), so a skipped question never shows as done.
 * `atEnd` = the last question has been reached but some earlier ones are still unanswered.
 * `saved` is keyed by question key (see matchQuestionKey).
 */
export function interviewProgress(saved: Record<string, string>, questions: Question[] | null) {
  if (!questions) {
    const answered = Math.min(Object.keys(saved).length, DEFAULT_TOTAL);
    return { answered, total: DEFAULT_TOTAL, current: Math.min(answered + 1, DEFAULT_TOTAL), finished: answered >= DEFAULT_TOTAL, atEnd: false, percent: Math.round((answered / DEFAULT_TOTAL) * 100) };
  }
  const order = applicableKeys(questions, saved);
  const furthest = order.reduce((last, key, index) => key in saved ? index + 1 : last, 0);
  const { answered, total, complete } = answerProgress(saved, questions);
  const count = total ?? order.length;
  return { answered, total: count, current: Math.min(furthest + 1, count), finished: complete, atEnd: furthest >= count && !complete, percent: Math.round((answered / count) * 100) };
}

export type InterviewEnding = "complete" | "stopped" | "cut";

/**
 * How the interview ended, for the participant's closing screen. "complete" needs every applicable question answered
 * (the counter's position can pass a skipped question, so it isn't used); otherwise the participant stopped it ("stopped")
 * or the call ended under them ("cut"). Without a question list, Ollie hanging up is the only sign it finished.
 * `reason` is ElevenLabs' disconnect reason: "user" (we ended it), "agent" or "error".
 */
export function interviewEnding(saved: Record<string, string>, questions: Question[] | null, participantEnded: boolean, reason: string | null): InterviewEnding {
  const complete = questions ? answerProgress(saved, questions).complete : reason === "agent" && !participantEnded;
  return complete ? "complete" : participantEnded || reason === "user" ? "stopped" : "cut";
}

/** What the server records as how the call ended (see screening_sessions.end_reason). */
export function endReasonFor(reason: string, participantEnded: boolean): EndReason {
  return reason === "error" ? "connection" : participantEnded || reason === "user" ? "participant" : "agent";
}
