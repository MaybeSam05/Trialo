"use client";

import { useState } from "react";
import Image from "next/image";

type CreatedStudy = { link: string; qrCode: string; slug: string };

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

  return <main>
    <p className="muted">TRIALO / COORDINATOR</p>
    <h1>Create a participant screening link</h1>
    <p className="muted">The link opens a browser-based voice pre-screening session. Use synthetic data only for the hackathon.</p>
    <section className="card">
      <form className="form" onSubmit={createStudy}>
        <label htmlFor="study-name">Screening campaign name</label>
        <input id="study-name" value={name} onChange={(event) => setName(event.target.value)} required />
        <button disabled={loading}>{loading ? "Creating..." : "Create link and QR code"}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
    {created && <section className="card split">
      <div>
        <h2>Participant link is ready</h2>
        <p><a href={created.link}>{created.link}</a></p>
        <p className="muted">Share this link or scan the QR code. Each participant receives a new screening session.</p>
        <p><a href="/dashboard">Open coordinator dashboard</a></p>
      </div>
      <Image className="qr" src={created.qrCode} alt={`QR code for ${created.slug}`} width={220} height={220} unoptimized />
    </section>}
  </main>;
}
