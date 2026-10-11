import { MatchChip } from "@/components/status-chip";
import { FIT_STATUS, fitSummary, type Criterion, type OtherStudy } from "@/lib/cross-match";

const CROSS: Record<Criterion["evidence"], { title: string; icon: string; tone: string }> = {
  supports: { title: "Fits", icon: "✓", tone: "supports" },
  against: { title: "Doesn't fit", icon: "✕", tone: "against" },
  verify: { title: "Unclear answer", icon: "?", tone: "verify" },
  not_asked: { title: "Not asked in this interview", icon: "?", tone: "skipped" },
  skipped: { title: "Didn't apply", icon: "–", tone: "skipped" },
};

/** One interview, many studies: where else this participant may fit, from the answers they already gave. */
export function OtherStudies({ studies }: { studies: OtherStudy[] }) {
  const worth = studies.filter((study) => study.fit !== "unknown");
  const unknown = studies.filter((study) => study.fit === "unknown");
  return <section className="card stack" aria-labelledby="others-h">
    <h2 id="others-h">Other studies to consider</h2>
    <p className="muted">This participant&apos;s answers compared with your other campaigns&apos; criteria, so they don&apos;t have to repeat a screening. Answers count when they gave the same question (in any wording) or it follows from their age. Criteria not asked need follow-up.</p>
    {studies.length === 0 ? <p className="muted">No other campaigns with screening questions on this account.</p>
      : worth.length === 0 ? <p className="muted">None of their answers overlap with your other studies yet.</p>
      : <div>{worth.map((study) => {
        const groups = (Object.keys(CROSS) as Criterion["evidence"][]).filter((kind) => kind !== "skipped")
          .map((kind) => ({ kind, items: study.criteria.filter((criterion) => criterion.evidence === kind) })).filter((group) => group.items.length);
        return <div key={study.key} className="trial-result">
          <strong>{study.label}</strong>
          <MatchChip status={FIT_STATUS[study.fit]} />
          <p className="muted">{fitSummary(study)}.</p>
          <div className="evidence">{groups.map((group) => <div key={group.kind} className={`evidence-group is-${CROSS[group.kind].tone}`}>
            <p className="evidence-title"><span aria-hidden>{CROSS[group.kind].icon}</span>{CROSS[group.kind].title}</p>
            <ul>{group.items.map((criterion) => <li key={criterion.text}>
              <span>{criterion.text}</span>
              {criterion.answer !== undefined && <span className="evidence-answer">“{criterion.answer}”{criterion.from ? `, from ${criterion.from.startsWith("their age") ? criterion.from : `“${criterion.from}”`}` : ""}</span>}
            </li>)}</ul>
          </div>)}</div>
        </div>;
      })}</div>}
    {unknown.length > 0 && <p className="muted">Not enough information yet for: {unknown.map((study) => study.label).join(", ")}.</p>}
  </section>;
}

