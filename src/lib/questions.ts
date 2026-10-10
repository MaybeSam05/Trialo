import type { MatchResult } from "@/lib/types";

// "include": a yes means the person fits. "exclude": a yes may rule them out. "info": collected, never scored.
export type QuestionKind = "include" | "exclude" | "info";
/** Ask only when an earlier answer matches, e.g. { key: "sex_at_birth", equals: "female" } or { key: "diabetes", equals: "yes" }. */
export type Condition = { key: string; equals: string };
export type Question = { key: string; text: string; kind: QuestionKind; trial: string; when?: Condition; minAge?: number; maxAge?: number };
export type ProfileQuestion = { key: string; text: string; answers: string };

export const MAX_QUESTIONS = 30;
const MAX_TEXT = 300;
const KINDS: QuestionKind[] = ["include", "exclude", "info"];
const GENERAL = "General";
// The plan forbids final-decision wording and real health identifiers in questions.
const BANNED = /\b(eligible|ineligible|accepted|rejected|ssn|social security|medical record number)\b/i;

/** Asked first in every interview, before the campaign's own questions. Later questions can depend on them. */
export const PROFILE_QUESTIONS: ProfileQuestion[] = [
  { key: "preferred_name", text: "What should I call you? A first name or nickname is fine.", answers: "any name; skip if they'd rather not say" },
  { key: "age", text: "How old are you?", answers: "a whole number of years" },
  { key: "sex_at_birth", text: "What sex were you assigned at birth: female, male or intersex?", answers: "female, male, intersex or prefer not to say" },
  { key: "gender", text: "How do you describe your gender?", answers: "their own words; optional" },
];
export const SEX_OPTIONS = ["female", "male", "intersex"];
const PROFILE_KEYS = new Set(PROFILE_QUESTIONS.map((question) => question.key));

export const DEMO_CAMPAIGN_NAME = "Trialo demo: kidney and diabetes pre-screen";
// Synthetic demo preset: 5 questions after the profile, showing a follow-up, sex-specific and age-limited questions.
export const DEMO_QUESTIONS: Question[] = [
  { key: "diabetes", text: "Have you been diagnosed with type 2 diabetes?", kind: "include", trial: "Trial A", minAge: 18, maxAge: 75 },
  { key: "metformin", text: "Do you currently take metformin?", kind: "include", trial: "Trial A", when: { key: "diabetes", equals: "yes" } },
  { key: "pregnant", text: "Are you currently pregnant or planning a pregnancy in the next year?", kind: "exclude", trial: "Trial A", when: { key: "sex_at_birth", equals: "female" }, minAge: 18, maxAge: 50 },
  { key: "enlarged_prostate", text: "Have you been told you have an enlarged prostate?", kind: "exclude", trial: "Trial B", when: { key: "sex_at_birth", equals: "male" }, minAge: 40 },
  { key: "other_trial", text: "Are you currently taking part in another clinical trial?", kind: "exclude", trial: "Trial B" },
];

/** Readable, unique field name for Ollie, e.g. "Are you on dialysis?" -> "are_you_on_dialysis". */
export function makeKey(text: string, used: Iterable<string>): string {
  const taken = new Set(used);
  const base = text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").split("_").slice(0, 5).join("_").slice(0, 36) || "q";
  let key = base;
  for (let n = 2; taken.has(key) || PROFILE_KEYS.has(key); n++) key = `${base}_${n}`;
  return key;
}

/** Plain-language summary of when a question is asked, or "" if always. */
export function describeRules(question: Question, questions: Question[] = []): string {
  const parts: string[] = [];
  if (question.when) {
    const { key, equals } = question.when;
    const earlier = questions.findIndex((other) => other.key === key);
    parts.push(key === "sex_at_birth" ? `sex at birth is ${equals}`
      : earlier >= 0 ? `the answer to question ${earlier + 1} is ${equals}`
      : `${key.replaceAll("_", " ")} is ${equals}`);
  }
  if (question.minAge !== undefined && question.maxAge !== undefined) parts.push(`age is ${question.minAge} to ${question.maxAge}`);
  else if (question.minAge !== undefined) parts.push(`age is ${question.minAge} or older`);
  else if (question.maxAge !== undefined) parts.push(`age is ${question.maxAge} or younger`);
  return parts.length ? `only if ${parts.join(" and ")}` : "";
}

const toAge = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  const age = Math.round(Number(value));
  return Number.isFinite(age) && age >= 0 && age <= 120 ? age : NaN;
};

