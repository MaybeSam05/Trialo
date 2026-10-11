import { fitSummary, type Criterion, type OtherStudy, type StudyFit } from "@/lib/cross-match";
import "./other-studies.css";

// The plan's outcome wording; colour is always paired with an icon and a label.
const FIT: Record<StudyFit, { label: string; short: string }> = {
  match: { label: "Potential match for follow-up", short: "Potential match" },
  possible: { label: "Needs review", short: "Needs review" },
  unlikely: { label: "Unlikely match", short: "Unlikely match" },
  unknown: { label: "Not enough information", short: "Not enough info" },
};
type Mark = Criterion["evidence"];
const MARK: Record<Mark, { label: string; tone: string }> = {
  supports: { label: "Fits", tone: "fit" },
  against: { label: "Doesn't fit", tone: "miss" },
  verify: { label: "Unclear answer", tone: "open" },
  not_asked: { label: "Not asked yet", tone: "ask" },
  skipped: { label: "Didn't apply", tone: "ask" },
};
const ORDER: Mark[] = ["supports", "against", "verify", "not_asked"];

function Icon({ tone }: { tone: string }) {
  const path = tone === "fit" || tone === "match" ? "M5 12.5l4.5 4.5L19 7.5"
    : tone === "miss" || tone === "unlikely" ? "M7 7l10 10M17 7L7 17"
    : tone === "ask" || tone === "unknown" ? "M7 12h10"
    : "M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.3-2.5 3.9M12 17.2v.3";
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={path} /></svg>;
}

/** Where a carried-over answer came from; no need to repeat a question asked word for word. */
function sourceOf(criterion: Criterion) {
  if (!criterion.from || criterion.from === criterion.text) return "their answer";
  return criterion.from.startsWith("their age") ? `from ${criterion.from}` : `from “${criterion.from}”`;
}

/** One segment per criterion, in the same order as the checklist: how much of this study the interview already covers. */
function Meter({ criteria }: { criteria: Criterion[] }) {
  return <span className="os-meter" aria-hidden="true">
    {criteria.map((criterion, index) => <span key={index} className={`is-${MARK[criterion.evidence].tone}`} />)}
  </span>;
}

/** One interview, many studies: where else this participant may fit, from the answers they already gave. */
export function OtherStudies({ studies }: { studies: OtherStudy[] }) {
  const worth = studies.filter((study) => study.fit !== "unknown");
  const unknown = studies.filter((study) => study.fit === "unknown");
  const count = (fit: StudyFit) => studies.filter((study) => study.fit === fit).length;

  return <section className="card stack os" aria-labelledby="others-h">
    <div>
      <h2 id="others-h">Other studies to consider</h2>
      <p className="muted os-lede">Their answers compared with your other campaigns, so they don&apos;t have to repeat a screening. Only the same question (in any wording) or their age counts; everything else is still to ask.</p>
    </div>

    {studies.length === 0 ? <p className="muted">No other campaigns with screening questions on this account.</p> : <>
      <ul className="os-tally" aria-label="Summary">
        {(["match", "possible", "unlikely", "unknown"] as StudyFit[]).map((fit) => <li key={fit} className={`is-${fit}${count(fit) ? "" : " is-zero"}`}>
          <span className="os-tally-icon"><Icon tone={fit} /></span>
          <strong>{count(fit)}</strong>
          <span>{FIT[fit].short}</span>
        </li>)}
      </ul>

      {worth.length > 0 ? <div className="os-grid">{worth.map((study) => {
        const criteria = [...study.criteria].filter((criterion) => criterion.evidence !== "skipped").sort((a, b) => ORDER.indexOf(a.evidence) - ORDER.indexOf(b.evidence));
        return <article key={study.key} className={`os-card is-${study.fit}`} aria-label={`${study.label}: ${FIT[study.fit].label}`}>
          <header className="os-card-head">
            <span className="os-badge"><Icon tone={study.fit} /></span>
            <div>
              <p className="os-verdict">{FIT[study.fit].label}</p>
              <h3>{study.label}</h3>
            </div>
          </header>
          <div className="os-coverage">
            <Meter criteria={criteria} />
            <span className="os-coverage-text">{fitSummary(study)}</span>
          </div>
          <ul className="os-criteria">{criteria.map((criterion) => {
            const mark = MARK[criterion.evidence];
            return <li key={criterion.text} className={`is-${mark.tone}`}>
              <span className="os-mark" title={mark.label}><Icon tone={mark.tone} /><span className="os-sr">{mark.label}: </span></span>
              <span className="os-criterion">
                <span>{criterion.text}</span>
                {criterion.answer !== undefined ? <small>“{criterion.answer}” · {sourceOf(criterion)}</small>
                  : <small>{mark.label}</small>}
              </span>
            </li>;
          })}</ul>
        </article>;
      })}</div> : <p className="muted">None of their answers overlap with your other studies yet.</p>}

      {unknown.length > 0 && <div className="os-unknown">
        <p>Not enough information yet for</p>
        <ul>{unknown.map((study) => <li key={study.key}>{study.label}</li>)}</ul>
      </div>}
    </>}
  </section>;
}
