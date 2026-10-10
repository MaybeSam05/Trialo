import Image from "next/image";
import Link from "next/link";
import "./report.css";

export type CreatedStudy = { link: string; qrCode: string; slug: string };

export function LinkPanel({ created, onReset }: { created: CreatedStudy; onReset?: () => void }) {
  return <section className="card split link-panel">
    <div className="stack">
      <span className="chip chip-match">Link ready</span>
      <h2>Participant link is ready</h2>
      <p><a href={created.link}>{created.link}</a></p>
      <p className="muted">Share this link or scan the QR code. Each participant receives a new screening session.</p>
      <div className="actions">
        <Link className="btn btn-primary" href="/dashboard">Open coordinator dashboard</Link>
        {onReset && <button type="button" className="btn btn-secondary" onClick={onReset}>Set up another campaign</button>}
      </div>
    </div>
    <Image className="qr" src={created.qrCode} alt={`QR code for ${created.slug}`} width={220} height={220} unoptimized />
  </section>;
}
