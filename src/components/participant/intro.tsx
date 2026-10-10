import { Ollie } from "@/components/ollie";
import "./intro.css";

export function Intro({ studyName, onStart, onType }: { studyName: string; onStart: () => void; onType?: () => void }) {
  return <section className="hero intro">
    <div className="hero-inner">
      <div className="hero-guide">
        <p className="bubble">Hi, I&apos;m Ollie! I&apos;ll ask a few quick questions to see which studies might fit you.</p>
        <Ollie face="hello" size={300} priority />
      </div>
      <div className="hero-copy intro-sheet">
        <span className="sheet-grabber" aria-hidden />
        <p className="eyebrow">{studyName}</p>
        <h1>Let&apos;s find a study that may fit you</h1>
        <p className="muted intro-lede">About 5 minutes. Talk to Ollie{onType ? " or type your answers" : ""}. Skip any question or stop at any time.</p>
        <div className="intro-notes">
          <p><strong>Ollie is an AI assistant</strong>, not a clinician. Demo only: please don&apos;t share real health details. Answers are reviewed by the research team. This isn&apos;t medical advice and doesn&apos;t decide eligibility.</p>
          <p className="intro-tip"><strong>Using your voice?</strong> Allow the microphone when your browser asks.</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={onStart}>Start voice interview</button>
          {onType && <button className="btn btn-secondary" onClick={onType}>I&apos;d rather type</button>}
        </div>
        <p className="intro-meta">About 5 minutes · In an emergency, call 911.</p>
      </div>
    </div>
  </section>;
}
