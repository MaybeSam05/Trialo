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
