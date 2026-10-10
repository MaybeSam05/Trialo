"use client";

import { useRef, useState } from "react";
import { MAX_QUESTIONS, parseQuestionText, type Question, type QuestionKind } from "@/lib/questions";
import "./questions.css";

const KIND_LABELS: Record<QuestionKind, string> = {
  include: "Needed to fit (yes is good)",
  exclude: "May rule out (yes is a flag)",
  info: "Just collect the answer",
};

export function QuestionEditor({ questions, onChange }: { questions: Question[]; onChange: (questions: Question[]) => void }) {
  const [paste, setPaste] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const update = (index: number, patch: Partial<Question>) => onChange(questions.map((question, position) => position === index ? { ...question, ...patch } : question));
  const move = (index: number, by: number) => {
    const next = [...questions];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const addParsed = (raw: string) => {
    const parsed = parseQuestionText(raw);
    if (parsed.length) onChange([...questions, ...parsed].slice(0, MAX_QUESTIONS));
    setPaste("");
  };

  return <div className="qe">
    <ol className="qe-list">
      {questions.map((question, index) => <li key={index} className="qe-item">
        <div className="qe-row">
          <span className="qe-num" aria-hidden>{index + 1}</span>
          <input aria-label={`Question ${index + 1}`} value={question.text} maxLength={300} placeholder="Ask a yes or no question"
            onChange={(event) => update(index, { text: event.target.value })} />
        </div>
        <div className="qe-row qe-meta">
          <select aria-label={`How question ${index + 1} is used`} value={question.kind} onChange={(event) => update(index, { kind: event.target.value as QuestionKind })}>
            {Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input aria-label={`Study or group for question ${index + 1}`} value={question.trial} maxLength={60} placeholder="Study / group (optional)"
            onChange={(event) => update(index, { trial: event.target.value })} />
          <span className="qe-tools">
            <button type="button" className="qe-icon" aria-label={`Move question ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
            <button type="button" className="qe-icon" aria-label={`Move question ${index + 1} down`} disabled={index === questions.length - 1} onClick={() => move(index, 1)}>↓</button>
            <button type="button" className="qe-icon" aria-label={`Delete question ${index + 1}`} onClick={() => onChange(questions.filter((_, position) => position !== index))}>✕</button>
          </span>
        </div>
      </li>)}
    </ol>
    {questions.length === 0 && <p className="muted">No questions yet. Add one below or paste a list.</p>}
    <div className="qe-actions">
      <button type="button" className="btn btn-secondary" disabled={questions.length >= MAX_QUESTIONS}
        onClick={() => onChange([...questions, { key: "", text: "", kind: "include", trial: "" }])}>Add a question</button>
      <button type="button" className="btn btn-secondary" onClick={() => fileInput.current?.click()}>Upload CSV or text file</button>
      <input ref={fileInput} type="file" accept=".csv,.txt,text/csv,text/plain" hidden
        onChange={async (event) => { const file = event.target.files?.[0]; if (file) addParsed(await file.text()); event.target.value = ""; }} />
    </div>
    <details className="qe-paste">
      <summary>Paste a list</summary>
      <p className="muted">One question per line. Optional columns: <code>question, include|exclude|info, study</code>.</p>
      <textarea rows={5} value={paste} aria-label="Paste questions" onChange={(event) => setPaste(event.target.value)} />
      <button type="button" className="btn btn-secondary" disabled={!paste.trim()} onClick={() => addParsed(paste)}>Add pasted questions</button>
    </details>
    <p className="muted qe-note">Demo data only. Don&apos;t ask for names, record numbers or other identifying details, and avoid wording like &ldquo;eligible&rdquo;.</p>
  </div>;
}
