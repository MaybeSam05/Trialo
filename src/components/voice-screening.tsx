"use client";

import { ConversationProvider, useConversationClientTool, useConversationControls, useConversationInput, useConversationMode, useConversationStatus } from "@elevenlabs/react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Ollie, type OllieFace } from "@/components/ollie";
import { Intro } from "@/components/participant/intro";

type Message = { id: number; role: "user" | "agent"; text: string };

// Questions on these topics get Ollie's gentle face instead of the regular one.
const SENSITIVE = /pregnan|mental|depress|anxiet|suicid|self-harm|drug|alcohol|substance|\bhiv\b|sexual|abuse/i;
const RESTING_AFTER_MS = 45_000;
const HAPPY_FOR_MS = 1_600;
const IDLE_LEVELS: number[] = Array(11).fill(0);

export function VoiceScreening({ slug, studyName }: { slug: string; studyName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastActivity, setLastActivity] = useState(0);
  const onMessage = useCallback(({ message, role, event_id }: { message: string; role: "user" | "agent"; event_id: number }) => {
    setLastActivity(Date.now());
    setMessages((current) => [...current.filter((item) => item.id !== event_id || item.role !== role), { id: event_id, role, text: message }]);
  }, []);

  return <ConversationProvider onMessage={onMessage}>
    <VoiceScreeningControls slug={slug} studyName={studyName} messages={messages} resetMessages={() => { setMessages([]); setLastActivity(Date.now()); }} lastActivity={lastActivity} />
  </ConversationProvider>;
}

function VoiceScreeningControls({ slug, studyName, messages, resetMessages, lastActivity }: {
  slug: string; studyName: string; messages: Message[]; resetMessages: () => void; lastActivity: number;
}) {
  const { startSession, endSession, getInputVolume, getOutputVolume } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking } = useConversationMode();
  const { isMuted, setMuted } = useConversationInput();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const [wasConnected, setWasConnected] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [happyUntil, setHappyUntil] = useState(0);
  const [now, setNow] = useState(0);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [levels, setLevels] = useState<number[]>(IDLE_LEVELS);
  const reducedMotion = usePrefersReducedMotion();

  // Configure an ElevenLabs client tool named record_screening_answer with field and value parameters.
  useConversationClientTool("record_screening_answer", async (parameters) => {
    const field = typeof parameters.field === "string" ? parameters.field : "";
    const value = typeof parameters.value === "string" ? parameters.value : "";
    if (!field || !value) return "A field name and confirmed answer are required.";
    if (!sessionId) return "Screening session is not ready.";
    const response = await fetch(`/api/sessions/${sessionId}/answers`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ field, value }),
    });
    if (response.ok) { setSavedCount((count) => count + 1); setHappyUntil(Date.now() + HAPPY_FOR_MS); }
    return response.ok ? "Answer saved." : "Answer could not be saved; continue the interview.";
  });

  async function start() {
    try {
      setError(""); setStarted(true); setWasConnected(false); setSavedCount(0); resetMessages();
      const sessionResponse = await fetch(`/api/public/${slug}/sessions`, { method: "POST" });
      const sessionBody = await sessionResponse.json() as { sessionId?: string; error?: string };
      if (!sessionResponse.ok || !sessionBody.sessionId) throw new Error(sessionBody.error ?? "Could not start screening.");
      setSessionId(sessionBody.sessionId);

      const tokenResponse = await fetch("/api/elevenlabs/conversation-token", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: sessionBody.sessionId }),
      });
      const tokenBody = await tokenResponse.json() as { token?: string; error?: string };
      if (!tokenResponse.ok || !tokenBody.token) throw new Error(tokenBody.error ?? "Could not connect to Ollie.");

      const conversationId = await startSession({ conversationToken: tokenBody.token, userId: sessionBody.sessionId });
      await fetch(`/api/sessions/${sessionBody.sessionId}/conversation`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId }),
      });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start voice interview.");
    }
  }

  const connected = status === "connected";
  if (connected && !wasConnected) setWasConnected(true);
  const ended = wasConnected && status === "disconnected" && !error;

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
    : status === "connecting" || (started && !connected) ? "thinking"
    : !connected ? "hello"
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

  if (!started) return <Intro studyName={studyName} onStart={start} />;

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
        <button className="btn btn-secondary" onClick={() => setMuted(!isMuted)} aria-pressed={isMuted}>{isMuted ? "Unmute microphone" : "Mute microphone"}</button>
        <button className="btn btn-primary" onClick={() => endSession()}>End interview</button>
      </div> : error ? <button className="btn btn-primary" onClick={start}>Try again</button> : null}
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
