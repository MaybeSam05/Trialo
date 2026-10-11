import { NextResponse } from "next/server";
import { isEndReason } from "@/components/dashboard/session-outcome";
import { getSupabase } from "@/lib/supabase";

// The interview page reports how the call ended (participant, agent or connection) so coordinators can tell
// someone stopping early from a dropped call. The first report wins; repeats don't overwrite it.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { reason } = await request.json() as { reason?: unknown };
    if (!isEndReason(reason)) return NextResponse.json({ error: "Unknown end reason." }, { status: 400 });
    const { error } = await getSupabase().from("screening_sessions").update({ end_reason: reason }).eq("id", id).is("end_reason", null);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Before screening_sessions.end_reason exists this fails; the interview carries on regardless.
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not record how the call ended." }, { status: 500 });
  }
}
