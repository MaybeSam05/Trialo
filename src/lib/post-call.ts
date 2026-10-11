/**
 * What Ollie's post-call webhook stores: the transcript, and nothing else. The call ending doesn't prove the screening
 * finished, so it never changes the session's status or last activity, and a repeated or late webhook changes nothing.
 * Returns null when there's nothing to store (no conversation ID, or a webhook type without a transcript).
 */
export function postCallUpdate(payload: Record<string, unknown>): { conversationId: string; transcript: unknown } | { error: string } | null {
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const conversationId = String(data.conversation_id ?? "");
  if (!conversationId) return { error: "Missing conversation ID." };
  const transcript = data.transcript ?? data.transcript_summary ?? null;
  return transcript ? { conversationId, transcript } : null;
}
