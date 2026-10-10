import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { demoTrials } from "@/lib/defaults";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { name } = await request.json() as { name?: string };
    if (!name?.trim()) return NextResponse.json({ error: "A campaign name is required." }, { status: 400 });

    const slug = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    const { error } = await getSupabase().from("studies").insert({ slug, name: name.trim(), trials: demoTrials });
    if (error) throw error;

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const link = `${origin}/s/${slug}`;
    return NextResponse.json({ slug, link, qrCode: await QRCode.toDataURL(link, { width: 500, margin: 1 }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create study." }, { status: 500 });
  }
}
