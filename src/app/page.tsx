"use client";

import { useState } from "react";
import { Ollie } from "@/components/ollie";
import { CampaignPreview } from "@/components/coordinator/campaign-preview";
import { QuestionEditor } from "@/components/coordinator/question-editor";
import { DEMO_CAMPAIGN_NAME, DEMO_QUESTIONS, validateQuestions, type Question } from "@/lib/questions";
import { LinkPanel, type CreatedStudy } from "@/components/coordinator/link-panel";
import { coordinatorLinks, SiteHeader } from "@/components/site-header";
import "@/components/coordinator/questions.css";

type Step = "edit" | "review";

export default function CreateCampaign() {
  const [name, setName] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [step, setStep] = useState<Step>("edit");
  const [created, setCreated] = useState<CreatedStudy | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const kept = questions.filter((question) => question.text.trim());
  const ready = name.trim() !== "" && kept.length > 0;

  // One click to a full, realistic setup for testing and showcasing.
  function loadDemo() {
    setName(DEMO_CAMPAIGN_NAME);
    setQuestions(DEMO_QUESTIONS);
  }

  // Catch problems (like a follow-up placed above its question) before the review step, not after creating.
  function review(event: React.FormEvent) {
    event.preventDefault();
    const checked = validateQuestions(kept);
    if ("error" in checked) { setError(checked.error); return; }
    setError("");
    setStep("review");
    window.scrollTo({ top: 0 });
  }

  async function create() {
    setLoading(true); setError("");
    const response = await fetch("/api/studies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, questions: kept }) });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) { setError(body.error ?? "Could not create the campaign."); return; }
    setCreated(body);
    window.scrollTo({ top: 0 });
  }

  const title = created ? "Share your campaign" : step === "review" ? "Review your campaign" : "Create a campaign";
  const lede = created ? "Your campaign is live. Share the link or QR code; each participant gets their own interview."
    : step === "review" ? "Check the question order, conditions and what participants will see. You can still go back and edit."
    : "Add the questions you already ask people, and Ollie turns them into a voice or text interview. Synthetic data only.";

  return <>
    <SiteHeader subtitle="Coordinator" links={coordinatorLinks} />
    <main id="main" className="page">
      <div className="page-head">
        <Ollie face={error ? "confused" : created ? "celebrate" : loading ? "thinking" : "hello"} size={96} priority />
        <div className="titles">
          <h1>{title}</h1>
          <p className="muted">{lede}</p>
        </div>
      </div>
      {!created && <ol className="setup-progress" aria-label="Steps">
        <li aria-current={step === "edit" ? "step" : undefined}>Add questions</li>
        <li aria-current={step === "review" ? "step" : undefined}>Review</li>
        <li>Share</li>
      </ol>}

      {created ? <LinkPanel created={created} onReset={() => { setCreated(null); setName(""); setQuestions([]); setStep("edit"); }} />
        : step === "review" ? <>
          <CampaignPreview name={name.trim()} questions={kept} />
          <div className="setup-submit">
            <button type="button" className="btn btn-secondary" onClick={() => setStep("edit")} disabled={loading}>Back to edit</button>
            <button type="button" className="btn btn-primary" onClick={create} disabled={loading}>{loading ? "Creating…" : "Create campaign"}</button>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </>
        : <form className="setup" onSubmit={review}>
          <section className="card setup-step" aria-labelledby="step-name">
            <header><span className="step-num" aria-hidden>1</span><h2 id="step-name">Name your campaign</h2></header>
            <input className="setup-name" aria-labelledby="step-name" value={name} placeholder="e.g. Kidney health pre-screen, spring 2026" maxLength={120}
              onChange={(event) => setName(event.target.value)} required />
          </section>
          <section className="card setup-step" aria-labelledby="step-questions">
            <header><span className="step-num" aria-hidden>2</span><div><h2 id="step-questions">Add your screening questions</h2>
              <p className="muted">Age and gender are always asked first. Your questions follow in the order below.</p></div></header>
            <QuestionEditor questions={questions} onChange={setQuestions} onLoadDemo={loadDemo} />
          </section>
          <div className="setup-submit">
            <button className="btn btn-primary" disabled={!ready}>Review campaign</button>
            {!ready && <span className="muted">Add a name and at least one question to continue.</span>}
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </form>}
    </main>
  </>;
}
