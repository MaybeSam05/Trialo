import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// The session keeps its own copy of the campaign's questions, so editing the campaign later only affects new sessions.
// The interview page uses the returned questions too, even if it was opened before an edit.
export async function POST(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const supabase = getSupabase();
    const { data: study, error: studyError } = await supabase.from("studies").select("*").eq("slug", slug).single();
    if (studyError || !study) return NextResponse.json({ error: "This screening link is unavailable." }, { status: 404 });
    const questions = Array.isArray(study.questions) ? study.questions : null;
    let { data, error } = await supabase.from("screening_sessions").insert({ study_id: study.id, status: "started", questions }).select("id").single();
    // Database not migrated yet (screening_sessions.questions missing): start the session without a copy, as before.
    if (error && (error.code === "PGRST204" || error.code === "42703" || /questions/.test(error.message))) {
      console.warn("[Trialo] screening_sessions.questions is missing; run supabase/schema.sql. Starting without a question copy.");
      ({ data, error } = await supabase.from("screening_sessions").insert({ study_id: study.id, status: "started" }).select("id").single());
    }
    if (error || !data) throw error ?? new Error("Could not start a session.");
    return NextResponse.json({ sessionId: data.id, questions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start a session." }, { status: 500 });
  }
}
