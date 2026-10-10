// Lines captions up with Ollie's voice using ElevenLabs' character alignment.
// Each audio chunk arrives with per-character start times relative to that chunk. Chunks play back to back,
// so a chunk starts when it arrives (plus playback latency) or when the previous chunk finishes, whichever is later.

export type Alignment = { chars: string[]; char_start_times_ms: number[]; char_durations_ms: number[] };

/** Time from receiving a chunk to hearing it (WebRTC jitter buffer + output). */
const PLAYBACK_LATENCY_MS = 150;
/** A chunk arriving this long after the last one finished playing starts a new utterance. */
const NEW_UTTERANCE_GAP_MS = 700;

export const normalizeSpeech = (text: string) => text.replace(/\s+/g, " ").trim();

export class SpeechTimeline {
  private starts: number[] = [];
  private text = "";
  private end = 0;
  /** Bumps on every change so pollers know to re-read. */
  version = 0;

  reset() {
    this.starts = [];
    this.text = "";
    this.end = 0;
    this.version++;
  }

  /** Adds one chunk of alignment. `now` is performance.now() when it arrived. */
  add(alignment: Alignment, now: number) {
    const { chars, char_start_times_ms: starts, char_durations_ms: durations } = alignment;
    if (!chars?.length || starts?.length !== chars.length) return;
    if (this.text && now > this.end + NEW_UTTERANCE_GAP_MS) this.reset();
    const chunkStart = Math.max(now + PLAYBACK_LATENCY_MS, this.end);
    for (let index = 0; index < chars.length; index++) {
      const char = chars[index];
      // Keep whitespace collapsed so positions match normalizeSpeech(message).
      if (/\s/.test(char) && (this.text === "" || this.text.endsWith(" "))) continue;
      this.text += /\s/.test(char) ? " " : char;
      this.starts.push(chunkStart + starts[index]);
    }
    const last = chars.length - 1;
    this.end = Math.max(this.end, chunkStart + starts[last] + (durations?.[last] ?? 0));
    this.version++;
  }

  /** Ollie was interrupted: drop the words he never got to say. */
  interrupt(now: number) {
    const spoken = this.spokenAt(now);
    this.starts = this.starts.slice(0, spoken);
    this.text = this.text.slice(0, spoken).trimEnd();
    this.end = Math.min(this.end, now);
    this.version++;
  }

  get hasSpeech() { return this.text.length > 0; }
  get spokenText() { return this.text; }

  /** Number of characters Ollie has started saying by `now`. */
  spokenAt(now: number) {
    let low = 0;
    let high = this.starts.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (this.starts[mid] <= now) low = mid + 1; else high = mid;
    }
    return low;
  }

  /** True once every character has been spoken. */
  finishedAt(now: number) { return this.text.length > 0 && now >= this.end; }
}
