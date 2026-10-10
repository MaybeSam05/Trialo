import { NextResponse } from "next/server";
import { validateQuestions } from "@/lib/questions";
import { getSupabase } from "@/lib/supabase";

// The unguessable slug is the only access control in this demo; add coordinator auth before real use.
export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { questions } = await request.json() as { questions?: unknown };
    const checked = validateQuestions(questions);
    if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
    const { data, error } = await getSupabase().from("studies").update({ questions: checked.questions }).eq("slug", slug).select("slug").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Unknown campaign." }, { status: 404 });
    return NextResponse.json({ questions: checked.questions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save questions." }, { status: 500 });
  }
}
