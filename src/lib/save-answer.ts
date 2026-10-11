import { matchTrials } from "@/lib/matching";
import { answerProgress, matchQuestions, sessionQuestions } from "@/lib/questions";
import type { Trial } from "@/lib/types";

export type StoredSession = { answers: Record<string, unknown> | null; updated_at: string; study_id: string; questions?: unknown };
export type SessionPatch = { answers: Record<string, unknown>; updated_at: string; match_results: unknown; status: string };

/** What saveAnswer needs from the database: read a session and its study, and write only if nobody wrote in between. */
export type AnswerStore = {
  readSession(id: string): Promise<StoredSession | null>;
  readStudy(studyId: string): Promise<{ questions?: unknown; trials?: unknown } | null>;
  /** Applies the patch only if the session's updated_at still equals `expected`; returns whether it did. */
  writeIfUnchanged(id: string, expected: string, patch: SessionPatch): Promise<boolean>;
};

const MAX_ATTEMPTS = 5;

/**
 * Saves one answer with compare-and-swap, so two saves at once can't erase each other: read, merge, write only if
 * updated_at is unchanged, otherwise read again. Every answer write moves updated_at strictly forward.
 */
export async function saveAnswer(store: AnswerStore, id: string, field: string, value: string, now = () => Date.now()): Promise<"saved" | "unknown_session" | "busy"> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const session = await store.readSession(id);
    if (!session) return "unknown_session";
    const study = await store.readStudy(session.study_id);
    if (!study) throw new Error("Study not found.");
    const answers = { ...(session.answers ?? {}), [field]: value };
    // Score against the questions this session was asked, not the campaign's latest edit.
    const { questions } = sessionQuestions(session.questions, study.questions);
    // "completed" only once every question that applies has an answer; recomputed on every save, so corrections count.
    const status = questions && answerProgress(answers, questions).complete ? "completed" : "needs_review";
    const previous = Date.parse(session.updated_at);
    const updated_at = new Date(Math.max(now(), Number.isFinite(previous) ? previous + 1 : 0)).toISOString();
    const match_results = questions ? matchQuestions(answers, questions) : matchTrials(answers, (study.trials ?? []) as Trial[]);
    if (await store.writeIfUnchanged(id, session.updated_at, { answers, updated_at, match_results, status })) return "saved";
  }
  return "busy";
}
