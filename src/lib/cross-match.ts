// One interview, many studies: compares a participant's answers with the criteria of the coordinator's other studies,
// so staff can see where else someone may fit without asking them to repeat a screening.
import { answerEvidence, PROFILE_QUESTIONS, type Evidence, type Question } from "@/lib/questions";
import type { MatchResult } from "@/lib/types";

/** match = every criterion fits · possible = some fit, none against, some not asked · unknown = nothing to go on · unlikely = a criterion doesn't fit */
export type StudyFit = "match" | "possible" | "unknown" | "unlikely";
export type Campaign = { slug: string; name: string; questions: Question[] | null };
export type Criterion = { text: string; evidence: Evidence | "not_asked"; answer?: string; from?: string };
export type OtherStudy = { key: string; label: string; campaign: string; slug: string; fit: StudyFit; criteria: Criterion[] };

/** The plan's outcome wording, reused so a cross-study result reads like any other result. */
export const FIT_STATUS: Record<StudyFit, MatchResult["status"]> = { match: "potential_match", possible: "needs_information", unknown: "needs_information", unlikely: "possible_exclusion" };
const ORDER: Record<StudyFit, number> = { match: 0, possible: 1, unknown: 2, unlikely: 3 };

// Framing that doesn't change what's being asked ("Has a doctor told you that you have …" = "Have you been diagnosed with …").
// Time words (ever, now, currently, last, numbers) are kept, so "right now" and "in the last 30 days" never match.
const FRAMING = new Set(["has", "have", "had", "a", "an", "the", "doctor", "told", "you", "your", "that", "been", "diagnosed", "with", "do", "does", "did", "are", "is", "was", "were", "any", "of", "for", "to", "in", "on", "at", "by", "i", "me", "my"]);

/** What a yes/no question is about, ignoring how it's phrased: "type 2 diabetes". Empty when nothing is left. */
export function questionTopic(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((word) => word && !FRAMING.has(word))
    .map((word) => word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word)
    .sort().join(" ");
}

/** Answers questions like "Are you 40 or older?" or "Are you between 18 and 75 years old?" from the age they gave. */
export function answerFromAge(text: string, rawAge: unknown): "yes" | "no" | null {
  const age = Number(String(rawAge ?? "").match(/\d+/)?.[0]);
  if (!Number.isFinite(age) || !/\b(old|older|younger|age|aged)\b/i.test(text)) return null;
  const between = text.match(/\bbetween\s+(\d+)\s+(?:and|to)\s+(\d+)/i);
  if (between) return age >= Number(between[1]) && age <= Number(between[2]) ? "yes" : "no";
  const atLeast = text.match(/\b(\d+)\s+(?:years\s+old\s+)?or\s+older\b/i);
  if (atLeast) return age >= Number(atLeast[1]) ? "yes" : "no";
  const atMost = text.match(/\b(\d+)\s+(?:years\s+old\s+)?or\s+younger\b/i);
  if (atMost) return age <= Number(atMost[1]) ? "yes" : "no";
  return null;
}

/**
 * How this participant's answers line up with every study in the other campaigns. A criterion counts only when the
 * participant answered the same question (same topic, any wording) or it follows from their age; everything else is
 * "not asked". Sorted best fit first. Studies with no scored criteria are left out.
 */
export function otherStudyFits(answers: Record<string, unknown>, asked: Question[] | null, campaigns: Campaign[], ownSlug: string): OtherStudy[] {
  const known = new Map<string, { value: string; from: string }>();
  for (const question of asked ?? []) {
    const value = answers[question.key];
    const topic = questionTopic(question.text);
    if (topic && value !== undefined && value !== null && String(value).trim()) known.set(topic, { value: String(value), from: question.text });
  }
  const profile = Object.fromEntries(PROFILE_QUESTIONS.flatMap((question) => answers[question.key] !== undefined ? [[question.key, answers[question.key]]] : []));

  const results: OtherStudy[] = [];
  for (const campaign of campaigns) {
    if (campaign.slug === ownSlug || !Array.isArray(campaign.questions)) continue;
    const questions = campaign.questions;
    // This participant's answers, re-keyed to the other campaign's questions.
    const mapped: Record<string, unknown> = { ...profile };
    const from = new Map<string, string>();
    for (const question of questions) {
      const same = known.get(questionTopic(question.text));
      const byAge = same ? null : answerFromAge(question.text, profile.age);
      if (same) { mapped[question.key] = same.value; from.set(question.key, same.from); }
      else if (byAge) { mapped[question.key] = byAge === "yes" ? "Yes" : "No"; from.set(question.key, `their age (${String(profile.age).match(/\d+/)?.[0]})`); }
    }
    const trials = [...new Set(questions.filter((question) => question.kind !== "info").map((question) => question.trial))];
    for (const trial of trials) {
      const scored = questions.filter((question) => question.kind !== "info" && question.trial === trial);
      const criteria: Criterion[] = scored.map((question) => {
        const evidence = answerEvidence(question, mapped, questions);
        const answer = mapped[question.key] !== undefined ? String(mapped[question.key]) : undefined;
        // An unanswered criterion that still applies was simply never asked in this interview.
        if (evidence === "verify" && answer === undefined) return { text: question.text, evidence: "not_asked" };
        return { text: question.text, evidence, answer, from: from.get(question.key) };
      });
      const counted = criteria.filter((criterion) => criterion.evidence !== "skipped");
      if (!counted.length) continue;
      const fit: StudyFit = counted.some((criterion) => criterion.evidence === "against") ? "unlikely"
        : counted.every((criterion) => criterion.evidence === "supports") ? "match"
        : counted.some((criterion) => criterion.evidence === "supports") ? "possible"
        : "unknown";
      const label = trials.length === 1 || trial === campaign.name ? campaign.name : `${trial} · ${campaign.name}`;
      results.push({ key: `${campaign.slug}:${trial}`, label, campaign: campaign.name, slug: campaign.slug, fit, criteria });
    }
  }
  return results.sort((a, b) => ORDER[a.fit] - ORDER[b.fit] || share(b) - share(a) || a.label.localeCompare(b.label));
}

/** Share of a study's criteria this interview already shows fit, used to rank studies with the same outcome. */
const share = (study: OtherStudy) => {
  const counted = study.criteria.filter((criterion) => criterion.evidence !== "skipped");
  return counted.filter((criterion) => criterion.evidence === "supports").length / Math.max(1, counted.length);
};

/** One line for staff: "Fits 2 of 3 criteria; 1 not asked yet". */
export function fitSummary(study: OtherStudy): string {
  const counted = study.criteria.filter((criterion) => criterion.evidence !== "skipped");
  const fits = counted.filter((criterion) => criterion.evidence === "supports").length;
  const against = counted.filter((criterion) => criterion.evidence === "against").length;
  const open = counted.length - fits - against;
  const parts = [`Fits ${fits} of ${counted.length} criteria`];
  if (against) parts.push(`${against} doesn't fit`);
  if (open) parts.push(`${open} not asked or unclear`);
  return parts.join("; ");
}
