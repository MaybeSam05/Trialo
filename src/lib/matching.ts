import type { MatchResult, Trial } from "@/lib/types";

// Deliberately conservative: a missing answer needs coordinator review, never a rejection.
export function matchTrials(answers: Record<string, unknown>, trials: Trial[]): MatchResult[] {
  const normalized = JSON.stringify(answers).toLowerCase();

  return trials.map((trial) => {
    const exclusion = trial.exclusion.find((criterion) => normalized.includes(criterion.toLowerCase()));
    if (exclusion) {
      return {
        trialId: trial.id,
        trialName: trial.name,
        status: "possible_exclusion",
        reason: `Reported information may relate to an exclusion criterion: ${exclusion}.`,
      };
    }

    const missing = trial.inclusion.find((criterion) => !normalized.includes(criterion.toLowerCase()));
    if (missing) {
      return {
        trialId: trial.id,
        trialName: trial.name,
        status: "needs_information",
        reason: `Needs coordinator verification: ${missing}.`,
      };
    }

    return {
      trialId: trial.id,
      trialName: trial.name,
      status: "potential_match",
      reason: "Initial responses align with the configured criteria. Coordinator review is required.",
    };
  });
}
