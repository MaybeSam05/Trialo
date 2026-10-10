"use client";

import { useState } from "react";
import { Ollie } from "@/components/ollie";
import { QuestionEditor } from "@/components/coordinator/question-editor";
import type { Question } from "@/lib/questions";
import { LinkPanel, type CreatedStudy } from "@/components/coordinator/link-panel";
import { coordinatorLinks, SiteHeader } from "@/components/site-header";
import "@/components/coordinator/questions.css";

export default function Home() {
  const [name, setName] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [created, setCreated] = useState<CreatedStudy | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const ready = name.trim() !== "" && questions.some((question) => question.text.trim());

  async function createStudy(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    const kept = questions.filter((question) => question.text.trim());
    const response = await fetch("/api/studies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, questions: kept }) });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) { setError(body.error ?? "Could not create the screening link."); return; }
    setCreated(body);
  }

  return <>
    <SiteHeader subtitle="Coordinator" links={coordinatorLinks} />
    <main id="main" className="page">
      <div className="page-head">
        <Ollie face={error ? "confused" : created ? "celebrate" : loading ? "thinking" : "hello"} size={96} priority />
        <div className="titles">
          <h1>Set up a screening campaign</h1>
          <p className="muted">Add the questions you already ask people, and Ollie turns them into a voice or text interview with one shareable link. Synthetic data only.</p>
        </div>
      </div>
      <form className="setup" onSubmit={createStudy}>
        <section className="card setup-step" aria-labelledby="step-name">
          <header><span className="step-num" aria-hidden>1</span><h2 id="step-name">Name your campaign</h2></header>
          <input className="setup-name" aria-labelledby="step-name" value={name} placeholder="e.g. Kidney health pre-screen, spring 2026" maxLength={120}
            onChange={(event) => setName(event.target.value)} required />
        </section>
        <section className="card setup-step" aria-labelledby="step-questions">
          <header><span className="step-num" aria-hidden>2</span><div><h2 id="step-questions">Add your screening questions</h2>
            <p className="muted">Upload the questions you already use, or write them here.</p></div></header>
          <QuestionEditor questions={questions} onChange={setQuestions} />
        </section>
        <div className="setup-submit">
          <button className="btn btn-primary" disabled={loading || !ready}>{loading ? "Creating…" : "Create link and QR code"}</button>
          {!ready && <span className="muted">Add a name and at least one question to continue.</span>}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
      {created && <LinkPanel created={created} />}
    </main>
  </>;
}
