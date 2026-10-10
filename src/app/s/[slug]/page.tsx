import { notFound } from "next/navigation";
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

  return <main>
    <p className="muted">TRIALO</p>
    <h1>{study.name}</h1>
    <p>This brief interview helps the research team identify studies that may be relevant to you.</p>
    <section className="card">
      <h2>Before you begin</h2>
      <p>Your responses may be recorded or transcribed and reviewed by the research team. This is not medical advice and does not determine eligibility or enrollment. You may skip questions or stop at any time.</p>
    </section>
    <VoiceScreening slug={slug} />
    <p className="muted">If you have an emergency or urgent medical concern, call emergency services or seek urgent medical care.</p>
  </main>;
}
