"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import "./live-updates.css";

/**
 * Keeps the server-rendered dashboard fresh: re-fetches it every few seconds while the tab is visible,
 * and straight away when the coordinator comes back to the tab. Scroll position and focus are kept.
 */
export function LiveUpdates({ intervalMs = 5_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [paused, setPaused] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (paused) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      startTransition(() => router.refresh());
      setLastRefresh(Date.now());
    };
    const timer = setInterval(refresh, intervalMs);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [paused, intervalMs, router]);

  // Ticks the "updated … ago" label.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const seconds = Math.max(0, Math.round((now - lastRefresh) / 1_000));
  // The label stays steady during refreshes; only the dot reacts, so the header doesn't flicker every few seconds.
  const label = paused ? "Live updates paused" : seconds < 3 ? "Live · updated just now" : `Live · updated ${seconds}s ago`;

  return <div className="live-updates" data-paused={paused} data-pending={isPending}>
    <span className="live-dot" aria-hidden />
    <span className="live-label">{label}</span>
    <button type="button" className="live-toggle" onClick={() => setPaused((value) => !value)} aria-pressed={paused}>
      {paused ? "Resume" : "Pause"}<span className="live-sr-only"> live updates</span>
    </button>
  </div>;
}
