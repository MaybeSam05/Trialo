import { NextResponse } from "next/server";
import { matchTrials } from "@/lib/matching";
import { matchQuestions, sessionQuestions } from "@/lib/questions";
import { getSupabase } from "@/lib/supabase";
import type { Trial } from "@/lib/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { field, value } = await request.json() as { field?: string; value?: string };
    if (!field || !value || field.length > 80 || value.length > 2000) return NextResponse.json({ error: "A valid field and value are required." }, { status: 400 });
    const supabase = getSupabase();
    // "*" so this keeps working before screening_sessions.questions has been added.
    const { data: session, error: sessionError } = await supabase.from("screening_sessions").select("*").eq("id", id).single();
    if (sessionError || !session) return NextResponse.json({ error: "Unknown session." }, { status: 404 });
    const answers = { ...(session.answers ?? {}), [field]: value };
    const { data: study, error: studyError } = await supabase.from("studies").select("*").eq("id", session.study_id).single();
    if (studyError || !study) throw studyError ?? new Error("Study not found.");
    // Score against the questions this session was asked, not the campaign's latest edit.
    const { questions } = sessionQuestions(session.questions, study.questions);
    const { error } = await supabase.from("screening_sessions").update({ answers, updated_at: new Date().toISOString(), match_results: questions ? matchQuestions(answers, questions) : matchTrials(answers, study.trials as Trial[]), status: "needs_review" }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save response." }, { status: 500 });
  }
}
