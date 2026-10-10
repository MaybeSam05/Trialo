import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { normalizeSpeech, type SpeechTimeline } from "@/components/participant/speech-timeline";

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

/** Start of each chunk within `text` (chunks are trimmed pieces of the same normalised string). */
function chunkOffsets(text: string, chunks: string[]) {
  let from = 0;
  return chunks.map((chunk) => {
    const at = text.indexOf(chunk, from);
    const start = at < 0 ? from : at;
    from = start + chunk.length;
    return start;
  });
}

/** How far ahead to switch captions, so the fade lands as Ollie starts the next piece. */
const SWITCH_LEAD_MS = FADE_MS + 60;

type Timing = { version: number; text: string; spoken: number; upcoming: number; finished: boolean };

/**
 * Ollie's speech bubble. Long replies play as short captions that fade into each other.
 * With ElevenLabs alignment (voice mode) each caption appears exactly as Ollie reaches it and words light up
 * as they are spoken; otherwise captions are paced by an estimate. The full text stays in the captions log.
 */
export function SpeechBubble({ text, speaking, paced, reducedMotion, timeline }: {
  text: string; speaking: boolean; paced: boolean; reducedMotion: boolean; timeline?: SpeechTimeline | null;
}) {
  const narrow = useNarrowScreen();
  const max = narrow ? 80 : 140;

  // Follow the speech clock every frame while there is something to follow.
  const [timing, setTiming] = useState<Timing>({ version: -1, text: "", spoken: 0, upcoming: 0, finished: false });
  useEffect(() => {
    if (!timeline) return;
    let frame = 0;
    const step = () => {
      const now = performance.now();
      const next = { version: timeline.version, text: timeline.spokenText, spoken: timeline.spokenAt(now), upcoming: timeline.spokenAt(now + SWITCH_LEAD_MS), finished: timeline.finishedAt(now) };
      setTiming((current) => current.version === next.version && current.spoken === next.spoken && current.upcoming === next.upcoming && current.finished === next.finished ? current : next);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [timeline]);

  const message = normalizeSpeech(text);
  const timed = Boolean(timeline) && paced && timing.text.length > 0;
  // Prefer the full message when the audio is saying it; otherwise show exactly what the audio contains.
  const probe = timing.text.slice(0, 24).toLowerCase();
  const source = !timed ? message : message.toLowerCase().startsWith(probe) ? message : timing.text;

  const chunks = useMemo(() => chunkText(source, max), [source, max]);
  const offsets = useMemo(() => chunkOffsets(source, chunks), [source, chunks]);
  const last = chunks.length - 1;

  // Estimated pacing (text mode, or when no alignment arrives). Resets whenever Ollie says something new.
  const [position, setPosition] = useState({ text, index: 0 });
  const estimated = !paced ? last : position.text === text ? Math.min(position.index, last) : 0;
  useEffect(() => {
    if (timed || !paced || estimated >= last) return;
    const words = chunks[estimated].split(/\s+/).length;
    const delay = speaking ? Math.max(MIN_CHUNK_MS, words * MS_PER_WORD) : CATCH_UP_MS;
    const timer = setTimeout(() => setPosition({ text, index: estimated + 1 }), delay);
    return () => clearTimeout(timer);
  }, [timed, paced, estimated, last, chunks, speaking, text]);

  // Timed: the chunk that contains the next character Ollie is about to say.
  const reached = timing.finished ? source.length : Math.min(timing.upcoming, source.length);
  let index = estimated;
  if (timed) {
    index = 0;
    // Move on once Ollie has started (or is about to start) the first character of the next piece.
    while (index < last && reached > offsets[index + 1]) index++;
  }

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

  const visible = reducedMotion ? target : shown;
  // Words light up as Ollie starts them (whole words, so the highlight never splits one).
  let said = visible.length;
  if (timed && visible === target && !timing.finished) {
    const local = Math.max(0, Math.min(timing.spoken - offsets[index], visible.length));
    const wordEnd = visible.indexOf(" ", local - 1);
    said = local === 0 ? 0 : wordEnd === -1 ? visible.length : wordEnd;
  }

  return <p className="iv-question" data-more={index < last} data-timed={timed}>
    <span ref={span}>
      {said > 0 && <span className="iv-said">{visible.slice(0, said)}</span>}
      {said < visible.length && <span className="iv-ahead">{visible.slice(said)}</span>}
    </span>
  </p>;
}

function useNarrowScreen() {
  return useSyncExternalStore((onChange) => {
    const query = window.matchMedia("(max-width: 760px)");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, () => window.matchMedia("(max-width: 760px)").matches, () => false);
}
