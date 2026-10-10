"use client";

import { ConversationProvider, useConversationClientTool, useConversationControls, useConversationInput, useConversationMode, useConversationStatus } from "@elevenlabs/react";
import { useCallback, useState } from "react";
import { agentQuestionList, applicableCount, NAME_FIELD, type Question } from "@/lib/questions";
import { Intro } from "@/components/participant/intro";
import { addAnsweredField, interviewProgress } from "@/components/participant/progress";
import { Session, type InterviewMode, type Message } from "@/components/participant/session";
import { SpeechTimeline, stripExpressions, type Alignment } from "@/components/participant/speech-timeline";

const HAPPY_FOR_MS = 1_600;

export function VoiceScreening({ slug, studyName, questions }: { slug: string; studyName: string; questions: Question[] | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastActivity, setLastActivity] = useState(0);
  const onMessage = useCallback(({ message: raw, role, event_id }: { message: string; role: "user" | "agent"; event_id: number }) => {
    // Ollie's replies can carry expression tags ("[warmly]") for the voice; never show them.
    const message = role === "agent" ? stripExpressions(raw) : raw;
    if (!message) return;
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

  // Ollie's speech clock, fed by ElevenLabs' per-character audio alignment; captions follow it exactly.
  const [timeline] = useState(() => new SpeechTimeline());
  const onAudioAlignment = useCallback((alignment: Alignment) => timeline.add(alignment, performance.now()), [timeline]);
  const onInterruption = useCallback(() => timeline.interrupt(performance.now()), [timeline]);

  return <ConversationProvider onMessage={onMessage} onAudioAlignment={onAudioAlignment} onInterruption={onInterruption}>
    <VoiceScreeningControls slug={slug} studyName={studyName} questions={questions} messages={messages} resetMessages={() => { setMessages([]); setLastActivity(Date.now()); timeline.reset(); }}
      addOwnAnswer={addOwnAnswer} lastActivity={lastActivity} timeline={timeline} />
  </ConversationProvider>;
}

function VoiceScreeningControls({ slug, studyName, questions, messages, resetMessages, addOwnAnswer, lastActivity, timeline }: {
  slug: string; studyName: string; questions: Question[] | null; messages: Message[]; resetMessages: () => void; addOwnAnswer: (text: string) => void; lastActivity: number; timeline: SpeechTimeline;
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
  const [answeredFields, setAnsweredFields] = useState<readonly string[]>([]);
  // Saved values, so the question total can shrink or grow as profile answers rule questions in or out.
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string>>({});
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
    if (response.ok) { setAnsweredFields((fields) => addAnsweredField(fields, field)); setSavedAnswers((saved) => ({ ...saved, [field]: value })); setHappyUntil(Date.now() + HAPPY_FOR_MS); }
    return response.ok ? "Answer saved." : "Answer could not be saved; continue the interview.";
  });

  const [name, setName] = useState("");

  async function start(nextMode: InterviewMode, typedName = name) {
    try {
      setName(typedName); setError(""); setStarted(true); setMode(nextMode); setWasConnected(false); setAnsweredFields([]); setSavedAnswers({}); resetMessages();
      const sessionResponse = await fetch(`/api/public/${slug}/sessions`, { method: "POST" });
      const sessionBody = await sessionResponse.json() as { sessionId?: string; error?: string };
      if (!sessionResponse.ok || !sessionBody.sessionId) throw new Error(sessionBody.error ?? "Could not start screening.");
      setSessionId(sessionBody.sessionId);
      // The name is typed, not spoken, so save it straight away rather than through Ollie.
      if (typedName) await fetch(`/api/sessions/${sessionBody.sessionId}/answers`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ field: NAME_FIELD, value: typedName }),
      });

      const tokenResponse = await fetch("/api/elevenlabs/conversation-token", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: sessionBody.sessionId }),
      });
      const tokenBody = await tokenResponse.json() as { token?: string; error?: string };
      if (!tokenResponse.ok || !tokenBody.token) throw new Error(tokenBody.error ?? "Could not connect to Ollie.");

      const conversationId = await startSession({ conversationToken: tokenBody.token, userId: sessionBody.sessionId, textOnly: nextMode === "text",
        // Ollie's prompt reads these with {{study_name}} / {{study_questions}} (see README).
        dynamicVariables: { study_name: studyName, participant_name: typedName, study_questions: questions ? agentQuestionList(questions, typedName) : "" } });
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

  if (!started) return <Intro studyName={studyName} onStart={(typed) => start("voice", typed)} onType={(typed) => start("text", typed)} />;

  return <Session mode={mode} connected={connected} ended={ended} error={error} isSpeaking={isSpeaking} isMuted={isMuted}
    messages={messages} progress={interviewProgress(answeredFields, questions ? applicableCount(questions, savedAnswers) : null)} lastActivity={lastActivity} happyUntil={happyUntil}
    getInputVolume={getInputVolume} getOutputVolume={getOutputVolume} onSend={send} timeline={mode === "voice" ? timeline : null}
    onToggleMute={() => setMuted(!isMuted)} onEnd={() => endSession()} onRetry={() => start(mode)} />;
}
