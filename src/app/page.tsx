"use client";

import { useState } from "react";
import { Ollie } from "@/components/ollie";
import { LinkPanel, type CreatedStudy } from "@/components/coordinator/link-panel";
import { coordinatorLinks, SiteHeader } from "@/components/site-header";

export default function Home() {
  const [name, setName] = useState("Trialo multi-trial screening");
  const [created, setCreated] = useState<CreatedStudy | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function createStudy(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    const response = await fetch("/api/studies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) { setError(body.error ?? "Could not create the screening link."); return; }
    setCreated(body);
  }

  return <>
    <SiteHeader subtitle="Coordinator" links={coordinatorLinks} />
    <main id="main" className="page">
      <div className="page-head">
        <Ollie face={error ? "confused" : created ? "celebrate" : loading ? "thinking" : "hello"} size={96} priority />
        <div className="titles">
          <h1>Create a participant screening link</h1>
          <p className="muted">The link opens a browser-based voice pre-screening session. Use synthetic data only for the hackathon.</p>
        </div>
      </div>
      <section className="card stack">
        <form className="form" onSubmit={createStudy}>
          <label htmlFor="study-name">Screening campaign name</label>
          <input id="study-name" value={name} onChange={(event) => setName(event.target.value)} required />
          <div className="actions"><button className="btn btn-primary" disabled={loading}>{loading ? "Creating..." : "Create link and QR code"}</button></div>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
      </section>
      {created && <LinkPanel created={created} />}
    </main>
  </>;
}
