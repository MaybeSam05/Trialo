import Link from "next/link";
import { Ollie } from "@/components/ollie";
import { CampaignShare } from "@/components/coordinator/campaign-share";
import { DeleteCampaign } from "@/components/coordinator/delete-campaign";
import { coordinatorLinks, SiteHeader } from "@/components/site-header";
import { requireOwner } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import "@/components/coordinator/questions.css";

export const dynamic = "force-dynamic";

type Study = { id: string; slug: string; name: string; created_at: string; questions?: unknown[] | null };
type Campaign = Study & { questionCount: number | null; sessionCount: number; lastSession: string | null };

const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const when = (iso: string) => {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 60) return minutes <= 1 ? "just now" : `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return day.format(new Date(iso));
};
/** Short, readable identifier: demo slugs as-is, random slugs shortened. */
const shortId = (slug: string) => slug.startsWith("demo-") ? slug.replace(/^demo-/, "") : slug.slice(0, 6);

async function loadCampaigns(owner: string): Promise<{ campaigns: Campaign[]; error: boolean }> {
  try {
    const supabase = getSupabase();
    // Only this account's campaigns, and only sessions belonging to them.
    const studies = await supabase.from("studies").select("*").eq("owner_id", owner).order("created_at", { ascending: false }).limit(50);
    if (studies.error) throw studies.error;
    const ids = (studies.data as Study[]).map((study) => study.id);
    const sessions = ids.length ? await supabase.from("screening_sessions").select("study_id,updated_at,created_at").in("study_id", ids).order("created_at", { ascending: false }).limit(2000) : { data: [], error: null };
    if (sessions.error) throw sessions.error;
    const stats = new Map<string, { count: number; last: string }>();
    for (const row of sessions.data ?? []) {
      const activity = row.updated_at ?? row.created_at;
      const current = stats.get(row.study_id);
      stats.set(row.study_id, { count: (current?.count ?? 0) + 1, last: current && current.last > activity ? current.last : activity });
    }
    return {
      campaigns: (studies.data as Study[]).map((study) => ({
        ...study,
        questionCount: Array.isArray(study.questions) ? study.questions.length : null,
        sessionCount: stats.get(study.id)?.count ?? 0,
        lastSession: stats.get(study.id)?.last ?? null,
      })),
      error: false,
    };
  } catch {
    return { campaigns: [], error: true };
  }
}

export default async function Campaigns() {
  const { campaigns, error } = await loadCampaigns(await requireOwner());

  return <>
    <SiteHeader subtitle="Coordinator" links={coordinatorLinks} />
    <main id="main" className="page">
      <div className="page-head">
        <Ollie face={error ? "confused" : "hello"} size={64} />
        <div className="titles">
          <h1>Campaigns</h1>
          <p className="muted">Each campaign has its own participant link and screening questions.</p>
        </div>
        <Link className="btn btn-primary" href="/">Create campaign</Link>
      </div>
      {error ? <p className="error" role="alert">We couldn&apos;t load your campaigns. Check the Supabase connection and try again.</p>
        : campaigns.length === 0 ? <section className="card stack"><h2>No campaigns yet</h2><p className="muted">Create one to get a participant link.</p></section>
        : <ul className="study-list">{campaigns.map((campaign) => <li key={campaign.slug} className="card study-card">
          <div className="study-info">
            <h2>{campaign.name}</h2>
            <dl className="study-meta">
              <div><dt>ID</dt><dd><code>{shortId(campaign.slug)}</code></dd></div>
              <div><dt>Questions</dt><dd>{campaign.questionCount === null ? "Legacy set" : `${campaign.questionCount} + age, gender`}</dd></div>
              <div><dt>Sessions</dt><dd>{campaign.sessionCount}</dd></div>
              <div><dt>Created</dt><dd>{day.format(new Date(campaign.created_at))}</dd></div>
              <div><dt>Last session</dt><dd>{campaign.lastSession ? when(campaign.lastSession) : "None yet"}</dd></div>
            </dl>
          </div>
          <div className="study-actions">
            <CampaignShare slug={campaign.slug} name={campaign.name} />
            <Link className="btn btn-secondary" href={`/s/${campaign.slug}`} target="_blank">Preview</Link>
            <Link className="btn btn-primary" href={`/dashboard/studies/${campaign.slug}`}>Edit questions</Link>
            {!campaign.slug.startsWith("demo-") && <DeleteCampaign slug={campaign.slug} name={campaign.name} sessionCount={campaign.sessionCount} />}
          </div>
        </li>)}</ul>}
    </main>
  </>;
}
