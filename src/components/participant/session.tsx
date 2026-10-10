import { useEffect, useState, useSyncExternalStore } from "react";
import { Ollie, type OllieFace } from "@/components/ollie";

export type Message = { id: number; role: "user" | "agent"; text: string };

// Questions on these topics get Ollie's gentle face instead of the regular one.
const SENSITIVE = /pregnan|mental|depress|anxiet|suicid|self-harm|drug|alcohol|substance|\bhiv\b|sexual|abuse/i;
const RESTING_AFTER_MS = 45_000;
const IDLE_LEVELS: number[] = Array(11).fill(0);

export function Session({ connected, ended, error, isSpeaking, isMuted, messages, savedCount, lastActivity, happyUntil, getInputVolume, getOutputVolume, onToggleMute, onEnd, onRetry }: {
  connected: boolean; ended: boolean; error: string; isSpeaking: boolean; isMuted: boolean;
  messages: Message[]; savedCount: number; lastActivity: number; happyUntil: number;
  getInputVolume: () => number; getOutputVolume: () => number;
  onToggleMute: () => void; onEnd: () => void; onRetry: () => void;
}) {
  const [now, setNow] = useState(0);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [levels, setLevels] = useState<number[]>(IDLE_LEVELS);
  const reducedMotion = usePrefersReducedMotion();

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
    if (!connected || reducedMotion) return;
    const timer = setInterval(() => {
      const volume = Math.min(1, (isSpeaking ? getOutputVolume() : getInputVolume()) * 2.5);
      setLevels((current) => current.map((_, index) => Math.max(0.12, volume * (0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 140 + index * 1.7))))));
    }, 90);
    return () => clearInterval(timer);
  }, [connected, isSpeaking, reducedMotion, getInputVolume, getOutputVolume]);

  const lastAgent = [...messages].reverse().find((message) => message.role === "agent")?.text ?? "";
  const sensitive = SENSITIVE.test(lastAgent);
  const face: OllieFace = error ? "confused"
    : ended ? "celebrate"
    : !connected ? "thinking"
    : now < happyUntil ? "happy"
    : isSpeaking ? (reducedMotion || mouthOpen ? "talking" : sensitive ? "gentle" : "hello")
    : now - lastActivity > RESTING_AFTER_MS ? "resting"
    : sensitive ? "gentle"
    : "listening";

  const chip = error ? "Connection problem" : ended ? "Interview finished" : !connected ? "Connecting…" : isSpeaking ? "Ollie is speaking" : isMuted ? "Microphone muted" : "Listening…";
  const bubble = error ? "Hmm, I couldn't connect. Let's try that again."
    : ended ? "Thank you! The research team will review your answers."
    : !connected ? "Connecting you to Ollie…"
    : lastAgent || "Hi! I'm getting ready to ask my first question.";

  return <section className="page session" aria-label="Voice pre-screening">
    <div className="stage">
      <span className="live-chip" aria-live="polite">{chip}</span>
      <p className="bubble bubble-lg">{bubble}</p>
      <Ollie face={face} size={260} />
      <div className="levels" aria-hidden>{(connected && !reducedMotion ? levels : IDLE_LEVELS).map((level, index) => <span key={index} style={{ height: `${Math.round(8 + level * 40)}px` }} />)}</div>
    </div>
    <div className="card side">
      <div className="progress"><span>Answers saved</span><span className="chip">{savedCount}</span></div>
      <div className="panel transcript" aria-live="polite">
        <span className="who">Conversation</span>
        {messages.length === 0 ? <p className="muted">The conversation will appear here as you talk.</p>
          : messages.slice(-8).map((message) => <p key={`${message.role}-${message.id}`}><span className="who">{message.role === "agent" ? "Ollie" : "You"}</span><br />{message.text}</p>)}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {ended && <div className="stack"><h2>You&apos;re all done</h2><p className="muted">This does not determine eligibility or enrollment. A member of the research team will follow up if a study may be relevant to you.</p></div>}
      <div className="grow" />
      {connected ? <div className="row-actions">
        <button className="btn btn-secondary" onClick={onToggleMute} aria-pressed={isMuted}>{isMuted ? "Unmute microphone" : "Mute microphone"}</button>
        <button className="btn btn-primary" onClick={onEnd}>End interview</button>
      </div> : error ? <button className="btn btn-primary" onClick={onRetry}>Try again</button> : null}
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
