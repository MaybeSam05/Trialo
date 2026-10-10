"use client";

import { ConversationProvider, useConversationClientTool, useConversationControls, useConversationStatus } from "@elevenlabs/react";
import { useState } from "react";

export function VoiceScreening({ slug }: { slug: string }) {
  return <ConversationProvider><VoiceScreeningControls slug={slug} /></ConversationProvider>;
}

function VoiceScreeningControls({ slug }: { slug: string }) {
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Configure an ElevenLabs client tool named record_screening_answer with field and value parameters.
  useConversationClientTool("record_screening_answer", async (parameters) => {
    const field = typeof parameters.field === "string" ? parameters.field : "";
    const value = typeof parameters.value === "string" ? parameters.value : "";
    if (!field || !value) return "A field name and confirmed answer are required.";
    if (!sessionId) return "Screening session is not ready.";
    const response = await fetch(`/api/sessions/${sessionId}/answers`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ field, value }),
    });
    return response.ok ? "Answer saved." : "Answer could not be saved; continue the interview.";
  });

  async function start() {
    try {
      setError("");
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

  return <section className="card">
    <h2>Voice pre-screening</h2>
    <p className="muted">When you start, your browser will ask to use your microphone.</p>
    <p aria-live="polite"><span className="status">{status === "connected" ? "Ollie is connected" : status === "connecting" ? "Connecting to Ollie" : "Ready"}</span></p>
    {status === "connected" ? <button onClick={() => endSession()}>End interview</button> : <button onClick={start}>Start voice interview</button>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
