import { SessionChip } from "@/components/status-chip";
import type { SessionOutcome } from "./session-outcome";

// Keep dashboard wording local until the shared MatchChip vocabulary is updated
// by its owner. Reuse the existing shared chip and palette wherever possible.
export function DashboardStatusChip({ status }: { status: SessionOutcome }) {
  if (status === "needs_review") return <SessionChip status="needs_review" />;
  return <span className={`chip chip-${status === "potential_match" ? "match" : "exclude"}`}>
    {status === "potential_match" ? "Potential match for follow-up" : "Unlikely match"}
  </span>;
}