/** Cleans coordinator input. Returns the questions, or an error message to show them. */
export function validateQuestions(input: unknown): { questions: Question[] } | { error: string } {
  if (!Array.isArray(input) || input.length === 0) return { error: "Add at least one question." };
  if (input.length > MAX_QUESTIONS) return { error: `Use at most ${MAX_QUESTIONS} questions.` };
  const questions: Question[] = [];
  for (const [index, raw] of input.entries()) {
    const item = (raw ?? {}) as Partial<Question>;
    const label = `Question ${index + 1}`;
    const text = String(item.text ?? "").trim();
    if (!text) return { error: `${label} is empty.` };
    if (text.length > MAX_TEXT) return { error: `${label} is longer than ${MAX_TEXT} characters.` };
    if (BANNED.test(text)) return { error: `${label} uses wording this demo doesn't allow (final decisions or identifiers).` };
    const kind = KINDS.includes(item.kind as QuestionKind) ? item.kind as QuestionKind : "info";
    const trial = String(item.trial ?? "").trim().slice(0, 60) || GENERAL;
    const cleaned = String(item.key ?? "").replace(/[^a-z0-9_]/gi, "").toLowerCase().slice(0, 40);
    const used = questions.map((question) => question.key);
    const key = cleaned && !used.includes(cleaned) && !PROFILE_KEYS.has(cleaned) ? cleaned : makeKey(text, used);
    const question: Question = { key, text, kind, trial };

    if (item.when?.key) {
      const target = String(item.when.key);
      const equals = String(item.when.equals ?? "").trim().toLowerCase();
      if (!equals) return { error: `${label} has a condition with no answer to match.` };
      if (!PROFILE_KEYS.has(target) && !used.includes(target)) return { error: `${label} depends on a question that is missing or comes after it. Move it below the question it depends on.` };
      question.when = { key: target, equals };
    }
    const minAge = toAge(item.minAge);
    const maxAge = toAge(item.maxAge);
    if (Number.isNaN(minAge) || Number.isNaN(maxAge)) return { error: `${label} has an age limit that isn't between 0 and 120.` };
    if (minAge !== undefined && maxAge !== undefined && minAge > maxAge) return { error: `${label} has a minimum age above its maximum age.` };
    if (minAge !== undefined) question.minAge = minAge;
    if (maxAge !== undefined) question.maxAge = maxAge;
    questions.push(question);
  }
  return { questions };
}

const KIND_ALIASES: Record<string, QuestionKind> = {
  include: "include", inclusion: "include", fit: "include",
  exclude: "exclude", exclusion: "exclude", flag: "exclude",
  info: "info", collect: "info",
};
const CONDITION_ALIASES: Record<string, string> = { sex: "sex_at_birth", gender: "sex_at_birth", sex_at_birth: "sex_at_birth" };

export const QUESTION_TEMPLATE_CSV = [
  "id,question,type,study,ask_if,min_age,max_age",
  "diabetes,Have you been diagnosed with type 2 diabetes?,fit,Trial A,,18,75",
  "metformin,Do you currently take metformin?,fit,Trial A,diabetes=yes,,",
  "pregnant,Are you currently pregnant?,flag,Trial A,sex=female,18,50",
  "prostate,Have you been told you have an enlarged prostate?,flag,Trial B,sex=male,40,",
  "heard_about,How did you hear about this study?,info,,,,",
  "",
].join("\n");

/** Splits one CSV line, keeping commas inside quotes and empty cells. */
function csvCells(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { cells.push(cell.trim()); cell = ""; }
    else cell += char;
  }
  return [...cells, cell.trim()];
}

/**
 * Parses pasted text or CSV. With a header row, columns are matched by name
 * (id, question, type, study, ask_if, min_age, max_age); without one, each line is
 * "question, type, study". Type defaults to fit. Keys are filled in so follow-ups can reference them.
 */
export function parseQuestionText(raw: string, existing: Question[] = []): Question[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const header = lines[0] && /^"?(id|key|question|text)"?\s*,/i.test(lines[0]) ? csvCells(lines[0]).map((cell) => cell.toLowerCase().replace(/\s+/g, "_")) : null;
  const column = (cells: string[], ...names: string[]) => {
    if (!header) return undefined;
    const index = header.findIndex((name) => names.includes(name));
    return index >= 0 ? cells[index] || undefined : undefined;
  };
  const used = existing.map((question) => question.key);
  return (header ? lines.slice(1) : lines).flatMap((line) => {
    const cells = csvCells(line);
    const text = (header ? column(cells, "question", "text") : cells[0]) ?? "";
    if (!text) return [];
    const kind = KIND_ALIASES[(header ? column(cells, "type", "kind") : cells[1])?.toLowerCase() ?? ""] ?? "include";
    const trial = (header ? column(cells, "study", "trial") : cells[2]) ?? "";
    const id = column(cells, "id", "key")?.toLowerCase().replace(/[^a-z0-9_]/g, "");
    const key = id && !used.includes(id) && !PROFILE_KEYS.has(id) ? id : makeKey(text, used);
    used.push(key);
    const question: Question = { key, text, kind, trial };
    const askIf = column(cells, "ask_if", "condition", "when")?.match(/^\s*([a-z0-9_ ]+?)\s*(?:=|\bis\b)\s*(.+)$/i);
    if (askIf) {
      const target = askIf[1].toLowerCase().replace(/\s+/g, "_");
      question.when = { key: CONDITION_ALIASES[target] ?? target, equals: askIf[2].trim().toLowerCase() };
    }
    const minAge = Number(column(cells, "min_age"));
    const maxAge = Number(column(cells, "max_age"));
    if (column(cells, "min_age") && Number.isFinite(minAge)) question.minAge = minAge;
    if (column(cells, "max_age") && Number.isFinite(maxAge)) question.maxAge = maxAge;
    return [question];
  });
}

