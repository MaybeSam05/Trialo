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

  return <main>
    <p className="muted">TRIALO / COORDINATOR</p>
    <h1>Screening dashboard</h1>
    <p className="muted">All results require clinical research staff review. The application never determines final eligibility.</p>
    {error ? <section className="card"><p className="error">{error}</p><p>Configure Supabase before using the dashboard.</p></section> :
      <section className="card">
        <h2>Participant sessions</h2>
        {rows.length === 0 ? <p className="muted">No participant sessions yet.</p> : <div style={{ overflowX: "auto" }}><table>
          <thead><tr><th>Campaign</th><th>Status</th><th>Started</th><th>Responses</th><th>Potential matches / follow-ups</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}>
            <td>{row.studies?.name ?? "Unknown study"}</td>
            <td><span className="status">{row.status.replaceAll("_", " ")}</span></td>
            <td>{new Date(row.created_at).toLocaleString()}</td>
            <td>{Object.keys(row.answers ?? {}).length}</td>
            <td>{(row.match_results ?? []).map((result) => <p key={result.trialId}><strong>{result.trialName}:</strong> {result.status.replaceAll("_", " ")}<br /><span className="muted">{result.reason}</span></p>)}</td>
          </tr>)}</tbody>
        </table></div>}
      </section>}
  </main>;
}
