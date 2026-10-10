"use client";

import { useEffect, useState } from "react";
import { QuestionEditor } from "./question-editor";
import { DEMO_QUESTIONS, validateQuestions, type Question } from "@/lib/questions";

const same = (a: Question[], b: Question[]) => JSON.stringify(a) === JSON.stringify(b);

export function EditQuestions({ slug, initial }: { slug: string; initial: Question[] }) {
  const [saved, setSaved] = useState(initial);
  const [questions, setQuestions] = useState(initial);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = !same(questions, saved);

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save() {
    const kept = questions.filter((question) => question.text.trim());
    const checked = validateQuestions(kept);
    if ("error" in checked) { setMessage({ text: checked.error, error: true }); return; }
    setSaving(true); setMessage(null);
    const response = await fetch(`/api/studies/${slug}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ questions: kept }) });
    const body = await response.json() as { questions?: Question[]; error?: string };
    setSaving(false);
    if (!response.ok || !body.questions) { setMessage({ text: body.error ?? "Could not save.", error: true }); return; }
    setSaved(body.questions);
    setQuestions(body.questions);
    setMessage({ text: "Saved. New interviews will use these questions.", error: false });
  }

  return <>
    <section className="card stack">
      <QuestionEditor questions={questions} onChange={(next) => { setQuestions(next); setMessage(null); }} onLoadDemo={() => setQuestions(DEMO_QUESTIONS)} />
    </section>
    <div className="save-bar" role="region" aria-label="Save changes">
      <span className={`save-state${dirty ? " is-dirty" : ""}`} role="status">
        {message?.error ? <span className="save-error">{message.text}</span> : dirty ? "Unsaved changes" : message ? message.text : "All changes saved"}
      </span>
      <button type="button" className="btn btn-secondary" disabled={!dirty || saving} onClick={() => { setQuestions(saved); setMessage(null); }}>Cancel</button>
      <button type="button" className="btn btn-primary" disabled={!dirty || saving || !questions.some((question) => question.text.trim())} onClick={save}>{saving ? "Saving…" : "Save changes"}</button>
    </div>
  </>;
}
