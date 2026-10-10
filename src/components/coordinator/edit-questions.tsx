"use client";

import { useState } from "react";
import { QuestionEditor } from "./question-editor";
import { DEMO_QUESTIONS, type Question } from "@/lib/questions";

export function EditQuestions({ slug, initial }: { slug: string; initial: Question[] }) {
  const [questions, setQuestions] = useState(initial);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true); setMessage(null);
    const response = await fetch(`/api/studies/${slug}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ questions: questions.filter((question) => question.text.trim()) }) });
    const body = await response.json() as { questions?: Question[]; error?: string };
    setSaving(false);
    if (!response.ok || !body.questions) { setMessage({ text: body.error ?? "Could not save.", error: true }); return; }
    setQuestions(body.questions);
    setMessage({ text: "Saved. New interviews will use these questions.", error: false });
  }

  return <section className="card stack">
    <QuestionEditor questions={questions} onChange={setQuestions} onLoadDemo={() => setQuestions(DEMO_QUESTIONS)} />
    <div className="actions"><button className="btn btn-primary" onClick={save} disabled={saving || !questions.some((question) => question.text.trim())}>{saving ? "Saving…" : "Save questions"}</button></div>
    {message && <p className={message.error ? "error" : "chip chip-match"} role={message.error ? "alert" : "status"}>{message.text}</p>}
  </section>;
}
