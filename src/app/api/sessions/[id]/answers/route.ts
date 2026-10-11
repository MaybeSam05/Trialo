import { NextResponse } from "next/server";
import { saveAnswer, type AnswerStore } from "@/lib/save-answer";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { field, value } = await request.json() as { field?: string; value?: string };
    if (!field || !value || field.length > 80 || value.length > 2000) return NextResponse.json({ error: "A valid field and value are required." }, { status: 400 });
    const supabase = getSupabase();
    const store: AnswerStore = {
      // "*" so this keeps working before screening_sessions.questions has been added.
      // A read error is a 500 (the client retries); only a missing row is an unknown session.
      readSession: async (sessionId) => { const { data, error } = await supabase.from("screening_sessions").select("*").eq("id", sessionId).maybeSingle(); if (error) throw error; return data; },
      readStudy: async (studyId) => { const { data, error } = await supabase.from("studies").select("*").eq("id", studyId).maybeSingle(); if (error) throw error; return data; },
      writeIfUnchanged: async (sessionId, expected, patch) => {
        const { data, error } = await supabase.from("screening_sessions").update(patch).eq("id", sessionId).eq("updated_at", expected).select("id");
        if (error) throw error;
        return Boolean(data?.length);
      },
    };
    const result = await saveAnswer(store, id, field, value);
    if (result === "unknown_session") return NextResponse.json({ error: "Unknown session." }, { status: 404 });
    // Still contended after several tries: tell the client to retry rather than pretending it saved.
    if (result === "busy") return NextResponse.json({ error: "The session was busy. Please retry." }, { status: 503 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save response." }, { status: 500 });
  }
}
