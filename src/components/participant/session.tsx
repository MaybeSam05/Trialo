import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Ollie, type OllieFace } from "@/components/ollie";
import "./session.css";

export type Message = { id: number; role: "user" | "agent"; text: string };
export type InterviewMode = "voice" | "text";

export const TOTAL_QUESTIONS = 6;
const QUICK_ANSWERS = ["Yes", "No", "Not sure"];

// Questions on these topics get Ollie's gentle face instead of the regular one.
const SENSITIVE = /pregnan|mental|depress|anxiet|suicid|self-harm|drug|alcohol|substance|\bhiv\b|sexual|abuse/i;
const RESTING_AFTER_MS = 45_000;
const IDLE_LEVELS: number[] = Array(11).fill(0);

export function Session({ mode, connected, ended, error, isSpeaking, isMuted, messages, savedCount, lastActivity, happyUntil, getInputVolume, getOutputVolume, onSend, onToggleMute, onEnd, onRetry }: {
  mode: InterviewMode; connected: boolean; ended: boolean; error: string; isSpeaking: boolean; isMuted: boolean;
  messages: Message[]; savedCount: number; lastActivity: number; happyUntil: number;
  getInputVolume: () => number; getOutputVolume: () => number;
  onSend: (text: string) => void; onToggleMute: () => void; onEnd: () => void; onRetry: () => void;
}) {
  const [now, setNow] = useState(0);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [levels, setLevels] = useState<number[]>(IDLE_LEVELS);
  const [draft, setDraft] = useState("");
  const reducedMotion = usePrefersReducedMotion();
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const voice = mode === "voice";

  // Clock for timed expressions (happy flash, resting after silence).
  useEffect(() => {
    if (!connected) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [connected]);

  // Beak flaps between talking and hello while Ollie speaks.
  useEffect(() => {
    if (!connected || !isSpeaking || reducedMotion) return;
    const timer = setInterval(() => setMouthOpen((open) => !open), 170);
    return () => clearInterval(timer);
  }, [connected, isSpeaking, reducedMotion]);

  // Sound-level bars follow Ollie's voice while speaking and the microphone while listening.
  useEffect(() => {
    if (!connected || !voice || reducedMotion) return;
    const timer = setInterval(() => {
      const volume = Math.min(1, (isSpeaking ? getOutputVolume() : getInputVolume()) * 2.5);
      setLevels((current) => current.map((_, index) => Math.max(0.12, volume * (0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 140 + index * 1.7))))));
    }, 90);
    return () => clearInterval(timer);
  }, [connected, voice, isSpeaking, reducedMotion, getInputVolume, getOutputVolume]);

  // Keep the newest caption in view.
  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  }, [messages.length, reducedMotion]);

  const lastAgent = [...messages].reverse().find((message) => message.role === "agent")?.text ?? "";
  const waitingForOllie = !voice && messages.at(-1)?.role === "user";
  const sensitive = SENSITIVE.test(lastAgent);
  const face: OllieFace = error ? "confused"
    : ended ? "celebrate"
    : !connected ? "thinking"
    : now < happyUntil ? "happy"
    : waitingForOllie ? "thinking"
    : isSpeaking ? (reducedMotion || mouthOpen ? "talking" : sensitive ? "gentle" : "hello")
    : now - lastActivity > RESTING_AFTER_MS ? "resting"
    : sensitive ? "gentle"
    : "listening";

  const status = error ? "Connection problem" : ended ? "Interview finished" : !connected ? "Connecting…"
    : !voice ? (waitingForOllie ? "Ollie is replying…" : "Type or tap your answer")
    : isSpeaking ? "Ollie is speaking" : isMuted ? "Microphone muted" : "Listening…";
  const bubble = error ? "Hmm, I couldn't connect. Let's try that again."
    : ended ? "Thank you! The research team will review your answers."
    : !connected ? "Connecting you to Ollie…"
    : lastAgent || "Hi! I'm getting ready to ask my first question.";

  const answered = Math.min(savedCount, TOTAL_QUESTIONS);
  const canAnswer = connected && !ended;

  function send(text: string) {
    const value = text.trim();
    if (!value || !canAnswer) return;
    onSend(value);
    setDraft("");
  }

  return <section className="iv" aria-label="Pre-screening interview">
    <div className="iv-stage">
      <div className="iv-topline">
        <span className="iv-status" aria-live="polite">{status}</span>
        <Progress answered={answered} />
      </div>
      <p className="iv-question" aria-live="polite">{bubble}</p>
      <Ollie face={face} size={240} />
      {voice && !ended && <div className="iv-levels" aria-hidden>{(connected && !reducedMotion ? levels : IDLE_LEVELS).map((level, index) => <span key={index} style={{ height: `${Math.round(8 + level * 40)}px` }} />)}</div>}
    </div>

    <div className="iv-sheet">
      <span className="iv-grabber" aria-hidden />
      {ended ? <div className="iv-done">
        <h2>You&apos;re all done</h2>
        <p>This does not determine eligibility or enrollment. A member of the research team will follow up if a study may be relevant to you.</p>
      </div> : <>
        <div className="iv-answer">
          <p className="iv-label" id="quick-label">{voice ? "Say your answer, or tap one" : "Tap an answer or type your own"}</p>
          <div className="iv-quick" role="group" aria-labelledby="quick-label">
            {QUICK_ANSWERS.map((answer) => <button key={answer} className="btn btn-secondary" disabled={!canAnswer} onClick={() => send(answer)}>{answer}</button>)}
          </div>
          {!voice && <form className="iv-compose" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
            <label className="iv-sr-only" htmlFor="typed-answer">Your answer</label>
            <input id="typed-answer" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type your answer" autoComplete="off" disabled={!canAnswer} autoFocus />
            <button className="btn btn-primary" disabled={!canAnswer || !draft.trim()}>Send</button>
          </form>}
        </div>
      </>}

      <div className="iv-captions">
        <p className="iv-label">{voice ? "Captions" : "Conversation"}</p>
        <div className="iv-log" aria-live="polite">
          {messages.length === 0 ? <p className="muted">{voice ? "What you and Ollie say will appear here." : "Your conversation will appear here."}</p>
            : messages.slice(-12).map((message) => <p key={`${message.role}-${message.id}`} className={`iv-line iv-${message.role}`}>
              <strong>{message.role === "agent" ? "Ollie" : "You"}</strong>{message.text}
            </p>)}
          <div ref={transcriptEnd} />
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {connected ? <div className="iv-actions">
        {voice && <button className="btn btn-secondary" onClick={onToggleMute} aria-pressed={isMuted}>{isMuted ? "Unmute microphone" : "Mute microphone"}</button>}
        <button className="btn btn-secondary iv-end" onClick={onEnd}>End interview</button>
      </div> : error ? <button className="btn btn-primary" onClick={onRetry}>Try again</button> : null}

      <p className="iv-disclosure">Ollie is an AI assistant, not a clinician. Demo only: please don&apos;t share real health details.</p>
    </div>
  </section>;
}

function Progress({ answered }: { answered: number }) {
  return <div className="iv-progress">
    <span>{answered} of {TOTAL_QUESTIONS} answers saved</span>
    <span className="iv-track" role="progressbar" aria-label="Answers saved" aria-valuemin={0} aria-valuemax={TOTAL_QUESTIONS} aria-valuenow={answered}>
      <span style={{ width: `${(answered / TOTAL_QUESTIONS) * 100}%` }} />
    </span>
  </div>;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore((onChange) => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
}
