import { Ollie } from "@/components/ollie";
import { coordinatorLinks, SiteHeader } from "@/components/site-header";
import { MatchChip, SessionChip } from "@/components/status-chip";
import { getSupabase } from "@/lib/supabase";
import type { MatchResult } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = { id: string; status: string; answers: Record<string, unknown>; match_results: MatchResult[]; created_at: string; studies: { name: string } | null };

export default async function Dashboard() {
  let rows: Row[] = [];
  let error = "";
  try {
    const result = await getSupabase().from("screening_sessions").select("id,status,answers,match_results,created_at,studies(name)").order("created_at", { ascending: false }).limit(100);
    if (result.error) throw result.error;
    rows = (result.data ?? []) as unknown as Row[];
  } catch (dashboardError) {
    error = dashboardError instanceof Error ? dashboardError.message : "Could not load screening sessions.";
  }

  const results = rows.flatMap((row) => row.match_results ?? []);
  const count = (status: MatchResult["status"]) => results.filter((result) => result.status === status).length;
  const tiles: { status?: MatchResult["status"]; value: number; note: string }[] = [
    { value: rows.length, note: "participant sessions" },
    { status: "potential_match", value: count("potential_match"), note: "trial results" },
    { status: "needs_information", value: count("needs_information"), note: "need a follow-up" },
    { status: "possible_exclusion", value: count("possible_exclusion"), note: "to double-check" },
  ];

  return <>
    <SiteHeader subtitle="Coordinator" links={coordinatorLinks} />
    <main id="main" className="page">
      <div className="page-head">
        <Ollie face={error ? "confused" : "hello"} size={64} />
        <div className="titles">
          <h1>Screening dashboard</h1>
          <p className="muted">All results require clinical research staff review. The application never determines final eligibility.</p>
        </div>
      </div>
      {error ? <section className="card stack"><p className="error" role="alert">{error}</p><p>Configure Supabase before using the dashboard.</p></section> : <>
        <section className="tiles" aria-label="Summary">
          {tiles.map((tile) => <div key={tile.note} className="card tile">
            {tile.status ? <MatchChip status={tile.status} /> : <span className="chip">All sessions</span>}
            <div className="value"><strong>{tile.value}</strong><span>{tile.note}</span></div>
          </div>)}
        </section>
        <section className="card table-card" aria-label="Participant sessions">
          {rows.length === 0 ? <div className="stack" style={{ padding: 32, justifyItems: "center", textAlign: "center" }}>
            <Ollie face="resting" size={140} />
            <h2>No participant sessions yet</h2>
            <p className="muted">Sessions appear here as soon as someone starts a screening link.</p>
          </div> : <div className="table-wrap"><table>
            <thead><tr><th>Campaign</th><th>Status</th><th>Started</th><th>Responses</th><th>Potential matches / follow-ups</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id}>
              <td><strong>{row.studies?.name ?? "Unknown study"}</strong></td>
              <td><SessionChip status={row.status} /></td>
              <td className="muted">{new Date(row.created_at).toLocaleString()}</td>
              <td>{Object.keys(row.answers ?? {}).length}</td>
              <td><div className="results">{(row.match_results ?? []).map((result) => <div key={result.trialId} className="result">
                <span><strong>{result.trialName}</strong> <MatchChip status={result.status} /></span>
                <span className="muted">{result.reason}</span>
              </div>)}</div></td>
            </tr>)}</tbody>
          </table></div>}
        </section>
      </>}
    </main>
  </>;
}
