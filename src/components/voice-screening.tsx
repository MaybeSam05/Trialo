"use client";

import { ConversationProvider, useConversationClientTool, useConversationControls, useConversationInput, useConversationMode, useConversationStatus } from "@elevenlabs/react";
import { useCallback, useState } from "react";
import { Intro } from "@/components/participant/intro";
import { Session, type InterviewMode, type Message } from "@/components/participant/session";

const HAPPY_FOR_MS = 1_600;

export function VoiceScreening({ slug, studyName }: { slug: string; studyName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastActivity, setLastActivity] = useState(0);
  const onMessage = useCallback(({ message, role, event_id }: { message: string; role: "user" | "agent"; event_id: number }) => {
    setLastActivity(Date.now());
    setMessages((current) => {
      const rest = current.filter((item) => item.id !== event_id || item.role !== role);
      // Replace our own echo of a typed or tapped answer if the agent transcribes it back.
      const last = rest.at(-1);
      if (role === "user" && last && last.id < 0 && last.text.toLowerCase() === message.trim().toLowerCase()) rest.pop();
      return [...rest, { id: event_id, role, text: message }];
    });
  }, []);
  // Typed and tapped answers are shown right away; negative ids mark them as local.
  const addOwnAnswer = useCallback((text: string) => {
    setLastActivity(Date.now());
    setMessages((current) => [...current, { id: -Date.now(), role: "user", text }]);
  }, []);

  return <ConversationProvider onMessage={onMessage}>
    <VoiceScreeningControls slug={slug} studyName={studyName} messages={messages} resetMessages={() => { setMessages([]); setLastActivity(Date.now()); }}
      addOwnAnswer={addOwnAnswer} lastActivity={lastActivity} />
  </ConversationProvider>;
}

function VoiceScreeningControls({ slug, studyName, messages, resetMessages, addOwnAnswer, lastActivity }: {
  slug: string; studyName: string; messages: Message[]; resetMessages: () => void; addOwnAnswer: (text: string) => void; lastActivity: number;
}) {
  const { startSession, endSession, sendUserMessage, getInputVolume, getOutputVolume } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking } = useConversationMode();
  const { isMuted, setMuted } = useConversationInput();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<InterviewMode>("voice");
  const [wasConnected, setWasConnected] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [happyUntil, setHappyUntil] = useState(0);

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

  async function start(nextMode: InterviewMode) {
    try {
      setError(""); setStarted(true); setMode(nextMode); setWasConnected(false); setSavedCount(0); resetMessages();
      const sessionResponse = await fetch(`/api/public/${slug}/sessions`, { method: "POST" });
      const sessionBody = await sessionResponse.json() as { sessionId?: string; error?: string };
      if (!sessionResponse.ok || !sessionBody.sessionId) throw new Error(sessionBody.error ?? "Could not start screening.");
      setSessionId(sessionBody.sessionId);

      const tokenResponse = await fetch("/api/elevenlabs/conversation-token", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: sessionBody.sessionId }),
      });
      const tokenBody = await tokenResponse.json() as { token?: string; error?: string };
      if (!tokenResponse.ok || !tokenBody.token) throw new Error(tokenBody.error ?? "Could not connect to Ollie.");

      const conversationId = await startSession({ conversationToken: tokenBody.token, userId: sessionBody.sessionId, textOnly: nextMode === "text" });
      await fetch(`/api/sessions/${sessionBody.sessionId}/conversation`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId }),
      });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start the interview.");
    }
  }

  const connected = status === "connected";
  if (connected && !wasConnected) setWasConnected(true);
  const ended = wasConnected && status === "disconnected" && !error;

  function send(text: string) {
    sendUserMessage(text);
    addOwnAnswer(text);
  }

  if (!started) return <Intro studyName={studyName} onStart={() => start("voice")} onType={() => start("text")} />;

  return <Session mode={mode} connected={connected} ended={ended} error={error} isSpeaking={isSpeaking} isMuted={isMuted}
    messages={messages} savedCount={savedCount} lastActivity={lastActivity} happyUntil={happyUntil}
    getInputVolume={getInputVolume} getOutputVolume={getOutputVolume} onSend={send}
    onToggleMute={() => setMuted(!isMuted)} onEnd={() => endSession()} onRetry={() => start(mode)} />;
}
