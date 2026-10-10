import type { MatchResult } from "@/lib/types";

// "include": a yes means the person fits. "exclude": a yes may rule them out. "info": collected, never scored.
export type QuestionKind = "include" | "exclude" | "info";
export type Question = { key: string; text: string; kind: QuestionKind; trial: string };

export const MAX_QUESTIONS = 30;
const MAX_TEXT = 300;
const KINDS: QuestionKind[] = ["include", "exclude", "info"];
const GENERAL = "General";
// The plan forbids final-decision wording and real health identifiers in questions.
const BANNED = /\b(eligible|ineligible|accepted|rejected|ssn|social security|medical record number)\b/i;

// Sample list (synthetic): one fit question and one flag question per demo trial.
export const DEFAULT_QUESTIONS: Question[] = [
  { key: "trial_a_fit", text: "Have you been diagnosed with type 2 diabetes?", kind: "include", trial: "Trial A" },
  { key: "trial_a_flag", text: "Are you currently pregnant?", kind: "exclude", trial: "Trial A" },
  { key: "trial_b_fit", text: "Do you know your eGFR kidney function number?", kind: "include", trial: "Trial B" },
  { key: "trial_b_flag", text: "Are you currently on dialysis?", kind: "exclude", trial: "Trial B" },
  { key: "trial_c_fit", text: "Have you been diagnosed with chronic kidney disease?", kind: "include", trial: "Trial C" },
  { key: "trial_c_flag", text: "Have you ever had an organ transplant?", kind: "exclude", trial: "Trial C" },
  { key: "trial_d_fit", text: "Do you live in New Jersey?", kind: "include", trial: "Trial D" },
  { key: "trial_d_flag", text: "Are you currently taking part in another clinical trial?", kind: "exclude", trial: "Trial D" },
  { key: "trial_e_fit", text: "Do you currently take metformin?", kind: "include", trial: "Trial E" },
  { key: "trial_e_flag", text: "Have you had surgery in the last three months?", kind: "exclude", trial: "Trial E" },
];

/** Cleans coordinator input. Returns the questions, or an error message to show them. */
export function validateQuestions(input: unknown): { questions: Question[] } | { error: string } {
  if (!Array.isArray(input) || input.length === 0) return { error: "Add at least one question." };
  if (input.length > MAX_QUESTIONS) return { error: `Use at most ${MAX_QUESTIONS} questions.` };
  const used = new Set<string>();
  const questions: Question[] = [];
  for (const [index, raw] of input.entries()) {
    const item = (raw ?? {}) as Partial<Question>;
    const text = String(item.text ?? "").trim();
    if (!text) return { error: `Question ${index + 1} is empty.` };
    if (text.length > MAX_TEXT) return { error: `Question ${index + 1} is longer than ${MAX_TEXT} characters.` };
    if (BANNED.test(text)) return { error: `Question ${index + 1} uses wording this demo doesn't allow (final decisions or identifiers).` };
    const kind = KINDS.includes(item.kind as QuestionKind) ? item.kind as QuestionKind : "info";
    const trial = String(item.trial ?? "").trim().slice(0, 60) || GENERAL;
    let key = String(item.key ?? "").replace(/[^a-z0-9_]/gi, "").toLowerCase().slice(0, 40) || `q${index + 1}`;
    while (used.has(key)) key = `${key}_${index + 1}`;
    used.add(key);
    questions.push({ key, text, kind, trial });
  }
  return { questions };
}

/** Parses pasted text or CSV: one question per line, optionally "text, kind, trial". */
export function parseQuestionText(raw: string): Question[] {
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).flatMap((line, index) => {
    if (index === 0 && /^"?(question|text)"?\s*,/i.test(line)) return [];
    const cells = [...line.matchAll(/"([^"]*)"|([^,]+)/g)].map((match) => (match[1] ?? match[2]).trim());
    const kind = KINDS.find((value) => value === cells[1]?.toLowerCase()) ?? "info";
    return [{ key: "", text: cells[0], kind, trial: cells[2] ?? "" }];
  });
}

const yes = /^\s*(yes|yeah|yep|y|true)\b/i;
const no = /^\s*(no|nope|n|false)\b/i;

/** Scores yes/no answers per trial group. A missing or unclear answer always needs review, never a rejection. */
export function matchQuestions(answers: Record<string, unknown>, questions: Question[]): MatchResult[] {
  const trials = [...new Set(questions.filter((question) => question.kind !== "info").map((question) => question.trial))];
  return trials.map((trial) => {
    const group = questions.filter((question) => question.trial === trial && question.kind !== "info");
    let missing: Question | undefined;
    for (const question of group) {
      const value = String(answers[question.key] ?? "");
      const answered = yes.test(value) ? "yes" : no.test(value) ? "no" : null;
      if ((question.kind === "exclude" && answered === "yes") || (question.kind === "include" && answered === "no")) {
        return { trialId: trial, trialName: trial, status: "possible_exclusion", reason: `Reported answer may not fit this criterion: ${question.text}` } satisfies MatchResult;
      }
      if (!answered && !missing) missing = question;
    }
    if (missing) return { trialId: trial, trialName: trial, status: "needs_information", reason: `Needs coordinator verification: ${missing.text}` } satisfies MatchResult;
    return { trialId: trial, trialName: trial, status: "potential_match", reason: "Initial responses align with the configured criteria. Coordinator review is required." } satisfies MatchResult;
  });
}

/** Text handed to Ollie as the {{study_questions}} variable. */
export function agentQuestionList(questions: Question[]): string {
  return questions.map((question, index) => `${index + 1}. [field: ${question.key}] ${question.text}`).join("\n");
}
