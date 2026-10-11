import { NextResponse } from "next/server";
import { postCallUpdate } from "@/lib/post-call";
import { getSupabase } from "@/lib/supabase";

// Configure this URL as Ollie's post-call webhook. Production should additionally verify ElevenLabs' webhook signature.
// It only saves the transcript: whether the screening finished comes from the answers (see answerProgress).
export async function POST(request: Request) {
  try {
    const update = postCallUpdate(await request.json() as Record<string, unknown>);
    if (update && "error" in update) return NextResponse.json({ error: update.error }, { status: 400 });
    if (!update) return NextResponse.json({ ok: true, stored: false });
    const { error } = await getSupabase().from("screening_sessions").update({ transcript: update.transcript }).eq("elevenlabs_conversation_id", update.conversationId);
    if (error) throw error;
    return NextResponse.json({ ok: true, stored: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook processing failed." }, { status: 500 });
  }
}
