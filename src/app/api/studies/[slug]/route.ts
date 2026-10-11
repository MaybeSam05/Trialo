import { NextResponse } from "next/server";
import { validateQuestions } from "@/lib/questions";
import { ownerOrNull } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const owner = await ownerOrNull();
    if (!owner) return NextResponse.json({ error: "Sign in to edit campaigns." }, { status: 401 });
    const { slug } = await params;
    const { questions } = await request.json() as { questions?: unknown };
    const checked = validateQuestions(questions);
    if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
    const { data, error } = await getSupabase().from("studies").update({ questions: checked.questions }).eq("slug", slug).eq("owner_id", owner).select("slug").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Unknown campaign." }, { status: 404 });
    return NextResponse.json({ questions: checked.questions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save questions." }, { status: 500 });
  }
}

/** Deletes a campaign and, through the foreign key's cascade, all of its sessions. Only the owner can. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const owner = await ownerOrNull();
    if (!owner) return NextResponse.json({ error: "Sign in to delete campaigns." }, { status: 401 });
    const { slug } = await params;
    // The sample campaigns live in the shared demo account; npm run seed:demo owns them.
    if (slug.startsWith("demo-")) return NextResponse.json({ error: "Sample campaigns can't be deleted." }, { status: 403 });
    const { data, error } = await getSupabase().from("studies").delete().eq("slug", slug).eq("owner_id", owner).select("slug").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Unknown campaign." }, { status: 404 });
    return NextResponse.json({ deleted: slug });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete the campaign." }, { status: 500 });
  }
}
