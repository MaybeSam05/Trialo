import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// Configure this URL as Ollie's post-call webhook. Production should additionally verify ElevenLabs' webhook signature.
export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const data = (payload.data ?? payload) as Record<string, unknown>;
    const conversationId = String(data.conversation_id ?? "");
    if (!conversationId) return NextResponse.json({ error: "Missing conversation ID." }, { status: 400 });
    const transcript = data.transcript ?? data.transcript_summary ?? null;
    const { error } = await getSupabase().from("screening_sessions").update({ status: "completed", transcript, updated_at: new Date().toISOString() }).eq("elevenlabs_conversation_id", conversationId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook processing failed." }, { status: 500 });
  }
}
