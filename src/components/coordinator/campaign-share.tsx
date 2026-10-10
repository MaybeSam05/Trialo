"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/** Copy link and View QR code for a campaign. The link is built from the current site so it works on any deploy. */
export function CampaignShare({ slug, name }: { slug: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const link = () => `${window.location.origin}/s/${slug}`;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try { await navigator.clipboard.writeText(link()); setCopied(true); }
    catch { window.prompt("Copy this participant link:", link()); }
  }

  async function showQr() {
    const QRCode = await import("qrcode");
    setQr(await QRCode.toDataURL(link(), { width: 480, margin: 1 }));
    dialog.current?.showModal();
  }

  return <>
    <button type="button" className="btn btn-secondary" onClick={copy} aria-live="polite">{copied ? "Link copied" : "Copy link"}</button>
    <button type="button" className="btn btn-secondary" onClick={showQr}>View QR code</button>
    <dialog ref={dialog} className="qr-dialog" aria-labelledby={`qr-${slug}`} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <h2 id={`qr-${slug}`}>{name}</h2>
      <p className="muted">Participants scan this to start their own interview.</p>
      {qr && <Image src={qr} alt={`QR code for ${name}`} width={240} height={240} unoptimized />}
      <div className="actions">
        {qr && <a className="btn btn-secondary" href={qr} download={`${slug}-qr.png`}>Download PNG</a>}
        <button type="button" className="btn btn-primary" onClick={() => dialog.current?.close()}>Done</button>
      </div>
    </dialog>
  </>;
}