const yes = /^\s*(yes|yeah|yep|y|true)\b/i;
const no = /^\s*(no|nope|n|false)\b/i;
const yesNo = (value: string) => yes.test(value) ? "yes" : no.test(value) ? "no" : null;

function answerMatches(value: string, expected: string) {
  if (expected === "yes" || expected === "no") return yesNo(value) === expected;
  // "male" must not match "female", so compare from the start of the answer.
  return value.trim().toLowerCase().startsWith(expected);
}

/**
 * Whether a question applies to this participant given what they've answered so far.
 * Unknown answers keep the question in (it may still be asked); known answers that don't match drop it.
 */
export function applies(question: Question, answers: Record<string, unknown>, questions: Question[]): boolean {
  const age = toAge(String(answers.age ?? "").match(/\d+/)?.[0]);
  if (age !== undefined && !Number.isNaN(age)) {
    if (question.minAge !== undefined && age < question.minAge) return false;
    if (question.maxAge !== undefined && age > question.maxAge) return false;
  }
  if (!question.when) return true;
  const parent = questions.find((other) => other.key === question.when!.key);
  if (parent && !applies(parent, answers, questions)) return false;
  const value = answers[question.when.key];
  if (value === undefined || value === null || value === "") return true;
  return answerMatches(String(value), question.when.equals);
}

/** Questions this participant should get, including profile questions. Used for the progress bar. */
export function applicableCount(questions: Question[], answers: Record<string, unknown>): number {
  return PROFILE_QUESTIONS.length + questions.filter((question) => applies(question, answers, questions)).length;
}

/** Scores yes/no answers per trial group. A missing or unclear answer always needs review, never a rejection. */
export function matchQuestions(answers: Record<string, unknown>, questions: Question[]): MatchResult[] {
  const scored = questions.filter((question) => question.kind !== "info");
  const trials = [...new Set(scored.map((question) => question.trial))];
  return trials.map((trial) => {
    const all = scored.filter((question) => question.trial === trial);
    // A "fits if yes" question that was ruled out by age, sex or an earlier answer is a requirement the person doesn't meet.
    const ruledOut = all.find((question) => question.kind === "include" && !applies(question, answers, questions));
    if (ruledOut) return { trialId: trial, trialName: trial, status: "possible_exclusion", reason: `Profile or earlier answers are outside who this criterion is for: ${ruledOut.text}` } satisfies MatchResult;
    const group = all.filter((question) => applies(question, answers, questions));
    let missing: Question | undefined;
    for (const question of group) {
      const answered = yesNo(String(answers[question.key] ?? ""));
      if ((question.kind === "exclude" && answered === "yes") || (question.kind === "include" && answered === "no")) {
        return { trialId: trial, trialName: trial, status: "possible_exclusion", reason: `Reported answer may not fit this criterion: ${question.text}` } satisfies MatchResult;
      }
      if (!answered && !missing) missing = question;
    }
    if (missing) return { trialId: trial, trialName: trial, status: "needs_information", reason: `Needs coordinator verification: ${missing.text}` } satisfies MatchResult;
    if (group.length === 0) return { trialId: trial, trialName: trial, status: "needs_information", reason: "None of this study's questions applied to this participant's profile. Coordinator review is required." } satisfies MatchResult;
    return { trialId: trial, trialName: trial, status: "potential_match", reason: "Initial responses align with the configured criteria. Coordinator review is required." } satisfies MatchResult;
  });
}

/** Text handed to Ollie as the {{study_questions}} variable: profile first, then the campaign's questions with their rules. */
export function agentQuestionList(questions: Question[]): string {
  const profile = PROFILE_QUESTIONS.map((question, index) => `P${index + 1}. [field: ${question.key}] ${question.text} (expected answer: ${question.answers})`);
  const study = questions.map((question, index) => {
    const rules = describeRules(question, questions);
    return `${index + 1}. [field: ${question.key}] ${question.text}${rules ? ` (${rules})` : ""}`;
  });
  return [
    "PROFILE: always ask these first, in order. The participant may skip any of them.",
    ...profile,
    "",
    "SCREENING: then ask these in order. Skip a question if its \"only if\" rule doesn't match the participant's earlier answers; don't mention skipped questions. If an answer the rule needs was skipped, ask the question anyway.",
    ...study,
  ].join("\n");
}
