import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { conversationId } = await request.json() as { conversationId?: string };
    if (!conversationId) return NextResponse.json({ error: "Conversation ID is required." }, { status: 400 });
    const { error } = await getSupabase().from("screening_sessions").update({ elevenlabs_conversation_id: conversationId }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not associate conversation." }, { status: 500 });
  }
}
