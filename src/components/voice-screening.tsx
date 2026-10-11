"use client";

import { ConversationProvider, useConversationClientTool, useConversationControls, useConversationInput, useConversationMode, useConversationStatus } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { agentQuestionList, NAME_FIELD, type Question } from "@/lib/questions";
import { Intro } from "@/components/participant/intro";
import { endReasonFor, interviewEnding, interviewKeys, interviewProgress, matchQuestionKey, normalizeField } from "@/components/participant/progress";
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

  // Why the call ended ("user", "agent" or "error"). A connection error is shown to the participant instead of the closing screen.
  const [dropped, setDropped] = useState("");
  const [disconnectReason, setDisconnectReason] = useState<string | null>(null);
  const onDisconnect = useCallback((details: { reason: string; message?: string; closeCode?: number; closeReason?: string; context?: unknown }) => {
    console.info("[Trialo] conversation ended", details);
    setDisconnectReason(details.reason);
    if (details.reason === "error") setDropped(details.message || details.closeReason || "The connection to Ollie dropped.");
  }, []);
  const onError = useCallback((message: string, context?: unknown) => console.warn("[Trialo] conversation error", message, context), []);

  return <ConversationProvider onMessage={onMessage} onAudioAlignment={onAudioAlignment} onInterruption={onInterruption} onDisconnect={onDisconnect} onError={onError}>
    <VoiceScreeningControls slug={slug} studyName={studyName} questions={questions} messages={messages} resetMessages={() => { setMessages([]); setLastActivity(Date.now()); timeline.reset(); setDropped(""); setDisconnectReason(null); }}
      addOwnAnswer={addOwnAnswer} lastActivity={lastActivity} timeline={timeline} dropped={dropped} disconnectReason={disconnectReason} />
  </ConversationProvider>;
}

function VoiceScreeningControls({ slug, studyName, questions: campaignQuestions, messages, resetMessages, addOwnAnswer, lastActivity, timeline, dropped, disconnectReason }: {
  slug: string; studyName: string; questions: Question[] | null; messages: Message[]; resetMessages: () => void; addOwnAnswer: (text: string) => void; lastActivity: number; timeline: SpeechTimeline; dropped: string; disconnectReason: string | null;
}) {
  const { startSession, endSession, sendUserMessage, getInputVolume, getOutputVolume } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking } = useConversationMode();
  const { isMuted, setMuted } = useConversationInput();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startError, setError] = useState("");
  const error = startError || dropped;
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<InterviewMode>("voice");
  const [wasConnected, setWasConnected] = useState(false);
  // Saved values by question key: they drive the question counter, and the total shrinks or grows as answers rule questions in or out.
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string>>({});
  const [happyUntil, setHappyUntil] = useState(0);
  // The questions this session was started with. The campaign may have been edited since the page loaded.
  const [questions, setQuestions] = useState(campaignQuestions);
  // Pressing "End interview" is the participant stopping, not finishing.
  const [participantEnded, setParticipantEnded] = useState(false);

  // Configure an ElevenLabs client tool named record_screening_answer with field and value parameters.
  useConversationClientTool("record_screening_answer", async (parameters) => {
    const raw = typeof parameters.field === "string" ? parameters.field : "";
    const value = typeof parameters.value === "string" ? parameters.value : "";
    if (!raw || !value) return "A field name and confirmed answer are required.";
    if (!sessionId) return "Screening session is not ready.";
    // Save under the question's own key when Ollie words the field differently, so scoring and the counter both see it.
    const key = questions ? matchQuestionKey(raw, interviewKeys(questions)) : normalizeField(raw);
    const field = questions && key ? key : raw;
    const response = await fetch(`/api/sessions/${sessionId}/answers`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ field, value }),
    }).catch(() => null);
    if (!response) return "Answer could not be saved because the connection failed; continue the interview.";
    if (response.ok) { if (key) setSavedAnswers((saved) => ({ ...saved, [key]: value })); setHappyUntil(Date.now() + HAPPY_FOR_MS); }
    return response.ok ? "Answer saved." : "Answer could not be saved; continue the interview.";
  });

  const [name, setName] = useState("");

  async function start(nextMode: InterviewMode, typedName = name) {
    try {
      setName(typedName); setError(""); setStarted(true); setMode(nextMode); setWasConnected(false); setSavedAnswers({}); setParticipantEnded(false); resetMessages();
      const sessionResponse = await fetch(`/api/public/${slug}/sessions`, { method: "POST" });
      const sessionBody = await sessionResponse.json() as { sessionId?: string; questions?: Question[] | null; error?: string };
      if (!sessionResponse.ok || !sessionBody.sessionId) throw new Error(sessionBody.error ?? "Could not start screening.");
      const asked = sessionBody.questions !== undefined ? sessionBody.questions : campaignQuestions;
      setSessionId(sessionBody.sessionId);
      setQuestions(asked);
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
        dynamicVariables: { study_name: studyName, participant_name: typedName, study_questions: asked ? agentQuestionList(asked, typedName) : "" } });
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
  const ending = interviewEnding(savedAnswers, questions, participantEnded, disconnectReason);

  // Record how the call ended, once per session, so coordinators can tell stopping early from a dropped call.
  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (!sessionId || !disconnectReason || !wasConnected || reported.current === sessionId) return;
    reported.current = sessionId;
    fetch(`/api/sessions/${sessionId}/end`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: endReasonFor(disconnectReason, participantEnded) }),
    }).catch(() => {});
  }, [sessionId, disconnectReason, wasConnected, participantEnded]);

  function send(text: string) {
    sendUserMessage(text);
    addOwnAnswer(text);
  }

  if (!started) return <Intro studyName={studyName} onStart={(typed) => start("voice", typed)} onType={(typed) => start("text", typed)} />;

  return <Session mode={mode} connected={connected} ended={ended} ending={ending} error={error} isSpeaking={isSpeaking} isMuted={isMuted}
    messages={messages} progress={interviewProgress(savedAnswers, questions)} lastActivity={lastActivity} happyUntil={happyUntil}
    getInputVolume={getInputVolume} getOutputVolume={getOutputVolume} onSend={send} timeline={mode === "voice" ? timeline : null}
    onToggleMute={() => setMuted(!isMuted)} onEnd={() => { setParticipantEnded(true); endSession(); }} onRetry={() => start(mode)} />;
}
