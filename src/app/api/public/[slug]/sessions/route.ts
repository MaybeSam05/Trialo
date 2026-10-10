import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const supabase = getSupabase();
    const { data: study, error: studyError } = await supabase.from("studies").select("id").eq("slug", slug).single();
    if (studyError || !study) return NextResponse.json({ error: "This screening link is unavailable." }, { status: 404 });
    const { data, error } = await supabase.from("screening_sessions").insert({ study_id: study.id, status: "started" }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ sessionId: data.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start a session." }, { status: 500 });
  }
}
