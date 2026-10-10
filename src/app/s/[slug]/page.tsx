import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { VoiceScreening } from "@/components/voice-screening";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function ScreeningPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let study: { name: string } | null = null;
  try {
    const result = await getSupabase().from("studies").select("name").eq("slug", slug).single();
    study = result.data;
  } catch { notFound(); }
  if (!study) notFound();

  return <>
    <SiteHeader subtitle="Clinical trial pre-screening" />
    <main id="main">
      <VoiceScreening slug={slug} studyName={study.name} />
      <p className="page muted">If you have an emergency or urgent medical concern, call emergency services or seek urgent medical care.</p>
    </main>
  </>;
}
