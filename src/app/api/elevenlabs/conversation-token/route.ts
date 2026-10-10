import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json() as { sessionId?: string };
    if (!sessionId) return NextResponse.json({ error: "Session is required." }, { status: 400 });
    const { data: session } = await getSupabase().from("screening_sessions").select("id").eq("id", sessionId).single();
    if (!session) return NextResponse.json({ error: "Unknown session." }, { status: 404 });
    const agentId = process.env.ELEVENLABS_AGENT_ID;
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!agentId || !apiKey) throw new Error("ElevenLabs is not configured.");

    const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`, { headers: { "xi-api-key": apiKey } });
    if (!response.ok) throw new Error("ElevenLabs could not create a conversation token.");
    const body = await response.json() as { token: string };
    return NextResponse.json({ token: body.token });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start voice interview." }, { status: 500 });
  }
}
