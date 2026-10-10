import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { VoiceScreening } from "@/components/voice-screening";
import type { Question } from "@/lib/questions";
import { getSupabase } from "@/lib/supabase";
import "@/components/participant/participant.css";

export const dynamic = "force-dynamic";

export default async function ScreeningPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let study: { name: string; questions?: Question[] | null } | null = null;
  try {
    const result = await getSupabase().from("studies").select("*").eq("slug", slug).single();
    study = result.data;
  } catch { notFound(); }
  if (!study) notFound();

  // One screen, no page scroll: header on top, the welcome or interview fills the rest.
  return <div className="participant-shell">
    <SiteHeader subtitle="Clinical trial pre-screening" />
    <main id="main" className="participant-main">
      <VoiceScreening slug={slug} studyName={study.name} questions={study.questions ?? null} />
    </main>
  </div>;
}
