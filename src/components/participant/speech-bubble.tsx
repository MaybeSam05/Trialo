import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

const MS_PER_WORD = 340;       // roughly Ollie's speaking pace
const MIN_CHUNK_MS = 1_500;
const CATCH_UP_MS = 700;       // pace once the audio has finished
const FADE_MS = 170;

/** Split a reply into short caption chunks: whole sentences where they fit, otherwise word-wrapped pieces. */
export function chunkText(text: string, max: number): string[] {
  const sentences = (text.match(/[^.!?…]+[.!?…]+["')\]]*|[^.!?…]+$/g) ?? [text]).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  const flush = () => { if (current) chunks.push(current); current = ""; };
  for (const sentence of sentences) {
    if (sentence.length > max) {
      flush();
      // Even-sized pieces, breaking after a comma when one is close.
      const target = Math.ceil(sentence.length / Math.ceil(sentence.length / max));
      for (const word of sentence.split(/\s+/)) {
        if (current && `${current} ${word}`.length > Math.min(max, target + 12)) flush();
        current = current ? `${current} ${word}` : word;
        if (current.length >= target * 0.7 && /[,;:]$/.test(word)) flush();
      }
      flush();
    } else if (current && `${current} ${sentence}`.length > max) {
      flush();
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  flush();
  return chunks.length ? chunks : [text];
}

/**
 * Ollie's speech bubble. Long replies play as a sequence of short captions that fade into each other,
 * paced to Ollie's voice; the full text stays in the captions log.
 */
export function SpeechBubble({ text, speaking, paced, reducedMotion }: { text: string; speaking: boolean; paced: boolean; reducedMotion: boolean }) {
  const narrow = useNarrowScreen();
  const chunks = useMemo(() => chunkText(text, narrow ? 80 : 140), [text, narrow]);
  const last = chunks.length - 1;

  // Which chunk is showing; resets whenever Ollie says something new.
  const [position, setPosition] = useState({ text, index: 0 });
  const index = !paced ? last : position.text === text ? Math.min(position.index, last) : 0;

  useEffect(() => {
    if (!paced || index >= last) return;
    const words = chunks[index].split(/\s+/).length;
    const delay = speaking ? Math.max(MIN_CHUNK_MS, words * MS_PER_WORD) : CATCH_UP_MS;
    const timer = setTimeout(() => setPosition({ text, index: index + 1 }), delay);
    return () => clearTimeout(timer);
  }, [paced, index, last, chunks, speaking, text]);

  const target = chunks[index];
  const [shown, setShown] = useState(target);
  const span = useRef<HTMLSpanElement>(null);
  const fadingOut = useRef<Animation | null>(null);

  // Fade the old caption out, then swap in the new one...
  useEffect(() => {
    if (reducedMotion || target === shown || !span.current) return;
    const out = span.current.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-6px)" }], { duration: FADE_MS, easing: "ease-in", fill: "forwards" });
    fadingOut.current = out;
    out.finished.then(() => setShown(target), () => {});
    return () => out.cancel();
  }, [target, shown, reducedMotion]);

  // ...and fade it in.
  useEffect(() => {
    if (reducedMotion || !span.current) return;
    fadingOut.current?.cancel();
    const fadeIn = span.current.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(.34, 1.56, .64, 1)" });
    return () => fadeIn.cancel();
  }, [shown, reducedMotion]);

  return <p className="iv-question" data-more={index < last}>
    <span ref={span}>{reducedMotion ? target : shown}</span>
  </p>;
}

function useNarrowScreen() {
  return useSyncExternalStore((onChange) => {
    const query = window.matchMedia("(max-width: 760px)");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, () => window.matchMedia("(max-width: 760px)").matches, () => false);
}
