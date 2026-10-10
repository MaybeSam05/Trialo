import type { MatchResult, ScreeningSession } from "@/lib/types";

const matchChips: Record<MatchResult["status"], { label: string; tone: string }> = {
  potential_match: { label: "Potential match", tone: "match" },
  needs_information: { label: "Needs information", tone: "missing" },
  possible_exclusion: { label: "Possible exclusion", tone: "exclude" },
};

const sessionChips: Record<ScreeningSession["status"], { label: string; tone: string }> = {
  started: { label: "In progress", tone: "neutral" },
  completed: { label: "Completed", tone: "neutral" },
  needs_review: { label: "Needs review", tone: "verify" },
};

export function MatchChip({ status }: { status: MatchResult["status"] }) {
  const chip = matchChips[status];
  return <span className={`chip chip-${chip.tone}`}>{chip.label}</span>;
}

export function SessionChip({ status }: { status: string }) {
  const chip = sessionChips[status as ScreeningSession["status"]] ?? { label: status.replaceAll("_", " "), tone: "neutral" };
  return <span className={`chip chip-${chip.tone}`}>{chip.label}</span>;
}
