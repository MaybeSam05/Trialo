import Link from "next/link";
import { notFound } from "next/navigation";
import { EditQuestions } from "@/components/coordinator/edit-questions";
import { coordinatorLinks, SiteHeader } from "@/components/site-header";
import { DEMO_QUESTIONS, type Question } from "@/lib/questions";
import { getSupabase } from "@/lib/supabase";
import "@/components/coordinator/report.css";

export const dynamic = "force-dynamic";

export default async function EditStudy({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let study: { name: string; questions?: Question[] | null } | null = null;
  try {
    const result = await getSupabase().from("studies").select("*").eq("slug", slug).maybeSingle();
    study = result.data;
  } catch { notFound(); }
  if (!study) notFound();

  return <>
    <SiteHeader subtitle="Coordinator" links={coordinatorLinks} />
    <main id="main" className="page">
      <Link className="report-back" href="/dashboard/studies">&larr; All campaigns</Link>
      <div className="titles"><h1>{study.name}</h1><p className="muted">Changes apply to interviews that start after you save. Sessions already in progress keep the old questions.</p></div>
      <EditQuestions slug={slug} initial={study.questions ?? DEMO_QUESTIONS} />
    </main>
  </>;
}
