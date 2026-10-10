"use client";

import { useRef, useState } from "react";
import { makeKey, MAX_QUESTIONS, parseQuestionText, isProfileKey, QUESTION_TEMPLATE_CSV, GENDER_OPTIONS, type Question, type QuestionKind } from "@/lib/questions";
import "./questions.css";

const KINDS: { value: QuestionKind; label: string; hint: string }[] = [
  { value: "include", label: "Fits if yes", hint: "A no means the person may not fit" },
  { value: "exclude", label: "Flag if yes", hint: "A yes may rule the person out" },
  { value: "info", label: "Info only", hint: "Collected, never scored" },
];
const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(QUESTION_TEMPLATE_CSV)}`;
const short = (text: string) => text.length > 42 ? `${text.slice(0, 40).trim()}…` : text || "untitled";

export function QuestionEditor({ questions, onChange, onLoadDemo }: { questions: Question[]; onChange: (questions: Question[]) => void; onLoadDemo?: () => void }) {
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [pasting, setPasting] = useState(false);
  const [paste, setPaste] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLOListElement>(null);

  const room = MAX_QUESTIONS - questions.length;
  const update = (index: number, patch: Partial<Question>) => onChange(questions.map((question, position) => position === index ? { ...question, ...patch } : question));
  const move = (index: number, by: number) => {
    const next = [...questions];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };
  // Questions that depended on a deleted one go back to being asked to everyone.
  const remove = (index: number) => {
    const gone = questions[index].key;
    onChange(questions.filter((_, position) => position !== index).map((question) => question.when?.key === gone ? { ...question, when: undefined } : question));
  };
  // New rows render on the next frame, so focus the last question input after it exists.
  const focusLast = () => requestAnimationFrame(() => list.current?.querySelector<HTMLInputElement>("li:last-child .qe-text")?.focus());
  const addBlank = () => {
    onChange([...questions, { key: makeKey("", questions.map((question) => question.key)), text: "", kind: "include", trial: "" }]);
    focusLast();
  };

  function addParsed(raw: string, source: string) {
    const parsed = parseQuestionText(raw, questions);
    if (!parsed.length) { setNotice({ text: `No questions found in ${source}. Put one question per line.`, error: true }); return; }
    const added = parsed.slice(0, room);
    onChange([...questions, ...added]);
    setNotice({ text: `Added ${added.length} question${added.length === 1 ? "" : "s"} from ${source}.${added.length < parsed.length ? ` ${parsed.length - added.length} skipped (limit is ${MAX_QUESTIONS}).` : ""}`, error: false });
    setPaste(""); setPasting(false);
  }
  async function addFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 200_000) { setNotice({ text: "That file is too large. Use a CSV or text file under 200 KB.", error: true }); return; }
    addParsed(await file.text(), file.name);
  }

  const fileField = <input ref={fileInput} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(event) => { addFile(event.target.files?.[0]); event.target.value = ""; }} />;
  const status = notice && <p className={`qe-notice${notice.error ? " is-error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.text}</p>;

  if (questions.length === 0) return <div className="qe">
    <div className={`qe-drop${dragging ? " is-dragging" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); addFile(event.dataTransfer.files[0]); }}>
      <span className="qe-drop-icon" aria-hidden>↑</span>
      <h3>Upload your screening questions</h3>
      <p className="muted">Drop a CSV or text file here, one question per line. Age and gender are always asked first.</p>
      <div className="qe-drop-actions">
        <button type="button" className="btn btn-primary" onClick={() => fileInput.current?.click()}>Choose file</button>
        <a className="btn btn-secondary" href={TEMPLATE_HREF} download="trialo-questions-template.csv">Download questions template</a>
        <button type="button" className="qe-link" aria-expanded={pasting} onClick={() => setPasting(!pasting)}>{pasting ? "Cancel pasting" : "Paste text instead"}</button>
      </div>
      <details className="qe-guide">
        <summary>See CSV guidelines</summary>
        <table>
          <thead><tr><th scope="col">Column</th><th scope="col">What to put</th><th scope="col">Example</th></tr></thead>
          <tbody>
            <tr><td><code>question</code></td><td>The yes or no question. Required.</td><td>Have you been diagnosed with asthma?</td></tr>
            <tr><td><code>type</code></td><td><b>fit</b> (yes is good), <b>flag</b> (yes may rule out) or <b>info</b> (just collect). Defaults to fit.</td><td>fit</td></tr>
            <tr><td><code>study</code></td><td>Which study the question counts toward. Optional.</td><td>Asthma study</td></tr>
            <tr><td><code>id</code></td><td>A short name, so follow-up questions can point to it. Optional.</td><td>asthma</td></tr>
            <tr><td><code>ask_if</code></td><td>Only ask when an earlier answer matches: <code>gender=female</code> or <code>id=yes</code>. Optional.</td><td>asthma=yes</td></tr>
            <tr><td><code>min_age</code>, <code>max_age</code></td><td>Only ask people in this age range. Optional.</td><td>12, 65</td></tr>
          </tbody>
        </table>
        <p className="muted">Include a header row with these column names. Without one, each line is read as <code>question, type, study</code>.</p>
      </details>
      {pasting && <div className="qe-paste">
        <textarea rows={5} value={paste} aria-label="Paste questions, one per line" placeholder={"id,question,type,study,ask_if,min_age,max_age\nallergies,Do you have seasonal allergies?,fit,Trial A,,12,"} onChange={(event) => setPaste(event.target.value)} />
        <button type="button" className="btn btn-secondary" disabled={!paste.trim()} onClick={() => addParsed(paste, "your pasted text")}>Add pasted questions</button>
      </div>}
      {fileField}
    </div>
    {status}
    <div className="qe-or"><span>or</span></div>
    <div className="qe-start">
      <button type="button" className="btn btn-secondary" onClick={addBlank}>Create questions here</button>
      {onLoadDemo && <button type="button" className="btn btn-secondary" onClick={onLoadDemo}>Use demo preset</button>}
    </div>
  </div>;

  return <div className="qe">
    <div className="qe-toolbar">
      <p><strong>{questions.length} screening question{questions.length === 1 ? "" : "s"}</strong> <span className="muted">· asked in this order, after the profile</span></p>
      <button type="button" className="qe-link" onClick={() => { if (questions.length <= 1 || window.confirm(`Remove all ${questions.length} questions?`)) { onChange([]); setNotice(null); } }}>Remove all</button>
    </div>
    {status}
    <ol className="qe-list" ref={list}>
      {questions.map((question, index) => {
        const earlier = questions.slice(0, index).filter((other) => other.text.trim());
        const condition = question.when ? `${question.when.key}=${question.when.equals}` : "";
        const dependsOnLater = question.when && !isProfileKey(question.when.key) && !earlier.some((other) => other.key === question.when!.key);
        const parent = questions.findIndex((other) => other.key === question.when?.key);
        return <li key={question.key || index} className="qe-item">
          <span className="qe-num" aria-hidden>{index + 1}</span>
          <div className="qe-body">
            <input className="qe-text" aria-label={`Question ${index + 1}`} value={question.text} maxLength={300} placeholder="Type a yes or no question"
              onChange={(event) => update(index, { text: event.target.value })} />
            <div className="qe-meta">
              <div className="qe-kinds" role="radiogroup" aria-label={`How question ${index + 1} is scored`}>
                {KINDS.map((kind) => <label key={kind.value} className="qe-kind" title={kind.hint}>
                  <input type="radio" name={`kind-${index}`} value={kind.value} checked={question.kind === kind.value} onChange={() => update(index, { kind: kind.value })} />
                  <span>{kind.label}</span>
                </label>)}
              </div>
              <input className="qe-trial" aria-label={`Study for question ${index + 1}`} value={question.trial} maxLength={60} placeholder="Study (optional)"
                onChange={(event) => update(index, { trial: event.target.value })} />
            </div>
            <div className="qe-rules">
              <label className="qe-rule">
                <span>Ask</span>
                <select value={condition} aria-label={`Who gets question ${index + 1}`} onChange={(event) => {
                  const [key, equals] = event.target.value.split("=");
                  update(index, { when: key ? { key, equals } : undefined });
                }}>
                  <option value="">everyone</option>
                  <optgroup label="By gender">
                    {GENDER_OPTIONS.map((gender) => <option key={gender} value={`gender=${gender}`}>only if gender is {gender}</option>)}
                  </optgroup>
                  {earlier.length > 0 && <optgroup label="Follow-up to an earlier question">
                    {earlier.flatMap((other) => ["yes", "no"].map((answer) => <option key={`${other.key}=${answer}`} value={`${other.key}=${answer}`}>
                      only if Q{questions.indexOf(other) + 1} ({short(other.text)}) is {answer}
                    </option>))}
                  </optgroup>}
                  {dependsOnLater && <option value={condition}>only if Q{parent + 1} is {question.when!.equals} (must come earlier)</option>}
                </select>
              </label>
              <span className="qe-rule qe-ages">
                <span>Ages</span>
                <input type="number" inputMode="numeric" min={0} max={120} placeholder="any" aria-label={`Minimum age for question ${index + 1}`} value={question.minAge ?? ""}
                  onChange={(event) => update(index, { minAge: event.target.value === "" ? undefined : Number(event.target.value) })} />
                <span aria-hidden>to</span>
                <input type="number" inputMode="numeric" min={0} max={120} placeholder="any" aria-label={`Maximum age for question ${index + 1}`} value={question.maxAge ?? ""}
                  onChange={(event) => update(index, { maxAge: event.target.value === "" ? undefined : Number(event.target.value) })} />
              </span>
            </div>
            {dependsOnLater && <p className="qe-warn" role="alert">This follows up on question {parent + 1}, which comes later. Move it below question {parent + 1}.</p>}
          </div>
          <div className="qe-tools">
            <button type="button" className="qe-icon" aria-label={`Move question ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
            <button type="button" className="qe-icon" aria-label={`Move question ${index + 1} down`} disabled={index === questions.length - 1} onClick={() => move(index, 1)}>↓</button>
            <button type="button" className="qe-icon qe-delete" aria-label={`Delete question ${index + 1}`} onClick={() => remove(index)}>✕</button>
          </div>
        </li>;
      })}
    </ol>
    <div className="qe-add">
      <button type="button" className="btn btn-secondary" disabled={room <= 0} onClick={addBlank}>+ Add a question</button>
      <button type="button" className="btn btn-secondary" disabled={room <= 0} onClick={() => fileInput.current?.click()}>Upload more</button>
      {fileField}
    </div>
    <p className="muted qe-note">Demo data only. Don&apos;t ask for record numbers or other identifying details, and avoid wording like &ldquo;eligible&rdquo;.</p>
  </div>;
}

