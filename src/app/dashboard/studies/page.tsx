import Link from "next/link";
import { Ollie } from "@/components/ollie";
import { coordinatorLinks, SiteHeader } from "@/components/site-header";
import { getSupabase } from "@/lib/supabase";
import "@/components/coordinator/questions.css";

export const dynamic = "force-dynamic";

export default async function Campaigns() {
  let studies: { slug: string; name: string; created_at: string }[] = [];
  let error = "";
  try {
    const result = await getSupabase().from("studies").select("slug,name,created_at").order("created_at", { ascending: false }).limit(50);
    if (result.error) throw result.error;
    studies = result.data ?? [];
  } catch { error = "We couldn't load your campaigns."; }

  return <>
    <SiteHeader subtitle="Coordinator" links={coordinatorLinks} />
    <main id="main" className="page">
      <div className="page-head">
        <Ollie face={error ? "confused" : "hello"} size={64} />
        <div className="titles">
          <h1>Campaigns</h1>
          <p className="muted">Each campaign has its own link and its own screening questions.</p>
        </div>
        <Link className="btn btn-primary" href="/">New campaign</Link>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : studies.length === 0 ? <section className="card stack"><h2>No campaigns yet</h2><p className="muted">Create one to get a participant link.</p></section>
        : <ul className="study-list">{studies.map((study) => <li key={study.slug} className="card">
          <span><strong>{study.name}</strong><br /><span className="muted">Created {new Date(study.created_at).toLocaleDateString("en-US", { timeZone: "UTC" })}</span></span>
          <span className="actions">
            <Link className="btn btn-secondary" href={`/s/${study.slug}`}>Open participant link</Link>
            <Link className="btn btn-primary" href={`/dashboard/studies/${study.slug}`}>Edit questions</Link>
          </span>
        </li>)}</ul>}
    </main>
  </>;
}
