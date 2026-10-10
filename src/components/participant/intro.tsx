import { Ollie } from "@/components/ollie";
import "./intro.css";

const HOW_IT_WORKS = [
  ["Just talk", "Ollie asks each question out loud and checks your answer with you before saving it."],
  ["Skip or stop anytime", "You can skip any question or end the interview whenever you like."],
  ["Reviewed by people", "The research team reviews your answers. Nothing here decides eligibility or enrollment."],
];

export function Intro({ studyName, onStart, onType }: { studyName: string; onStart: () => void; onType?: () => void }) {
  return <>
    <section className="hero intro">
      <div className="hero-inner">
        <div className="hero-guide">
          <p className="bubble">Hi, I&apos;m Ollie! I&apos;ll ask a few quick questions to see which studies might fit you.</p>
          <Ollie face="hello" size={300} priority />
        </div>
        <div className="hero-copy intro-sheet">
          <span className="sheet-grabber" aria-hidden />
          <p className="eyebrow">{studyName}</p>
          <h1>Let&apos;s find a study that may fit you</h1>
          <p className="muted">About 5 minutes. Talk to Ollie{onType ? " or type your answers" : ""}. You can skip any question or stop at any time.</p>
          <div className="intro-notes">
            <p><strong>Ollie is an AI assistant</strong>, not a person or a clinician. This is a demo with practice data only, so please don&apos;t share real health details.</p>
            <p>Your answers may be recorded or transcribed and reviewed by the research team. This is not medical advice and does not determine eligibility or enrollment.</p>
            <p><strong>Using your voice?</strong> Your browser will ask to use the microphone. Find a quiet spot and allow it when asked.</p>
          </div>
          <div className="actions">
            <button className="btn btn-primary" onClick={onStart}>Start voice interview</button>
            {onType && <button className="btn btn-secondary" onClick={onType}>I&apos;d rather type</button>}
          </div>
          <p className="intro-meta">Demo only · About 5 minutes · Reviewed by people</p>
        </div>
      </div>
    </section>
    <section className="page features" aria-label="How it works">
      {HOW_IT_WORKS.map(([title, text]) => <div key={title} className="card stack"><h2>{title}</h2><p className="muted">{text}</p></div>)}
    </section>
  </>;
}
