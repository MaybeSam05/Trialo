// Saves interview answers reliably: one request at a time, in the order they were given, with bounded retries.
// Answers live only in memory (never browser storage); a failed answer stays here until it's saved or replaced.

/** Result of one save attempt: saved, worth retrying (network, timeout, 5xx), or refused for good (4xx). */
export type SendResult = "ok" | "retry" | "fail";
export type SaveOutcome = "saved" | "failed" | "replaced";
export type QueueState = { pending: number; failed: number; retryable: number };

type Item = { field: string; value: string; attempts: number; permanent: boolean; done: Array<(outcome: SaveOutcome) => void> };

const RETRY_DELAYS_MS = [700, 2_000, 5_000];

export class AnswerQueue {
  private queue: Item[] = [];
  private failed: Item[] = [];
  private inFlight: Item | null = null;
  private running = false;

  constructor(
    private send: (field: string, value: string) => Promise<SendResult>,
    private onChange: (state: QueueState) => void = () => {},
    private onSaved: (field: string, value: string) => void = () => {},
    private wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  /**
   * Queues an answer and resolves once it's saved, has failed for now, or was replaced by a newer answer to the same
   * question. A newer answer replaces an older one that hasn't been sent (or that failed), so a retry can never
   * overwrite a correction; an older answer already in flight is followed by the newer one, in order.
   */
  save(field: string, value: string): Promise<SaveOutcome> {
    return new Promise((resolve) => {
      for (const list of [this.queue, this.failed]) {
        const index = list.findIndex((item) => item.field === field);
        if (index >= 0) { list[index].done.forEach((finish) => finish("replaced")); list.splice(index, 1); }
      }
      this.queue.push({ field, value, attempts: 0, permanent: false, done: [resolve] });
      this.changed();
      void this.pump();
    });
  }

  /** Tries every answer that failed (except ones the server refused for good) again, in their original order. */
  retryFailed() {
    const again = this.failed.filter((item) => !item.permanent);
    this.failed = this.failed.filter((item) => item.permanent);
    this.queue.unshift(...again.map((item) => ({ ...item, attempts: 0 })));
    this.changed();
    void this.pump();
  }

  state(): QueueState {
    return { pending: this.queue.length + (this.inFlight ? 1 : 0), failed: this.failed.length, retryable: this.failed.filter((item) => !item.permanent).length };
  }

  private changed() { this.onChange(this.state()); }

  private async pump() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length) {
      const item = this.queue.shift()!;
      this.inFlight = item;
      this.changed();
      let result: SendResult = "retry";
      while (true) {
        item.attempts++;
        result = await this.send(item.field, item.value).catch((): SendResult => "retry");
        if (result !== "retry" || item.attempts > RETRY_DELAYS_MS.length) break;
        await this.wait(RETRY_DELAYS_MS[item.attempts - 1]);
      }
      this.inFlight = null;
      if (result === "ok") {
        this.onSaved(item.field, item.value);
        item.done.forEach((finish) => finish("saved"));
      } else {
        // Keep it for a manual retry unless a newer answer to the same question has arrived meanwhile.
        if (!this.queue.some((queued) => queued.field === item.field)) this.failed.push({ ...item, permanent: result === "fail", done: [] });
        item.done.forEach((finish) => finish("failed"));
      }
      this.changed();
    }
    this.running = false;
  }
}

/** Sends one answer to the server and classifies the result. Times out so a hung request can't block the queue. */
export async function postAnswer(sessionId: string, field: string, value: string): Promise<SendResult> {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/answers`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ field, value }), signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) return "ok";
    return response.status >= 500 || response.status === 408 || response.status === 409 || response.status === 429 ? "retry" : "fail";
  } catch {
    return "retry";
  }
}
