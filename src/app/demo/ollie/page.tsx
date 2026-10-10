"use client";

import { useState } from "react";
import Link from "next/link";
import { Mascot } from "@/components/participant/mascot";
import type { OllieFace } from "@/components/ollie";
import "@/components/participant/session.css";
import "./preview.css";

const states: { label: string; face: OllieFace; note: string }[] = [
  { label: "Listening", face: "listening", note: "An attentive tilt, nodding, and sound waves while you talk." },
  { label: "Thinking", face: "thinking", note: "A thoughtful sway and floating dots while Ollie prepares a reply." },
  { label: "Speaking", face: "talking", note: "A rhythmic bounce and flipper gestures while Ollie speaks." },
  { label: "Smiling", face: "happy", note: "A happy wiggle, raised flippers, and sparkles to acknowledge an answer." },
];

export default function OlliePreview() {
  const [paused, setPaused] = useState(false);
  return <main className="page ollie-preview">
    <Link href="/">← Back to Trialo</Link>
    <header><p className="eyebrow muted">Ollie · animation preview</p><h1>A little more personality.</h1>
      <p className="muted">The four interview reactions. This preview uses no microphone, voice service, or participant data.</p></header>
    <button className="btn btn-secondary" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? "Play animations" : "Pause animations"}</button>
    <div className="ollie-preview-grid">{states.map((state) => <section className="card" key={state.label}>
      <div className="ollie-preview-stage"><Mascot face={state.face} speaking={state.face === "talking"} listening={state.face === "listening"} reducedMotion={paused} /></div>
      <h2>{state.label}</h2><p className="muted">{state.note}</p>
    </section>)}</div>
    <p className="muted">During an interview, the speaking beak follows agent audio. Your device’s reduced-motion setting is respected.</p>
  </main>;
}
