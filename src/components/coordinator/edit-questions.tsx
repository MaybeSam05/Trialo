"use client";

import { useEffect, useRef, useState } from "react";
import { QuestionEditor } from "./question-editor";
import { DEMO_QUESTIONS, validateQuestions, type Question } from "@/lib/questions";
import { requestJson } from "@/lib/request";

const same = (a: Question[], b: Question[]) => JSON.stringify(a) === JSON.stringify(b);

export function EditQuestions({ slug, initial }: { slug: string; initial: Question[] }) {
  const [saved, setSaved] = useState(initial);
  const [questions, setQuestions] = useState(initial);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  // Blocks a second save before the disabled button re-renders.
  const pending = useRef(false);
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
    if (pending.current) return;
    pending.current = true;
    setSaving(true); setMessage(null);
    // Never throws, so "Saving…" always clears; unsaved edits stay on screen for a retry.
    const result = await requestJson<{ questions?: Question[] }>(`/api/studies/${slug}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ questions: kept }) }, "save your changes");
    pending.current = false;
    setSaving(false);
    if (!result.ok || !result.body.questions) { setMessage({ text: result.ok ? "Couldn't save your changes: the server sent an unexpected reply. Please try again." : result.error, error: true }); return; }
    setSaved(result.body.questions);
    setQuestions(result.body.questions);
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
