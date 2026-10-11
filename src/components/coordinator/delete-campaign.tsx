"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** Delete button for a campaign, with a confirmation popup. Deleting also removes the campaign's sessions. */
export function DeleteCampaign({ slug, name, sessionCount }: { slug: string; name: string; sessionCount: number }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    dialog.current?.showModal();
  }

  function close() {
    if (!busy) dialog.current?.close();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/studies/${encodeURIComponent(slug)}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not delete the campaign.");
      dialog.current?.close();
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not delete the campaign.");
    } finally {
      setBusy(false);
    }
  }

  const sessions = sessionCount === 1 ? "its 1 session" : `its ${sessionCount} sessions`;
  return <>
    <button type="button" className="btn btn-danger" onClick={open}>Delete</button>
    <dialog ref={dialog} className="qr-dialog confirm-dialog" aria-labelledby={`delete-${slug}`} aria-describedby={`delete-${slug}-detail`}
      onClick={(event) => { if (event.target === dialog.current) close(); }}
      onCancel={(event) => { if (busy) event.preventDefault(); }}>
      <h2 id={`delete-${slug}`}>Delete this campaign?</h2>
      <p id={`delete-${slug}-detail`} className="muted">
        <strong>{name}</strong> and {sessionCount ? sessions : "its settings"} will be permanently deleted, and its participant link will stop working. This can&apos;t be undone.
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button type="button" className="btn btn-secondary" onClick={close} disabled={busy} autoFocus>Cancel</button>
        <button type="button" className="btn btn-danger-solid" onClick={remove} disabled={busy}>{busy ? "Deleting…" : "Delete campaign"}</button>
      </div>
    </dialog>
  </>;
}
