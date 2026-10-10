// Interview progress: how many questions have a saved answer, out of how many.

/** Used when the campaign has no question list (legacy studies). */
export const DEFAULT_TOTAL = 6;

/** Field names from Ollie, normalised so "Type 2 Diabetes" and "type_2_diabetes" count once. */
export function normalizeField(field: string): string {
  return field.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** Adds a saved field. Re-saving or correcting the same answer doesn't count twice. */
export function addAnsweredField(fields: readonly string[], field: string): readonly string[] {
  const key = normalizeField(field);
  return !key || fields.includes(key) ? fields : [...fields, key];
}

export function interviewProgress(fields: readonly string[], questionCount: number | null | undefined) {
  const total = questionCount && questionCount > 0 ? Math.floor(questionCount) : DEFAULT_TOTAL;
  const answered = Math.min(fields.length, total);
  return { answered, total, percent: Math.round((answered / total) * 100) };
}
