import { useEffect } from "react";

const editable = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * Hold to talk: the microphone is live only while this is held, so background noise never reaches Ollie.
 * Works with a finger (phone), the mouse, or by holding Space anywhere on the page (desktop), or Enter on the button.
 * Letting go, dragging off-screen, switching tabs or losing focus all stop talking, so the mic can't get stuck on.
 * `onTalk` must be stable (e.g. a state setter).
 */
export function TalkButton({ talking, disabled, onTalk }: { talking: boolean; disabled: boolean; onTalk: (talking: boolean) => void }) {
  useEffect(() => {
    if (disabled) return;
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space" || editable(event.target)) return;
      event.preventDefault(); // no page scroll, and no "click" on whichever button has focus
      if (!event.repeat) onTalk(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== "Space" || editable(event.target)) return;
      event.preventDefault();
      onTalk(false);
    };
    const stop = () => onTalk(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
      onTalk(false);
    };
  }, [disabled, onTalk]);

  return <button type="button" className="iv-talk" disabled={disabled} aria-pressed={talking}
    aria-label={talking ? "Listening. Let go when you're done" : "Hold to talk"}
    onPointerDown={(event) => {
      if (event.button !== 0) return;
      event.preventDefault(); // no text selection, long-press menu or focus flash
      onTalk(true);
      // Keep receiving the release even if the finger slides off the button.
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* pointer already gone; pointerup still ends it */ }
      navigator.vibrate?.(10);
    }}
    onPointerUp={() => onTalk(false)} onPointerCancel={() => onTalk(false)} onLostPointerCapture={() => onTalk(false)}
    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (!event.repeat) onTalk(true); } }}
    onKeyUp={(event) => { if (event.key === "Enter") { event.preventDefault(); onTalk(false); } }}
    onContextMenu={(event) => event.preventDefault()}>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <rect x="9" y="2" width="6" height="12" rx="3" fill={talking ? "currentColor" : "none"} />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
    </svg>
    <span className="iv-talk-text">
      <span>{talking ? "Listening… let go when done" : "Hold to talk"}</span>
      <span className="iv-talk-hint" aria-hidden="true">{talking ? "Release to send" : "or hold the Space bar"}</span>
    </span>
  </button>;
}
