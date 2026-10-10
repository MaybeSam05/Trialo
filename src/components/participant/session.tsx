import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { OllieFace } from "@/components/ollie";
import { Mascot } from "@/components/participant/mascot";
import type { interviewProgress } from "@/components/participant/progress";
import { SpeechBubble } from "@/components/participant/speech-bubble";
import type { SpeechTimeline } from "@/components/participant/speech-timeline";
import "./session.css";

export type Message = { id: number; role: "user" | "agent"; text: string };
export type InterviewMode = "voice" | "text";

const QUICK_ANSWERS = ["Yes", "No", "Not sure"];

// Questions on these topics get Ollie's gentle face instead of the regular one.
const SENSITIVE = /pregnan|mental|depress|anxiet|suicid|self-harm|drug|alcohol|substance|\bhiv\b|sexual|abuse/i;
const RESTING_AFTER_MS = 45_000;
const IDLE_LEVELS: number[] = Array(11).fill(0);

export function Session({ mode, connected, ended, error, isSpeaking, isMuted, messages, progress, lastActivity, happyUntil, getInputVolume, getOutputVolume, onSend, onToggleMute, onEnd, onRetry, timeline }: {
  mode: InterviewMode; connected: boolean; ended: boolean; error: string; isSpeaking: boolean; isMuted: boolean;
  messages: Message[]; progress: ReturnType<typeof interviewProgress>; lastActivity: number; happyUntil: number;
  getInputVolume: () => number; getOutputVolume: () => number;
  onSend: (text: string) => void; onToggleMute: () => void; onEnd: () => void; onRetry: () => void;
  timeline?: SpeechTimeline | null;
}) {
  const [now, setNow] = useState(0);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [levels, setLevels] = useState<number[]>(IDLE_LEVELS);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [draft, setDraft] = useState("");
  const [tapped, setTapped] = useState<{ answer: string; question: string } | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const logRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const voice = mode === "voice";

  // Clock for timed expressions (happy flash, resting after silence).
  useEffect(() => {
    if (!connected) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [connected]);

  // Lip sync: the beak opens with Ollie's voice, measured against a decaying peak so it adapts to any volume.
  useEffect(() => {
    if (!connected || !isSpeaking || reducedMotion) return;
    let peak = 0;
    let open = false;
    const timer = setInterval(() => {
      const volume = getOutputVolume();
      peak = Math.max(volume, peak * 0.96);
      const next = open ? volume > peak * 0.25 : volume > peak * 0.45 && volume > 0.004;
      if (next !== open) { open = next; setMouthOpen(next); }
    }, 55);
    return () => { clearInterval(timer); setMouthOpen(false); };
  }, [connected, isSpeaking, reducedMotion, getOutputVolume]);

  // Sound-level bars follow Ollie's voice while speaking and the microphone while listening.
  useEffect(() => {
    if (!connected || !voice) return;
    let lastVoiceAt = 0;
    const timer = setInterval(() => {
      const input = isMuted || isSpeaking ? 0 : getInputVolume();
      if (input > 0.025) lastVoiceAt = Date.now();
      setUserSpeaking(!isMuted && !isSpeaking && Date.now() - lastVoiceAt < 350);
      if (reducedMotion) return;
      const volume = Math.min(1, (isSpeaking ? getOutputVolume() : input) * 2.5);
      setLevels((current) => current.map((_, index) => Math.max(0.12, volume * (0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 140 + index * 1.7))))));
    }, 90);
    return () => clearInterval(timer);
  }, [connected, voice, isSpeaking, isMuted, reducedMotion, getInputVolume, getOutputVolume]);

  // Keep the newest caption in view.
  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    // Jump on first paint, glide for each new line after that.
    log.scrollTo({ top: log.scrollHeight, behavior: reducedMotion || log.scrollTop === 0 ? "auto" : "smooth" });
  }, [messages.length, reducedMotion]);

  // iPhone keyboard: size the screen to the visible area (iOS keeps 100dvh under the keyboard) and go compact while it's open.
  useEffect(() => {
    const viewport = window.visualViewport;
    const section = sectionRef.current;
    if (!viewport || !section) return;
    const update = () => {
      section.style.setProperty("--iv-vh", `${viewport.height}px`);
      section.style.setProperty("--iv-top", `${viewport.offsetTop}px`);
      section.dataset.keyboard = String(viewport.height < window.innerHeight * 0.78);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => { viewport.removeEventListener("resize", update); viewport.removeEventListener("scroll", update); };
  }, []);

  // Stay pinned to the newest line when the captions box changes size (layout, rotation, keyboard).
  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const observer = new ResizeObserver(() => { log.scrollTop = log.scrollHeight; });
    observer.observe(log);
    return () => observer.disconnect();
  }, []);

  const lastAgent = [...messages].reverse().find((message) => message.role === "agent")?.text ?? "";
  const activelyListening = voice && connected && !ended && !error && !isMuted && !isSpeaking && userSpeaking;
  const waitingForOllie = !isSpeaking && !activelyListening && messages.at(-1)?.role === "user";
  const sensitive = SENSITIVE.test(lastAgent);
  const face: OllieFace = error ? "confused"
    : ended ? "celebrate"
    : !connected ? "thinking"
    : isSpeaking ? (reducedMotion || mouthOpen ? "talking" : sensitive ? "gentle" : "hello")
    : activelyListening ? "listening"
    : now < happyUntil ? "happy"
    : waitingForOllie ? "thinking"
    : now - lastActivity > RESTING_AFTER_MS ? "resting"
    : sensitive ? "gentle"
    : "listening";

  const yourTurn = voice && connected && !ended && !error && !isMuted && !isSpeaking && !waitingForOllie && Boolean(lastAgent);

  const status = error ? "Connection problem" : ended ? "Interview finished" : !connected ? "Connecting…"
    : !voice ? (waitingForOllie ? "Ollie is replying…" : "Type or tap your answer")
    : isSpeaking ? "Ollie is speaking" : waitingForOllie ? "Ollie is thinking…" : isMuted ? "Microphone muted" : yourTurn ? "Your turn to speak" : "Listening…";
  const bubble = error ? "Hmm, I couldn't connect. Let's try that again."
    : ended ? "Thank you! The research team will review your answers."
    : !connected ? "Connecting you to Ollie…"
    : lastAgent || "Hi! I'm getting ready to ask my first question.";

  const { answered, total, percent } = progress;
  const canAnswer = connected && !ended;
  const selected = tapped?.question === lastAgent ? tapped.answer : null;

  function send(text: string) {
    const value = text.trim();
    if (!value || !canAnswer) return;
    onSend(value);
    setDraft("");
  }

  return <section className="iv" ref={sectionRef} aria-label="Pre-screening interview">
    <div className="iv-topbar">
      <span className="iv-track" role="progressbar" aria-label="Answers saved" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered} aria-valuetext={`${answered} of ${total} answers saved`}>
        <span style={{ width: `${percent}%` }} />
      </span>
      <span className="iv-count">{answered} of {total}<span className="iv-wide"> answers saved</span></span>
    </div>

    <div className="iv-stage">
      <span className="iv-status" data-your-turn={yourTurn} role="status" aria-live="polite" aria-atomic="true">
        {yourTurn && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
        </svg>}
        {status}
      </span>
      <div className="iv-scene">
        <SpeechBubble text={bubble} speaking={isSpeaking || !voice} paced={connected && !ended && !error && Boolean(lastAgent)} reducedMotion={reducedMotion} timeline={timeline} />
        <Mascot face={face} speaking={connected && !ended && !error && isSpeaking} listening={activelyListening} reducedMotion={reducedMotion} />
      </div>
      {voice && !ended && <div className="iv-levels" aria-hidden>{(connected && !reducedMotion ? levels : IDLE_LEVELS).map((level, index) => <span key={index} style={{ height: `${Math.round(6 + level * 34)}px` }} />)}</div>}
    </div>

    <div className="iv-sheet">
      {ended ? <div className="iv-done">
        <h2>You&apos;re all done</h2>
        <p>This does not determine eligibility or enrollment. A member of the research team will follow up if a study may be relevant to you.</p>
      </div> : <div className="iv-answer">
        <p className="iv-label" id="quick-label">{voice ? "Say your answer, or tap one" : "Tap an answer or type your own"}</p>
        <div className="iv-quick" role="group" aria-labelledby="quick-label">
          {QUICK_ANSWERS.map((answer) => <button key={answer} className="btn btn-secondary" aria-pressed={selected === answer} disabled={!canAnswer}
            onClick={() => { setTapped({ answer, question: lastAgent }); send(answer); }}>{answer}</button>)}
        </div>
        {!voice && <form className="iv-compose" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
          <label className="iv-sr-only" htmlFor="typed-answer">Your answer</label>
          <input id="typed-answer" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type your answer" autoComplete="off" disabled={!canAnswer} />
          <button className="btn btn-primary" disabled={!canAnswer || !draft.trim()}>Send</button>
        </form>}
      </div>}

      <div className="iv-captions">
        <p className="iv-label">{voice ? "Captions" : "Conversation"}</p>
        <div className="iv-log" ref={logRef} aria-live="polite">
          {messages.length === 0 ? <p className="muted">{voice ? "What you and Ollie say will appear here." : "Your conversation will appear here."}</p>
            : messages.slice(-12).map((message) => <p key={`${message.role}-${message.id}`} className={`iv-line iv-${message.role}`}>
              <strong>{message.role === "agent" ? "Ollie" : "You"}</strong>{message.text}
            </p>)}
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {connected ? <div className="iv-actions">
        {voice && <button className="btn btn-secondary" onClick={onToggleMute} aria-pressed={isMuted}><span>{isMuted ? "Unmute" : "Mute"}<span className="iv-wide"> microphone</span></span></button>}
        <button className="btn btn-secondary" onClick={onEnd}>End interview</button>
      </div> : error ? <button className="btn btn-primary" onClick={onRetry}>Try again</button> : null}

      <p className="iv-disclosure">Ollie is an AI assistant, not a clinician. Demo only: please don&apos;t share real health details. In an emergency, call 911.</p>
    </div>
  </section>;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore((onChange) => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
}
