import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { demoTrials } from "@/lib/defaults";
import { DEMO_QUESTIONS, validateQuestions } from "@/lib/questions";
import { ownerOrNull } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const owner = await ownerOrNull();
    if (!owner) return NextResponse.json({ error: "Sign in to create a campaign." }, { status: 401 });
    const { name, questions: rawQuestions } = await request.json() as { name?: string; questions?: unknown };
    if (!name?.trim()) return NextResponse.json({ error: "A campaign name is required." }, { status: 400 });

    const checked = rawQuestions === undefined ? { questions: DEMO_QUESTIONS } : validateQuestions(rawQuestions);
    if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

    const slug = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    const supabase = getSupabase();
    const { error } = await supabase.from("studies").insert({ slug, name: name.trim(), trials: demoTrials, questions: checked.questions, owner_id: owner });
    if (error) throw new Error(error.message.includes("owner_id") || error.message.includes("questions") ? "The database is missing columns. Re-run supabase/schema.sql in Supabase." : error.message);

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const link = `${origin}/s/${slug}`;
    return NextResponse.json({ slug, link, qrCode: await QRCode.toDataURL(link, { width: 500, margin: 1 }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create study." }, { status: 500 });
  }
}
