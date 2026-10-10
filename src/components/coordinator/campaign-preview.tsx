import { Ollie } from "@/components/ollie";
import { describeRules, PROFILE_QUESTIONS, type Question } from "@/lib/questions";
import { KINDS } from "./question-editor";

const kindLabel = (question: Question) => KINDS.find((kind) => kind.value === question.kind)?.label ?? "Info only";

/** Review step before a campaign is created: interview order, scoring, conditions, and what participants see. */
export function CampaignPreview({ name, questions }: { name: string; questions: Question[] }) {
  const studies = [...new Set(questions.filter((question) => question.kind !== "info").map((question) => question.trial.trim() || "General"))];
  const conditional = questions.filter((question) => describeRules(question, questions)).length;

  return <div className="preview">
    <section className="card preview-summary" aria-label="Campaign summary">
      <div><span className="muted">Campaign</span><strong>{name}</strong></div>
      <div><span className="muted">Questions</span><strong>{PROFILE_QUESTIONS.length + questions.length}</strong><span className="muted">{PROFILE_QUESTIONS.length} profile + {questions.length} screening</span></div>
      <div><span className="muted">Studies scored</span><strong>{studies.length}</strong><span className="muted">{studies.join(", ") || "None (info only)"}</span></div>
      <div><span className="muted">With conditions</span><strong>{conditional}</strong><span className="muted">skipped when they don&apos;t apply</span></div>
    </section>

    <div className="preview-grid">
      <section className="card stack" aria-labelledby="preview-order">
        <h2 id="preview-order">Interview order</h2>
        <ol className="preview-order">
          {PROFILE_QUESTIONS.map((question, index) => <li key={question.key} className="is-profile">
            <span className="preview-num" aria-hidden>P{index + 1}</span>
            <div><p>{question.text}</p><p className="muted">Profile question · asked to everyone, first</p></div>
          </li>)}
          {questions.map((question, index) => {
            const rules = describeRules(question, questions);
            return <li key={question.key || index}>
              <span className="preview-num" aria-hidden>{index + 1}</span>
              <div>
                <p>{question.text}</p>
                <p className="preview-tags">
                  <span className={`chip ${question.kind === "include" ? "chip-match" : question.kind === "exclude" ? "chip-exclude" : ""}`}>{kindLabel(question)}</span>
                  {question.trial.trim() && <span className="muted">{question.trial}</span>}
                  <span className="muted">{rules ? `Asked ${rules}` : "Asked to everyone"}</span>
                </p>
              </div>
            </li>;
          })}
        </ol>
      </section>

      <section className="card stack" aria-labelledby="preview-participant">
        <h2 id="preview-participant">What participants see</h2>
        <div className="preview-phone" aria-label="Participant screen preview">
          <p className="preview-bubble">Hi, I&apos;m Ollie! I&apos;ll ask a few quick questions to see which studies might fit you.</p>
          <Ollie face="hello" size={96} />
          <div className="preview-sheet">
            <strong>Let&apos;s find a study that may fit you</strong>
            <span className="btn btn-primary" aria-hidden>Start voice interview</span>
            <span className="btn btn-secondary" aria-hidden>Start text interview</span>
          </div>
        </div>
        <p className="muted">Ollie asks one question at a time by voice or text, starting with &ldquo;{PROFILE_QUESTIONS[0].text}&rdquo; Questions with conditions are skipped automatically when they don&apos;t apply.</p>
      </section>
    </div>
  </div>;
}
